"use client"

import { Button } from "@/components/ui/button"
import { ShoppingCart } from "lucide-react"

interface Product {
  id: number
  name: string
  description: string
  price: number
  image: string
}

interface ProductCardProps {
  product: Product
  quantity: number
  onAddToCart: () => void
  onRemoveFromCart: () => void
}

export default function ProductCard({ product, quantity, onAddToCart, onRemoveFromCart }: ProductCardProps) {
  return (
    <div className="bg-white rounded-lg overflow-hidden shadow-sm hover:shadow-md transition">
      <div className="aspect-square bg-slate-100 overflow-hidden">
        <img src={product.image || "/placeholder.svg"} alt={product.name} className="w-full h-full object-cover" />
      </div>
      <div className="p-4">
        <h3 className="font-semibold text-slate-900 line-clamp-2 mb-2">{product.name}</h3>
        <p className="text-sm text-slate-600 line-clamp-3 mb-4">{product.description}</p>
        <div className="flex items-center justify-between gap-2">
          <span className="text-lg font-bold text-slate-900">${product.price.toFixed(2)}</span>
        </div>

        {quantity === 0 ? (
          <Button
            onClick={onAddToCart}
            className="w-full mt-4 bg-primary hover:bg-primary/90 text-white font-semibold py-2 h-auto"
          >
            <ShoppingCart className="w-4 h-4 mr-2" />
            Add to Cart
          </Button>
        ) : (
          <div className="flex items-center gap-2 mt-4">
            <Button
              onClick={onRemoveFromCart}
              className="flex-1 bg-slate-200 hover:bg-slate-300 text-slate-900 font-semibold py-2 h-auto"
            >
              Remove
            </Button>
            <span className="font-semibold text-slate-900 text-center w-8">{quantity}</span>
          </div>
        )}
      </div>
    </div>
  )
}
