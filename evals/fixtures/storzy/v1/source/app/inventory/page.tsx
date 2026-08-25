"use client"

import { useState, useEffect } from "react"
import ProductCard from "@/components/product-card"
import Header from "@/components/header"
import type { Product } from "@/lib/products"

type SortOption = "az" | "za" | "lohi" | "hilo"

export default function InventoryPage() {
  const [currentUser, setCurrentUser] = useState<string | null>(null)
  const [cart, setCart] = useState<{ [key: number]: number }>({})
  const [products, setProducts] = useState<Product[]>([])
  const [sortBy, setSortBy] = useState<SortOption>("az")
  const [showMobileMenu, setShowMobileMenu] = useState(false)

  useEffect(() => {
    const user = localStorage.getItem("currentUser")
    if (!user) {
      window.location.href = "/"
    }
    setCurrentUser(user)

    const savedCart = localStorage.getItem("cart")
    if (savedCart) {
      setCart(JSON.parse(savedCart))
    }

    fetch("/api/products")
      .then((res) => res.json())
      .then((data) => setProducts(data.products))
  }, [])

  const handleAddToCart = (productId: number) => {
    // Bug mode: silent failure - appears to work but doesn't add
    if (process.env.NEXT_PUBLIC_ADD_TO_CART_BUG === 'true') {
      return
    }

    setCart((prev) => {
      const newCart = { ...prev, [productId]: (prev[productId] || 0) + 1 }
      localStorage.setItem("cart", JSON.stringify(newCart))
      return newCart
    })
  }

  const handleRemoveFromCart = (productId: number) => {
    setCart((prev) => {
      const newCart = { ...prev }
      if (newCart[productId] > 1) {
        newCart[productId]--
      } else {
        delete newCart[productId]
      }
      localStorage.setItem("cart", JSON.stringify(newCart))
      return newCart
    })
  }

  const getSortedProducts = () => {
    const sorted = [...products]
    switch (sortBy) {
      case "az":
        return sorted.sort((a, b) => a.name.localeCompare(b.name))
      case "za":
        return sorted.sort((a, b) => b.name.localeCompare(a.name))
      case "lohi":
        return sorted.sort((a, b) => a.price - b.price)
      case "hilo":
        return sorted.sort((a, b) => b.price - a.price)
      default:
        return sorted
    }
  }

  const cartCount = Object.values(cart).reduce((sum, count) => sum + count, 0)

  return (
    <div className="min-h-screen bg-slate-50">
      <Header cartCount={cartCount} currentUser={currentUser} />

      <main className="max-w-7xl mx-auto px-4 py-8">
        <div className="flex flex-col md:flex-row justify-between items-start md:items-center gap-4 mb-8">
          <h2 className="text-2xl font-bold text-slate-900">Products</h2>
          <div className="w-full md:w-auto">
            <label className="block text-sm text-slate-600 mb-2">Sort by:</label>
            <select
              value={sortBy}
              onChange={(e) => setSortBy(e.target.value as SortOption)}
              className="w-full md:w-40 border-2 border-slate-200 rounded px-4 py-2 text-slate-900 bg-white"
            >
              <option value="az">Name (A to Z)</option>
              <option value="za">Name (Z to A)</option>
              <option value="lohi">Price (Low to High)</option>
              <option value="hilo">Price (High to Low)</option>
            </select>
          </div>
        </div>

        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-6">
          {getSortedProducts().map((product) => (
            <ProductCard
              key={product.id}
              product={product}
              quantity={cart[product.id] || 0}
              onAddToCart={() => handleAddToCart(product.id)}
              onRemoveFromCart={() => handleRemoveFromCart(product.id)}
            />
          ))}
        </div>
      </main>
    </div>
  )
}
