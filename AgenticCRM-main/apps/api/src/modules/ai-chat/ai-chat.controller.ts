import { Controller, Get, Post, Body, UseGuards, BadRequestException } from '@nestjs/common';
import { ApiTags, ApiBearerAuth, ApiOperation } from '@nestjs/swagger';
import { IsArray, ValidateNested, IsString, IsEnum, IsOptional, IsNumber } from 'class-validator';
import { Type } from 'class-transformer';
import { AiChatService } from './ai-chat.service';
import { ChatConversationsService } from '../chat-conversations/chat-conversations.service';
import { JwtAuthGuard } from '../auth/jwt-auth.guard';
import { CompanyScopeGuard } from '../../common/guards/company-scope.guard';
import { CurrentUser } from '../../common/decorators/current-user.decorator';
import { RequirePermissions } from '../../common/decorators/permissions.decorator';
import type { User } from '@wacrm/database';
import { normalizeAttachments, type ChatAttachment } from './attachments';
import { getAdminToolCatalog } from './admin-tools';
import { MemoryService } from '../memory/memory.service';

class RawAttachmentDto {
  @IsString() mimeType: string;
  @IsString() fileName: string;
  @IsString() dataBase64: string;
  @IsNumber() @IsOptional() size?: number;
}

class ChatMessageDto {
  @IsEnum(['system', 'user', 'assistant'])
  role: 'system' | 'user' | 'assistant';

  @IsString()
  content: string;

  @IsArray() @IsOptional()
  @ValidateNested({ each: true })
  @Type(() => RawAttachmentDto)
  attachments?: RawAttachmentDto[];
}

class AiChatBody {
  @IsArray()
  @ValidateNested({ each: true })
  @Type(() => ChatMessageDto)
  messages: ChatMessageDto[];

  @IsString() @IsOptional()
  conversationId?: string;
}

@ApiTags('ai-chat')
@ApiBearerAuth()
@UseGuards(JwtAuthGuard, CompanyScopeGuard)
@RequirePermissions('ai_chat')
@Controller('ai/chat')
export class AiChatController {
  constructor(
    private readonly svc: AiChatService,
    private readonly convSvc: ChatConversationsService,
    private readonly memory: MemoryService,
  ) {}

  @Get('tools')
  @ApiOperation({ summary: 'List all AI admin tools (for the docs page)' })
  listTools(@CurrentUser() user: User) {
    return getAdminToolCatalog(user.permissions ?? [], user.role);
  }

  @Post('knowledge')
  @RequirePermissions('memory')
  @ApiOperation({ summary: 'Ask the permission-aware RAG business knowledge assistant' })
  async askKnowledge(@CurrentUser() user: User, @Body() body: { query: string }) {
    const query = String(body?.query ?? '').trim();
    if (!query || query.length > 4000) throw new BadRequestException('Query is required (maximum 4,000 characters)');

    const hits = await this.memory.search(user.companyId, query, {
      source: 'business-doc',
      includeBusinessDocs: true,
      maxResults: 8,
      userId: user.id,
      canViewAll: user.role === 'SUPER_ADMIN' || user.role === 'ADMIN',
    });
    if (!hits.length) {
      return {
        content: 'I could not find relevant information in the business documents you are allowed to access. Upload or share the relevant document and try again.',
        sources: [],
        grounded: true,
      };
    }

    const sources = hits.map((hit, index) => ({
      id: `S${index + 1}`,
      documentId: hit.documentId,
      name: hit.originalName || hit.path.split('/').pop() || hit.path,
      path: hit.path,
      startLine: hit.startLine,
      endLine: hit.endLine,
      score: Number(hit.score.toFixed(4)),
      excerpt: hit.text.slice(0, 1200),
    }));
    const context = hits.map((hit, index) =>
      `[S${index + 1}] ${hit.originalName || hit.path} (lines ${hit.startLine}-${hit.endLine})\n${hit.text}`,
    ).join('\n\n---\n\n');

    const result = await this.svc.chat(
      user.companyId,
      [{
        role: 'user',
        content: `Answer the question using ONLY the business-document excerpts below. If the excerpts do not contain the answer, say that the uploaded documents do not provide enough information. Do not infer missing facts or use general knowledge. Cite every factual claim with one or more source markers exactly like [S1].\n\nQUESTION:\n${query}\n\nDOCUMENT EXCERPTS:\n${context}`,
      }],
      undefined,
      [],
      'AGENT',
      true,
    );
    return { content: result.content, sources, grounded: true, provider: result.provider, model: result.model };
  }

  @Post()
  @ApiOperation({ summary: 'Chat with configured AI model (admin tool)' })
  async chat(@CurrentUser() user: User, @Body() body: AiChatBody) {
    // Validate + normalize attachments per message before any persistence or
    // provider call. Surfaces clean 400s for oversize / unsupported files.
    let normalized: Array<{ role: string; content: string; attachments?: ChatAttachment[] }>;
    try {
      normalized = body.messages.map((m) => ({
        role: m.role,
        content: m.content,
        attachments: m.attachments?.length ? normalizeAttachments(m.attachments) : undefined,
      }));
    } catch (err) {
      throw new BadRequestException(err instanceof Error ? err.message : 'Invalid attachment');
    }

    // Save user message (with attachments) to conversation if conversationId provided
    if (body.conversationId) {
      const lastMsg = normalized[normalized.length - 1];
      if (lastMsg?.role === 'user') {
        await this.convSvc.addMessage(body.conversationId, {
          role: 'user',
          content: lastMsg.content,
          attachments: lastMsg.attachments,
        });
      }
    }

    const result = await this.svc.chat(
      user.companyId,
      normalized,
      body.conversationId,
      user.permissions ?? [],
      user.role,
    );

    // Save assistant response to conversation
    if (body.conversationId) {
      await this.convSvc.addMessage(body.conversationId, {
        role: 'assistant',
        content: result.content,
        toolCalls: result.actions?.length ? result.actions : undefined,
        provider: result.provider,
        model: result.model,
        latencyMs: result.latencyMs,
      });
    }

    return result;
  }
}
