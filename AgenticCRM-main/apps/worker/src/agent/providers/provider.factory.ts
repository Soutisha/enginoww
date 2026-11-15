import type { AiProvider } from './provider.interface';
import { OpenAiProvider } from './openai.provider';

export interface ProviderConfig {
  provider: string;
  model: string;
  apiKey: string;
  baseUrl?: string;
}

/** BizPilot's background AI path is intentionally first-party OpenAI only. */
export class ProviderFactory {
  static create(config: ProviderConfig): AiProvider {
    if (config.provider !== 'OPENAI') {
      throw new Error('Only OpenAI is enabled for BizPilot AI.');
    }
    if (!config.apiKey?.trim()) {
      throw new Error('An OpenAI API key is required.');
    }
    if (config.baseUrl) {
      throw new Error('Custom AI base URLs are disabled. BizPilot connects directly to OpenAI.');
    }
    return new OpenAiProvider(config.apiKey, config.model, 'OPENAI');
  }
}
