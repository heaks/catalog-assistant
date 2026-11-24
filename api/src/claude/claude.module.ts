import { Global, Module } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import Anthropic from '@anthropic-ai/sdk';

export const ANTHROPIC = Symbol('ANTHROPIC');

@Global()
@Module({
  providers: [
    {
      provide: ANTHROPIC,
      inject: [ConfigService],
      useFactory: (config: ConfigService) =>
        new Anthropic({
          apiKey: config.getOrThrow<string>('ANTHROPIC_API_KEY'),
          maxRetries: 3, // SDK retries 429/5xx/529 with exponential backoff
          timeout: 60_000,
        }),
    },
  ],
  exports: [ANTHROPIC],
})

export class ClaudeModule {}
