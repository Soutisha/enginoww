/**
 * Memory REST API — drives the dashboard's file-browser memory page.
 */
import { Controller, Get, Post, Delete, Body, Query, Param, UseGuards, BadRequestException, ForbiddenException } from '@nestjs/common';
import { ApiTags, ApiBearerAuth } from '@nestjs/swagger';
import { IsString, IsOptional, IsNumber, IsArray, IsIn } from 'class-validator';
import { randomUUID } from 'node:crypto';
import { extractDocumentText } from './document-parser';
import { prisma } from '@wacrm/database';
import { MemoryService } from './memory.service';
import { JwtAuthGuard } from '../auth/jwt-auth.guard';
import { CompanyScopeGuard } from '../../common/guards/company-scope.guard';
import { RequirePermissions } from "../../common/decorators/permissions.decorator";
import { CurrentUser } from '../../common/decorators/current-user.decorator';
import type { User } from '@wacrm/database';

class WriteFileDto {
  @IsString() path: string;
  @IsString() content: string;
  @IsString() @IsOptional() source?: string;
}


class BusinessDocumentUploadDto {
  @IsString() fileName: string;
  @IsString() mimeType: string;
  @IsString() dataBase64: string;
  @IsOptional() @IsIn(['COMPANY', 'PRIVATE', 'RESTRICTED']) visibility?: string;
  @IsOptional() @IsArray() @IsString({ each: true }) allowedUserIds?: string[];
}

class BusinessKnowledgeQueryDto {
  @IsString() query: string;
  @IsOptional() @IsNumber() maxResults?: number;
}

class SearchDto {
  @IsString() query: string;
  @IsNumber() @IsOptional() maxResults?: number;
  @IsNumber() @IsOptional() minScore?: number;
  @IsString() @IsOptional() source?: string;
}

@ApiTags('memory')
@ApiBearerAuth()
@UseGuards(JwtAuthGuard, CompanyScopeGuard)
@RequirePermissions('memory')
@Controller('memory')
export class MemoryController {
  constructor(private readonly memory: MemoryService) {}

  @Get('files')
  listFiles(@CurrentUser() user: User, @Query('source') source?: string) {
    return this.memory.listFiles(user.companyId, source);
  }

  @Get('file')
  async readFile(@CurrentUser() user: User, @Query('path') path: string) {
    const content = await this.memory.readFile(user.companyId, path);
    if (content === null) return { path, content: null };
    return { path, content };
  }

  @Post('file')
  writeFile(@CurrentUser() user: User, @Body() body: WriteFileDto) {
    if (body.source === 'business-doc' || body.path.startsWith('business-docs/')) {
      throw new ForbiddenException('Use the Business Brain upload endpoint for business documents');
    }
    return this.memory.writeFile(user.companyId, body.path, body.content, body.source);
  }

  @Delete('file')
  async deleteFile(@CurrentUser() user: User, @Query('path') path: string) {
    await this.memory.deleteFile(user.companyId, path);
    return { ok: true };
  }

  @Post('search')
  search(@CurrentUser() user: User, @Body() body: SearchDto) {
    return this.memory.search(user.companyId, body.query, {
      maxResults: body.maxResults,
      minScore: body.minScore,
      source: body.source,
    });
  }

  @Get('business-documents')
  listBusinessDocuments(@CurrentUser() user: User) {
    return this.memory.listBusinessDocuments(
      user.companyId,
      user.id,
      user.role === 'SUPER_ADMIN' || user.role === 'ADMIN',
    );
  }

  @Post('business-documents/upload')
  async uploadBusinessDocument(@CurrentUser() user: User, @Body() body: BusinessDocumentUploadDto) {
    if (!body.dataBase64 || body.dataBase64.length > 21_000_000) {
      throw new BadRequestException('File is missing or exceeds the 15 MB upload limit');
    }
    const base64 = body.dataBase64.replace(/^data:[^;]+;base64,/, '');
    let buffer: Buffer;
    try { buffer = Buffer.from(base64, 'base64'); } catch { throw new BadRequestException('Invalid base64 file'); }
    const fileName = (body.fileName || 'document').replace(/[\\/\0]/g, '_').slice(0, 180);
    let text: string;
    try {
      text = extractDocumentText(fileName, body.mimeType || 'application/octet-stream', buffer);
    } catch (error) {
      throw new BadRequestException(error instanceof Error ? error.message : 'Unable to parse document');
    }
    const id = randomUUID();
    const visibility = body.visibility ?? 'COMPANY';
    if (!['COMPANY', 'PRIVATE', 'RESTRICTED'].includes(visibility)) {
      throw new BadRequestException('Invalid document visibility');
    }
    const isAdmin = user.role === 'SUPER_ADMIN' || user.role === 'ADMIN';
    if (visibility === 'RESTRICTED' && !isAdmin) {
      throw new ForbiddenException('Only company admins can create restricted knowledge documents');
    }
    const allowedUserIds = visibility === 'RESTRICTED' ? [...new Set(body.allowedUserIds ?? [])] : [];
    if (allowedUserIds.length) {
      const validUsers = await prisma.user.findMany({
        where: { companyId: user.companyId, id: { in: allowedUserIds } },
        select: { id: true },
      });
      if (validUsers.length !== allowedUserIds.length) {
        throw new BadRequestException('Every shared user must belong to your company');
      }
    }
    const path = `business-docs/${id}/${fileName}`;
    const indexed = await this.memory.writeFile(user.companyId, path, text, 'business-doc', {
      ownerUserId: user.id,
      visibility,
      allowedUserIds,
      originalName: fileName,
      originalSize: buffer.length,
      mimeType: body.mimeType,
    });
    return { ...indexed, name: fileName, visibility, characters: text.length };
  }

  @Delete('business-documents/:id')
  deleteBusinessDocument(@CurrentUser() user: User, @Param('id') id: string) {
    return this.memory.deleteBusinessDocument(
      user.companyId, id, user.id, user.role === 'SUPER_ADMIN' || user.role === 'ADMIN',
    );
  }

  @Post('business-documents/search')
  searchBusinessDocuments(@CurrentUser() user: User, @Body() body: BusinessKnowledgeQueryDto) {
    return this.memory.search(user.companyId, body.query, {
      source: 'business-doc',
      includeBusinessDocs: true,
      maxResults: body.maxResults ?? 8,
      userId: user.id,
      canViewAll: user.role === 'SUPER_ADMIN' || user.role === 'ADMIN',
    });
  }

  @Get('stats')
  stats(@CurrentUser() user: User) {
    return this.memory.stats(user.companyId);
  }
}
