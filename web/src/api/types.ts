// Mirrors api/src/chat (ProductCard, AgentEvent).
export interface ProductCard {
  id: string
  name: string
  brand: string | null
  category: string | null
  priceUsd: number | null
  imageUrl: string | null
}

export interface ChatMessage {
  role: 'user' | 'assistant'
  content: string
}

export type AgentEvent =
  | { type: 'tool'; name: string; input: Record<string, unknown> }
  | { type: 'products'; products: ProductCard[] }
  | { type: 'text'; delta: string }
  | { type: 'done'; stopReason: string | null; iterations: number; costUsd: number | null }
  | { type: 'error'; message: string }
