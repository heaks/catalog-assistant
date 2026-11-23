import { Inject, Injectable } from '@nestjs/common';
import {
  and,
  cosineDistance,
  ilike,
  isNotNull,
  lte,
  sql,
  type SQL,
} from 'drizzle-orm';
import { DB, type Db } from '../db/db.module.js';
import { products } from '../db/schema.js';
import { EmbeddingsService } from '../embeddings/embeddings.service.js';

export interface SearchParams {
  query: string;
  limit?: number;
  maxPriceUsdCents?: number;
  category?: string;
}

export interface SearchHit {
  id: string;
  name: string;
  brand: string | null;
  category: string | null;
  priceUsdCents: number | null;
  imageUrl: string | null;
  similarity: number;
}

@Injectable()
export class SearchService {
  constructor(
    @Inject(DB) private readonly db: Db,
    private readonly embeddings: EmbeddingsService,
  ) {}

  async search({
    query,
    limit = 10,
    maxPriceUsdCents,
    category,
  }: SearchParams): Promise<SearchHit[]> {
    const vector = await this.embeddings.embedOne(query);
    const distance = cosineDistance(products.embedding, vector);

    const filters: SQL[] = [isNotNull(products.embedding)];
    if (maxPriceUsdCents !== undefined)
      filters.push(lte(products.priceUsd, maxPriceUsdCents));
    if (category)
      filters.push(ilike(products.category, `%${escapeLike(category)}%`));

    return this.db
      .select({
        id: products.id,
        name: products.name,
        brand: products.brand,
        category: products.category,
        priceUsdCents: products.priceUsd,
        imageUrl: products.imageUrl,
        similarity: sql<number>`1 - (${distance})`.mapWith(Number),
      })
      .from(products)
      .where(and(...filters))
      .orderBy(distance)
      .limit(limit);
  }
}

// % and _ are wildcards in LIKE; user input must match them literally.
function escapeLike(value: string): string {
  return value.replace(/[\\%_]/g, (c) => `\\${c}`);
}
