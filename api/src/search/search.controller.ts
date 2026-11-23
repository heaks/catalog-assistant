import { BadRequestException, Controller, Get, Query } from '@nestjs/common';
import { SearchService } from './search.service.js';

const MAX_LIMIT = 50;

@Controller('search')
export class SearchController {
  constructor(private readonly searchService: SearchService) {}

  @Get()
  async search(
    @Query('q') q?: string,
    @Query('limit') limit = '10',
    @Query('maxPrice') maxPrice?: string,
    @Query('category') category?: string,
  ) {
    const query = q?.trim();
    if (!query) throw new BadRequestException('q is required');

    const take = Number(limit);
    if (!Number.isInteger(take) || take < 1 || take > MAX_LIMIT) {
      throw new BadRequestException(
        `limit must be an integer between 1 and ${MAX_LIMIT}`,
      );
    }

    const price = maxPrice === undefined ? undefined : Number(maxPrice);
    if (price !== undefined && (!Number.isFinite(price) || price <= 0)) {
      throw new BadRequestException('maxPrice must be a positive number (USD)');
    }

    const hits = await this.searchService.search({
      query,
      limit: take,
      maxPriceUsdCents:
        price === undefined ? undefined : Math.round(price * 100),
      category: category?.trim() || undefined,
    });

    return hits.map(({ priceUsdCents, similarity, ...hit }) => ({
      ...hit,
      priceUsd: priceUsdCents === null ? null : priceUsdCents / 100,
      similarity: Number(similarity.toFixed(4)),
    }));
  }
}
