import type { ProductCard } from './api/types'

export function ProductTile({ product }: { product: ProductCard }) {
  return (
    <article className="tile">
      {product.imageUrl ? (
        <img
          src={product.imageUrl}
          alt=""
          loading="lazy"
          referrerPolicy="no-referrer"
          onError={(e) => (e.currentTarget.style.visibility = 'hidden')}
        />
      ) : (
        <div className="tile-noimg" />
      )}
      <div className="tile-body">
        <h3 title={product.name}>{product.name}</h3>
        {product.brand && <p className="brand">{product.brand}</p>}
        <p className="price">
          {product.priceUsd !== null ? `$${product.priceUsd.toFixed(2)}` : 'Price n/a'}
        </p>
      </div>
    </article>
  )
}
