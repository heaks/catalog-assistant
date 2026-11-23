import { Controller, Get, Query } from '@nestjs/common';
import { EmbeddingsService } from './embeddings.service.js';

// Temporary endpoint to sanity-check embeddings; remove once /search exists.
@Controller('debug/embeddings')
export class EmbeddingsController {
  constructor(private readonly embeddings: EmbeddingsService) {}

  @Get()
  async compare(@Query('a') a: string, @Query('b') b: string) {
    const [va, vb] = await this.embeddings.embed([a, b]);
    // vectors are normalized, so the dot product equals cosine similarity
    const similarity = va.reduce((sum, x, i) => sum + x * vb[i], 0);
    return { dim: va.length, similarity: Number(similarity.toFixed(4)) };
  }
}
