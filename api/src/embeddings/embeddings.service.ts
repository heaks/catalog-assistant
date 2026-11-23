import { Injectable, Logger, OnModuleInit } from '@nestjs/common';
import {
  env,
  pipeline,
  type FeatureExtractionPipeline,
} from '@huggingface/transformers';

// Keep downloaded models outside node_modules: the dev watcher tracks imported
// packages, so writing the cache there restarts the app mid-download.
env.cacheDir = './.cache/models';

const MODEL = 'Xenova/all-MiniLM-L6-v2';
export const EMBEDDING_DIM = 384;

@Injectable()
export class EmbeddingsService implements OnModuleInit {
  private readonly logger = new Logger(EmbeddingsService.name);
  private extractor: FeatureExtractionPipeline;

  async onModuleInit() {
    const started = Date.now();
    this.extractor = await pipeline('feature-extraction', MODEL, {
      dtype: 'fp32',
    });
    this.logger.log(`Model ${MODEL} loaded in ${Date.now() - started}ms`);
  }

  async embed(texts: string[]): Promise<number[][]> {
    if (texts.length === 0) return [];
    const output = await this.extractor(texts, {
      pooling: 'mean',
      normalize: true,
    });
    return output.tolist() as number[][];
  }

  async embedOne(text: string): Promise<number[]> {
    const [vector] = await this.embed([text]);
    return vector;
  }
}
