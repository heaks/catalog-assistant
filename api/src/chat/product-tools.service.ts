import { Inject, Injectable } from '@nestjs/common';
import type Anthropic from '@anthropic-ai/sdk';
import { eq, inArray } from 'drizzle-orm';
import { z } from 'zod';
import { DB, type Db } from '../db/db.module.js';
import { products } from '../db/schema.js';
import { SearchService } from '../search/search.service.js';

const SearchInput = z.object({
  query: z
    .string()
    .min(1)
    .max(200)
    .describe(
      'What the shopper wants, in natural language, e.g. "red party dress for women"',
    ),
  maxPrice: z.number().positive().optional().describe('Maximum price in USD'),
  category: z
    .string()
    .max(100)
    .optional()
    .describe(
      'Optional category filter (substring match). Main categories: Clothing, Jewellery, Footwear, ' +
      'Mobiles & Accessories, Watches, Home Decor & Festive Needs, Automotive, Home Furnishing, ' +
      'Beauty and Personal Care, Kitchen & Dining, Bags, Wallets & Belts. Can be narrower, e.g. ' +
      '"Women\'s Clothing" or "Western Wear". There is no "Dresses" category: put the product type in query instead.',
    ),
});
const DetailsInput = z.object({
  id: z.string().min(1).max(32).describe('Product id from search results'),
});
const CompareInput = z.object({
  ids: z
    .array(z.string().min(1).max(32))
    .min(2)
    .max(4)
    .describe('2 to 4 product ids from search results'),
});

export interface ProductCard {
  id: string;
  name: string;
  brand: string | null;
  category: string | null;
  priceUsd: number | null;
  imageUrl: string | null;
}

export interface ToolOutcome {
  content: string;
  isError?: boolean;
  products?: ProductCard[]; // shown to the user, never sent to Claude
}

@Injectable()
export class ProductToolsService {
  readonly definitions: Anthropic.Tool[] = [
    toTool(
      'search_products',
      'Semantic search over the product catalog. Returns up to 8 products with id, name, brand, category, ' +
        'priceUsd and similarity (0..1, higher is closer). Search again with a different query or filters if results do not fit.',
      SearchInput,
    ),
    toTool(
      'get_product_details',
      'Full details of one product, including its description.',
      DetailsInput,
    ),
    toTool(
      'compare_products',
      'Side-by-side data for 2-4 products to compare them.',
      CompareInput,
    ),
  ];

  constructor(
    private readonly search: SearchService,
    @Inject(DB) private readonly db: Db,
  ) {}

  async execute(name: string, input: unknown): Promise<ToolOutcome> {
    try {
      switch (name) {
        case 'search_products':
          return await this.searchProducts(SearchInput.parse(input));
        case 'get_product_details':
          return await this.getDetails(DetailsInput.parse(input));
        case 'compare_products':
          return await this.compare(CompareInput.parse(input));
        default:
          return { content: `Unknown tool: ${name}`, isError: true };
      }
    } catch (err) {
      // Invalid input goes back to Claude as an error result so it can correct the call.
      const message =
        err instanceof z.ZodError ? z.prettifyError(err) : String(err);
      return { content: `Tool ${name} failed: ${message}`, isError: true };
    }
  }

  private async searchProducts({
    query,
    maxPrice,
    category,
  }: z.infer<typeof SearchInput>): Promise<ToolOutcome> {
    const hits = await this.search.search({
      query,
      limit: 8,
      maxPriceUsdCents:
        maxPrice === undefined ? undefined : Math.round(maxPrice * 100),
      category,
    });
    const results = hits.map((h) => ({
      id: h.id,
      name: h.name,
      brand: h.brand,
      category: h.category,
      priceUsd: h.priceUsdCents === null ? null : h.priceUsdCents / 100,
      similarity: Number(h.similarity.toFixed(3)),
    }));
    const cards: ProductCard[] = hits.map((h) => ({
      id: h.id,
      name: h.name,
      brand: h.brand,
      category: h.category,
      priceUsd: h.priceUsdCents === null ? null : h.priceUsdCents / 100,
      imageUrl: h.imageUrl,
    }));
    return {
      content: JSON.stringify({ count: results.length, results }),
      products: cards,
    };
  }

  private async getDetails({
    id,
  }: z.infer<typeof DetailsInput>): Promise<ToolOutcome> {
    const [product] = await this.db
      .select(productColumns)
      .from(products)
      .where(eq(products.id, id));
    if (!product) return { content: `No product with id ${id}`, isError: true };
    return { content: JSON.stringify(toPublic(product)) };
  }

  private async compare({
    ids,
  }: z.infer<typeof CompareInput>): Promise<ToolOutcome> {
    const rows = await this.db
      .select(productColumns)
      .from(products)
      .where(inArray(products.id, ids));
    const missing = ids.filter((id) => !rows.some((r) => r.id === id));
    return {
      content: JSON.stringify({ products: rows.map(toPublic), missing }),
    };
  }
}

const productColumns = {
  id: products.id,
  name: products.name,
  brand: products.brand,
  category: products.category,
  description: products.description,
  priceUsdCents: products.priceUsd,
};

function toPublic({
  priceUsdCents,
  ...p
}: { priceUsdCents: number | null } & Record<string, unknown>) {
  return {
    ...p,
    priceUsd: priceUsdCents === null ? null : priceUsdCents / 100,
  };
}

function toTool(
  name: string,
  description: string,
  schema: z.ZodObject,
): Anthropic.Tool {
  // Zod is the single source of truth: the same schema validates input and becomes the JSON Schema Claude sees.
  const { $schema: _ignored, ...inputSchema } = z.toJSONSchema(
    schema,
  ) as Record<string, unknown>;
  return {
    name,
    description,
    input_schema: inputSchema as Anthropic.Tool.InputSchema,
  };
}
