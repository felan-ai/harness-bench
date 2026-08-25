"use client"

import { useState, useEffect } from "react"
import { Trash2 } from "lucide-react"
import { Button } from "@/components/ui/button"
import Header from "@/components/header"
import { PRODUCTS } from "@/lib/products"

export default function CartPage() {
  const [currentUser, setCurrentUser] = useState<string | null>(null)
  const [cart, setCart] = useState<{ [key: number]: number }>({})

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
  }, [])

  const handleRemoveFromCart = (productId: number) => {
    setCart((prev) => {
      const newCart = { ...prev }
      delete newCart[productId]
      localStorage.setItem("cart", JSON.stringify(newCart))
      return newCart
    })
  }

  const handleUpdateQuantity = (productId: number, quantity: number) => {
    setCart((prev) => {
      const newCart = { ...prev }
      if (quantity <= 0) {
        delete newCart[productId]
      } else {
        newCart[productId] = quantity
      }
      localStorage.setItem("cart", JSON.stringify(newCart))
      return newCart
    })
  }

  const cartCount = Object.values(cart).reduce((sum, count) => sum + count, 0)
  const cartItems = Object.entries(cart)
    .map(([id, quantity]) => ({
      product: PRODUCTS.find((p) => p.id === Number.parseInt(id)),
      quantity,
    }))
    .filter((item) => item.product)

  const subtotal = cartItems.reduce((sum, item) => sum + item.product!.price * item.quantity, 0)
  const tax = subtotal * 0.08
  const total = subtotal + tax

  return (
    <div className="min-h-screen bg-slate-50">
      <Header cartCount={cartCount} currentUser={currentUser} />

      <main className="max-w-4xl mx-auto px-4 py-8">
        <h2 className="text-3xl font-bold text-slate-900 mb-8">Your Cart</h2>

        {cartItems.length === 0 ? (
          <div className="text-center py-12">
            <p className="text-slate-600 text-lg">Your cart is empty</p>
            <Button
              onClick={() => (window.location.href = "/inventory")}
              className="mt-4 bg-primary hover:bg-primary/90 text-white"
            >
              Continue Shopping
            </Button>
          </div>
        ) : (
          <div className="grid md:grid-cols-3 gap-8">
            <div className="md:col-span-2 space-y-4">
              {cartItems.map((item) => (
                <div key={item.product!.id} className="bg-white rounded-lg p-6 flex gap-4">
                  <img
                    src={item.product!.image || "/placeholder.svg"}
                    alt={item.product!.name}
                    className="w-24 h-24 object-cover rounded"
                  />
                  <div className="flex-1">
                    <h3 className="font-semibold text-slate-900">{item.product!.name}</h3>
                    <p className="text-slate-600 text-sm">${item.product!.price.toFixed(2)}</p>
                    <div className="flex items-center gap-2 mt-4">
                      <button
                        onClick={() => handleUpdateQuantity(item.product!.id, item.quantity - 1)}
                        className="px-2 py-1 border border-slate-300 rounded"
                      >
                        -
                      </button>
                      <span className="w-8 text-center">{item.quantity}</span>
                      <button
                        onClick={() => handleUpdateQuantity(item.product!.id, item.quantity + 1)}
                        className="px-2 py-1 border border-slate-300 rounded"
                      >
                        +
                      </button>
                      <button
                        onClick={() => handleRemoveFromCart(item.product!.id)}
                        className="ml-auto text-red-600 hover:text-red-700"
                      >
                        <Trash2 className="w-5 h-5" />
                      </button>
                    </div>
                  </div>
                  <div className="text-right">
                    <p className="font-semibold text-slate-900">${(item.product!.price * item.quantity).toFixed(2)}</p>
                  </div>
                </div>
              ))}
            </div>

            <div className="bg-white rounded-lg p-6 h-fit">
              <h3 className="text-lg font-semibold text-slate-900 mb-4">Order Summary</h3>
              <div className="space-y-3 mb-6">
                <div className="flex justify-between text-slate-600">
                  <span>Subtotal:</span>
                  <span>${subtotal.toFixed(2)}</span>
                </div>
                <div className="flex justify-between text-slate-600">
                  <span>Tax:</span>
                  <span>${tax.toFixed(2)}</span>
                </div>
                <div className="border-t border-slate-200 pt-3 flex justify-between font-semibold text-slate-900">
                  <span>Total:</span>
                  <span>${total.toFixed(2)}</span>
                </div>
              </div>
              <Button
                onClick={() => (window.location.href = "/checkout")}
                className="w-full bg-primary hover:bg-primary/90 text-white font-semibold"
              >
                Proceed to Checkout
              </Button>
            </div>
          </div>
        )}
      </main>
    </div>
  )
}
