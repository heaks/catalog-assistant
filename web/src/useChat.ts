import { useCallback, useEffect, useRef, useState } from 'react'
import { ChatHttpError, streamChat } from './api/chat'
import type { AgentEvent, ChatMessage, ProductCard } from './api/types'

export interface UiMessage extends ChatMessage {
  status?: string // what the agent is doing right now
  products?: ProductCard[]
  error?: string
  meta?: { iterations: number; costUsd: number | null }
}

function toolLabel(e: Extract<AgentEvent, { type: 'tool' }>): string {
  if (e.name === 'search_products') return `Searching for “${String(e.input.query ?? '')}”…`
  if (e.name === 'compare_products') return 'Comparing products…'
  return 'Checking product details…'
}

export function useChat() {
  const [messages, setMessages] = useState<UiMessage[]>([])
  const [streaming, setStreaming] = useState(false)
  const abortRef = useRef<AbortController | null>(null)

  // Leaving the page mid-answer cancels the request (and the paid Claude call on the server).
  useEffect(() => () => abortRef.current?.abort(), [])

  // Immutable update of the last (assistant) message.
  const patchLast = (fn: (m: UiMessage) => UiMessage) =>
    setMessages((prev) => [...prev.slice(0, -1), fn(prev[prev.length - 1])])

  const send = useCallback(
    async (text: string) => {
      if (streaming || !text.trim()) return
      // Only finished turns go to the API; failed answers are dropped from history.
      const userMessage: ChatMessage = { role: 'user', content: text.trim() }
      // Payload for the API: finished turns only, without UI fields; failed answers are skipped.
      const history: ChatMessage[] = [
        ...messages
          .filter((m) => !m.error && m.content)
          .map(({ role, content }) => ({ role, content })),
        userMessage,
      ]
      // UI state keeps everything (cards, errors) and only appends.
      setMessages((prev) => [...prev, userMessage, { role: 'assistant', content: '', status: 'Thinking…' }])
      setStreaming(true)
      const abort = new AbortController()
      abortRef.current = abort

      try {
        for await (const e of streamChat(history, abort.signal)) {
          switch (e.type) {
            case 'text':
              // The answer has started: drop the status line.
              patchLast((m) => ({ ...m, content: m.content + e.delta, status: undefined }))
              break
            case 'tool':
              // Text written before a tool call is the model narrating its plan: show it as status, not as the answer.
              patchLast((m) => ({ ...m, content: '', status: toolLabel(e) }))
              break
            case 'products':
              patchLast((m) => ({ ...m, products: e.products }))
              break
            case 'done':
              patchLast((m) => ({ ...m, status: undefined, meta: { iterations: e.iterations, costUsd: e.costUsd } }))
              break
            case 'error':
              patchLast((m) => ({ ...m, status: undefined, error: e.message }))
              break
          }
        }
      } catch (err) {
        if (abort.signal.aborted) {
          patchLast((m) => ({ ...m, status: undefined, error: m.content ? undefined : 'Stopped.' }))
        } else {
          const message =
            err instanceof ChatHttpError && err.status === 429
              ? `Too many requests. Try again in ${err.retryAfterSec ?? 60} s.`
              : 'Something went wrong. Please try again.'
          patchLast((m) => ({ ...m, status: undefined, error: message }))
        }
      } finally {
        setStreaming(false)
        abortRef.current = null
      }
    },
    [messages, streaming],
  )

  const stop = useCallback(() => abortRef.current?.abort(), [])

  return { messages, streaming, send, stop }
}
