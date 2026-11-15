import { BadRequestException, Injectable, ServiceUnavailableException } from '@nestjs/common';
import { prisma } from '@wacrm/database';
import { decrypt } from '@wacrm/shared';
import { PROVIDER_BASE_URLS } from '../settings/ai-settings.service';

export interface ProductVisionResult {
  name: string;
  category: string | null;
  description: string;
  attributes: Record<string, string>;
  tags: string[];
  extractedText: string[];
  condition: string | null;
  imageQuality: 'good' | 'fair' | 'poor';
  confidence: number;
  warnings: string[];
}

const MAX_IMAGE_BYTES = 10 * 1024 * 1024;
const ALLOWED_MIME = new Set(['image/jpeg', 'image/png', 'image/webp', 'image/gif']);

@Injectable()
export class ProductVisionService {
  async analyze(companyId: string, file: { buffer: Buffer; mimetype: string; size: number; originalname: string }): Promise<ProductVisionResult> {
    if (!file?.buffer?.length) throw new BadRequestException('An image file is required');
    if (!ALLOWED_MIME.has(file.mimetype)) throw new BadRequestException('Only JPEG, PNG, WEBP and GIF images are supported');
    if (file.size > MAX_IMAGE_BYTES || file.buffer.length > MAX_IMAGE_BYTES) {
      throw new BadRequestException('Image must be 10 MB or smaller');
    }

    const config = await prisma.aiConfig.findUnique({ where: { companyId } });
    if (!config?.apiKeyEncrypted) {
      throw new ServiceUnavailableException('Configure an AI provider and API key in Settings → AI before using Product Intelligence');
    }

    const provider = String(config.provider);
    const model = config.model;
    const apiKey = decrypt(config.apiKeyEncrypted);
    const baseUrl = provider === 'GEMINI'
      ? 'https://generativelanguage.googleapis.com/v1beta/openai'
      : provider === 'OPENAI'
        ? 'https://api.openai.com/v1'
        : PROVIDER_BASE_URLS[config.provider as keyof typeof PROVIDER_BASE_URLS];

    if (!baseUrl || !this.supportsVision(provider, model)) {
      throw new BadRequestException(
        `The configured ${provider} model (${model}) is not enabled for image analysis. Select a vision-capable OpenAI or Gemini model in Settings → AI.`,
      );
    }

    const dataUrl = `data:${file.mimetype};base64,${file.buffer.toString('base64')}`;
    const prompt = [
      'Analyze this product image for a business product catalogue.',
      'Return ONLY valid JSON with keys: name, category, description, attributes, tags, extractedText, condition, imageQuality, confidence, warnings.',
      'Do not invent brand, model, materials, dimensions, price, SKU, barcode, or specifications that are not visually supported.',
      'Use null for unknown category or condition. attributes must be string-to-string values.',
      'extractedText should contain only text visibly readable in the image. confidence must be between 0 and 1.',
      'imageQuality must be good, fair, or poor. Add warnings for ambiguity, occlusion, low resolution, or uncertain identification.',
    ].join(' ');

    const response = await fetch(`${baseUrl.replace(/\/$/, '')}/chat/completions`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${apiKey}` },
      body: JSON.stringify({
        model,
        temperature: 0.1,
        max_tokens: 1200,
        response_format: { type: 'json_object' },
        messages: [{
          role: 'user',
          content: [
            { type: 'text', text: prompt },
            { type: 'image_url', image_url: { url: dataUrl, detail: 'high' } },
          ],
        }],
      }),
      signal: AbortSignal.timeout(45_000),
    }).catch((error: unknown) => {
      const message = error instanceof Error ? error.message : 'Network error';
      throw new ServiceUnavailableException(`Image analysis provider unavailable: ${message}`);
    });

    if (!response.ok) {
      const detail = (await response.text()).slice(0, 500);
      throw new ServiceUnavailableException(`Image analysis failed (${response.status}): ${detail}`);
    }

    const payload = await response.json() as { choices?: Array<{ message?: { content?: string } }> };
    const content = payload.choices?.[0]?.message?.content;
    if (!content) throw new ServiceUnavailableException('The AI provider returned an empty image analysis');

    let parsed: Partial<ProductVisionResult>;
    try {
      const clean = content.replace(/^```(?:json)?\s*/i, '').replace(/\s*```$/, '');
      parsed = JSON.parse(clean) as Partial<ProductVisionResult>;
    } catch {
      throw new ServiceUnavailableException('The AI provider returned an invalid structured response. Please retry.');
    }

    return {
      name: this.safeText(parsed.name, 160) || file.originalname.replace(/\.[^.]+$/, '').slice(0, 160),
      category: this.safeText(parsed.category, 80) || null,
      description: this.safeText(parsed.description, 1200),
      attributes: this.safeAttributes(parsed.attributes),
      tags: this.safeStringArray(parsed.tags, 12, 40),
      extractedText: this.safeStringArray(parsed.extractedText, 30, 200),
      condition: this.safeText(parsed.condition, 80) || null,
      imageQuality: ['good', 'fair', 'poor'].includes(String(parsed.imageQuality))
        ? parsed.imageQuality as ProductVisionResult['imageQuality'] : 'fair',
      confidence: typeof parsed.confidence === 'number' && Number.isFinite(parsed.confidence)
        ? Math.max(0, Math.min(1, parsed.confidence)) : 0,
      warnings: this.safeStringArray(parsed.warnings, 10, 240),
    };
  }

  private supportsVision(provider: string, model: string): boolean {
    const m = model.toLowerCase();
    if (provider === 'GEMINI') return m.includes('gemini');
    if (provider === 'OPENAI') return /gpt-4o|gpt-4\.1|gpt-5|o[34]-mini/.test(m);
    // Other providers may expose vision through custom model aliases, but cannot be
    // safely inferred from their provider/model setting.
    return false;
  }

  private safeText(value: unknown, max: number): string {
    return typeof value === 'string' ? value.trim().slice(0, max) : '';
  }

  private safeStringArray(value: unknown, count: number, max: number): string[] {
    if (!Array.isArray(value)) return [];
    return value.filter((v): v is string => typeof v === 'string')
      .map((v) => v.trim().slice(0, max)).filter(Boolean).slice(0, count);
  }

  private safeAttributes(value: unknown): Record<string, string> {
    if (!value || typeof value !== 'object' || Array.isArray(value)) return {};
    return Object.fromEntries(Object.entries(value as Record<string, unknown>)
      .filter(([key, val]) => typeof val === 'string' && key.trim())
      .slice(0, 20)
      .map(([key, val]) => [key.slice(0, 60), String(val).trim().slice(0, 160)]));
  }
}
