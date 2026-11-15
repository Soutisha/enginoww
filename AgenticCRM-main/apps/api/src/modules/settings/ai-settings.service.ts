import { BadRequestException, Injectable, Logger, OnModuleInit } from '@nestjs/common';
import { prisma } from '@wacrm/database';
import type { AiProvider } from '@wacrm/database';
import { decrypt, encrypt } from '@wacrm/shared';

export const DEFAULT_OPENAI_MODEL = 'gpt-5.4-mini';

export const OPENAI_MODELS = [
  'gpt-5.4-mini',
  'gpt-5.4',
  'gpt-5.5',
] as const;

export interface FallbackModelEntry {
  provider: 'OPENAI';
  model: string;
  apiKey?: string;
  apiKeyEncrypted?: string;
}

export interface UpsertAiConfigDto {
  provider: AiProvider;
  model: string;
  apiKey?: string;
  baseUrl?: string;
  systemPrompt?: string;
  tone?: string;
  maxTokens?: number;
  temperature?: number;
  autoReplyEnabled?: boolean;
  toolCallingEnabled?: boolean;
}

/** Only first-party OpenAI models are exposed by this application. */
export const PROVIDER_MODELS: Partial<Record<AiProvider, string[]>> = {
  OPENAI: [...OPENAI_MODELS],
};

@Injectable()
export class AiSettingsService implements OnModuleInit {
  private readonly logger = new Logger(AiSettingsService.name);

  /**
   * Migrate existing tenant settings away from third-party providers.
   * Non-OpenAI credentials are cleared rather than being sent to OpenAI.
   * Existing OpenAI credentials are retained.
   */
  async onModuleInit(): Promise<void> {
    const configs = await prisma.aiConfig.findMany({
      select: {
        companyId: true,
        provider: true,
        model: true,
        baseUrl: true,
        fallbackModels: true,
      },
    });

    let migrated = 0;
    for (const config of configs) {
      const isOpenAI = config.provider === 'OPENAI';
      const modelIsSupported = (OPENAI_MODELS as readonly string[]).includes(config.model);
      const hasFallbacks = Array.isArray(config.fallbackModels) && config.fallbackModels.length > 0;
      if (isOpenAI && modelIsSupported && !config.baseUrl && !hasFallbacks) continue;

      await prisma.aiConfig.update({
        where: { companyId: config.companyId },
        data: {
          provider: 'OPENAI',
          model: isOpenAI && modelIsSupported ? config.model : DEFAULT_OPENAI_MODEL,
          baseUrl: null,
          fallbackModels: [],
          ...(isOpenAI ? {} : { apiKeyEncrypted: null }),
          testStatus: null,
          testError: null,
        },
      });
      migrated += 1;
    }

    if (migrated > 0) {
      this.logger.warn(
        `Migrated ${migrated} AI workspace configuration(s) to OpenAI-only. Non-OpenAI keys were cleared; add an OpenAI API key in Settings → AI.`,
      );
    }
  }

  async get(companyId: string) {
    const config = await prisma.aiConfig.findUnique({ where: { companyId } });
    if (!config) {
      return {
        provider: 'OPENAI',
        model: DEFAULT_OPENAI_MODEL,
        apiKeySet: !!process.env.OPENAI_API_KEY,
        baseUrl: null,
        systemPrompt: 'You are a helpful sales assistant. Help the customer and capture their information.',
        tone: 'professional',
        maxTokens: 1024,
        temperature: 0.7,
        autoReplyEnabled: false,
        toolCallingEnabled: true,
        testStatus: null,
        testError: null,
      };
    }

    return {
      ...config,
      // Never return the encrypted or plaintext key to the browser.
      apiKeySet: !!config.apiKeyEncrypted || !!process.env.OPENAI_API_KEY,
      apiKeyEncrypted: undefined,
      provider: 'OPENAI' as const,
      baseUrl: null,
    };
  }

  async upsert(companyId: string, dto: UpsertAiConfigDto) {
    if (dto.provider !== 'OPENAI') {
      throw new BadRequestException('BizPilot is configured for OpenAI only. Select OpenAI.');
    }
    if (!(OPENAI_MODELS as readonly string[]).includes(dto.model)) {
      throw new BadRequestException('Unsupported OpenAI model. Select one of the listed OpenAI models.');
    }

    const data: Record<string, unknown> = {
      provider: 'OPENAI',
      model: dto.model,
      systemPrompt: dto.systemPrompt,
      tone: dto.tone,
      maxTokens: dto.maxTokens,
      temperature: dto.temperature,
      autoReplyEnabled: dto.autoReplyEnabled,
      toolCallingEnabled: dto.toolCallingEnabled,
      baseUrl: null,
      fallbackModels: [],
    };

    // Workspace key takes precedence over the optional server-wide OpenAI key.
    if (dto.apiKey && dto.apiKey.trim().length > 0) {
      data.apiKeyEncrypted = encrypt(dto.apiKey.trim());
    }

    return prisma.aiConfig.upsert({
      where: { companyId },
      create: { companyId, ...data },
      update: data,
    });
  }

  async test(companyId: string) {
    const config = await prisma.aiConfig.findUnique({ where: { companyId } });
    const apiKey = config?.apiKeyEncrypted
      ? decrypt(config.apiKeyEncrypted)
      : process.env.OPENAI_API_KEY;

    if (!apiKey) {
      return {
        ok: false,
        error: 'OpenAI API key is missing. Add it in Settings → AI or set OPENAI_API_KEY on the API service.',
      };
    }

    const model = config?.model && (OPENAI_MODELS as readonly string[]).includes(config.model)
      ? config.model
      : DEFAULT_OPENAI_MODEL;
    const start = Date.now();

    try {
      const reply = await this.pingOpenAI(model, apiKey);
      const latencyMs = Date.now() - start;

      if (config) {
        await prisma.aiConfig.update({
          where: { companyId },
          data: { provider: 'OPENAI', model, baseUrl: null, testStatus: 'ok', testError: null },
        });
      }

      return { ok: true, reply, latencyMs };
    } catch (err: unknown) {
      const message = err instanceof Error ? err.message : String(err);
      if (config) {
        await prisma.aiConfig.update({
          where: { companyId },
          data: { testStatus: 'error', testError: message },
        });
      }
      return { ok: false, error: message };
    }
  }

  getProviderModels(provider: AiProvider): string[] {
    return provider === 'OPENAI' ? [...OPENAI_MODELS] : [];
  }

  private async pingOpenAI(model: string, apiKey: string): Promise<string> {
    const res = await fetch('https://api.openai.com/v1/chat/completions', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${apiKey}`,
      },
      body: JSON.stringify({
        model,
        messages: [{ role: 'user', content: 'Say "pong" in one word.' }],
        max_completion_tokens: 16,
        reasoning_effort: 'none',
      }),
    });

    if (!res.ok) {
      const body = await res.text();
      throw new Error(`OpenAI error: ${res.status} ${body.slice(0, 500)}`);
    }

    const json = await res.json() as { choices?: Array<{ message?: { content?: string } }> };
    return json.choices?.[0]?.message?.content?.trim() || 'ok';
  }

  async getFallbacks(companyId: string): Promise<Array<{
    provider: 'OPENAI';
    model: string;
    apiKeySet: boolean;
  }>> {
    const config = await prisma.aiConfig.findUnique({ where: { companyId } });
    const raw = (config?.fallbackModels ?? []) as unknown as FallbackModelEntry[];
    return raw
      .filter((entry) => entry.provider === 'OPENAI' && (OPENAI_MODELS as readonly string[]).includes(entry.model))
      .map((entry) => ({
        provider: 'OPENAI' as const,
        model: entry.model,
        apiKeySet: !!entry.apiKeyEncrypted,
      }));
  }

  async addFallback(companyId: string, entry: FallbackModelEntry): Promise<void> {
    if (entry.provider !== 'OPENAI' || !(OPENAI_MODELS as readonly string[]).includes(entry.model)) {
      throw new BadRequestException('Only supported OpenAI models can be used as fallbacks.');
    }
    const config = await prisma.aiConfig.findUnique({ where: { companyId } });
    if (!config) throw new BadRequestException('Save the OpenAI configuration before adding a fallback.');

    const existing = (config.fallbackModels ?? []) as unknown as FallbackModelEntry[];
    const safeExisting = existing.filter(
      (item) => item.provider === 'OPENAI' && (OPENAI_MODELS as readonly string[]).includes(item.model),
    );
    if (safeExisting.length >= 5) throw new BadRequestException('Maximum 5 OpenAI fallback models allowed');

    const stored: FallbackModelEntry = {
      provider: 'OPENAI',
      model: entry.model,
      apiKeyEncrypted: entry.apiKey?.trim() ? encrypt(entry.apiKey.trim()) : undefined,
    };
    await prisma.aiConfig.update({
      where: { companyId },
      data: { fallbackModels: JSON.parse(JSON.stringify([...safeExisting, stored])) },
    });
  }

  async removeFallback(companyId: string, index: number): Promise<void> {
    const config = await prisma.aiConfig.findUnique({ where: { companyId } });
    if (!config) return;
    const existing = (config.fallbackModels ?? []) as unknown as FallbackModelEntry[];
    const safeExisting = existing.filter(
      (item) => item.provider === 'OPENAI' && (OPENAI_MODELS as readonly string[]).includes(item.model),
    );
    if (index < 0 || index >= safeExisting.length) {
      throw new BadRequestException('Fallback model not found.');
    }
    safeExisting.splice(index, 1);
    await prisma.aiConfig.update({
      where: { companyId },
      data: { fallbackModels: JSON.parse(JSON.stringify(safeExisting)) },
    });
  }

  async getResolvedFallbacks(companyId: string): Promise<Array<{
    provider: 'OPENAI';
    model: string;
    apiKey: string;
    baseUrl?: null;
  }>> {
    const config = await prisma.aiConfig.findUnique({ where: { companyId } });
    if (!config) return [];
    const primaryKey = config.apiKeyEncrypted
      ? decrypt(config.apiKeyEncrypted)
      : process.env.OPENAI_API_KEY ?? '';
    const raw = (config.fallbackModels ?? []) as unknown as FallbackModelEntry[];

    return raw
      .filter((fallback) => fallback.provider === 'OPENAI' && (OPENAI_MODELS as readonly string[]).includes(fallback.model))
      .map((fallback) => ({
        provider: 'OPENAI' as const,
        model: fallback.model,
        apiKey: fallback.apiKeyEncrypted ? decrypt(fallback.apiKeyEncrypted) : primaryKey,
        baseUrl: null,
      }))
      .filter((fallback) => !!fallback.apiKey);
  }
}
