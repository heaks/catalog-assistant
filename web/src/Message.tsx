import Markdown from 'react-markdown'
import { ProductTile } from './ProductTile'
import type { UiMessage } from './useChat'

// "**Name** [product:ID]: $9" -> "**Name**: $9". The second regex hides a marker still being streamed ("[product:BBA").
function cleanText(text: string): string {
  return text.replace(/\s*\[product:[A-Za-z0-9]+\]/g, '').replace(/\s*\[[a-z]*:?[A-Za-z0-9]*$/, '')
}

export function Message({ message }: { message: UiMessage }) {
  if (message.role === 'user') return <div className="msg user">{message.content}</div>

  const text = cleanText(message.content)
  const { meta } = message
  return (
    <div className="msg assistant">
      {message.status && (
        <div className="status">
          <span className="dot" />
          {message.status}
        </div>
      )}
      {text && (
        <div className="md">
          <Markdown>{text}</Markdown>
        </div>
      )}
      {message.products && (
        <div className="tiles">
          {message.products.map((p) => (
            <ProductTile key={p.id} product={p} />
          ))}
        </div>
      )}
      {message.error && <div className="error">{message.error}</div>}
      {meta && (
        <div className="meta">
          {meta.iterations} steps · ${meta.costUsd?.toFixed(3) ?? '?'}
        </div>
      )}
    </div>
  )
}
