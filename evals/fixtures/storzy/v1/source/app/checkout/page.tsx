"use client"

import type React from "react"

import { useState, useEffect } from "react"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import Header from "@/components/header"
import { PRODUCTS } from "@/lib/products"

export default function CheckoutPage() {
  const [currentUser, setCurrentUser] = useState<string | null>(null)
  const [cart, setCart] = useState<{ [key: number]: number }>({})
  const [firstName, setFirstName] = useState("")
  const [lastName, setLastName] = useState("")
  const [postalCode, setPostalCode] = useState("")
  const [errors, setErrors] = useState<{ [key: string]: string }>({})
  const [isLoading, setIsLoading] = useState(false)
  const [country, setCountry] = useState("")
  const [shippingMethod, setShippingMethod] = useState("")

  const isImprovedCheckout = process.env.NEXT_PUBLIC_IMPROVED_CHECKOUT === 'true'

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

  const handleCheckout = async (e: React.FormEvent) => {
    e.preventDefault()
    setErrors({})
    const newErrors: { [key: string]: string } = {}

    if (!firstName) newErrors.firstName = "First Name is required"
    if (!lastName) newErrors.lastName = "Last Name is required"
    if (!postalCode) newErrors.postalCode = "Postal Code is required"

    if (isImprovedCheckout) {
      if (!country) newErrors.country = "Country is required"
      if (!shippingMethod) newErrors.shippingMethod = "Shipping method is required"
    }

    if (Object.keys(newErrors).length > 0) {
      setErrors(newErrors)
      return
    }

    setIsLoading(true)
    await new Promise((resolve) => setTimeout(resolve, 1000))

    // Complete checkout
    localStorage.removeItem("cart")
    window.location.href = "/checkout-complete"
  }

  const cartItems = Object.entries(cart)
    .map(([id, quantity]) => ({
      product: PRODUCTS.find((p) => p.id === Number.parseInt(id)),
      quantity,
    }))
    .filter((item) => item.product)

  const subtotal = cartItems.reduce((sum, item) => sum + item.product!.price * item.quantity, 0)
  const tax = subtotal * 0.08
  const total = subtotal + tax
  const cartCount = Object.values(cart).reduce((sum, count) => sum + count, 0)

  return (
    <div className="min-h-screen bg-slate-50">
      <Header cartCount={cartCount} currentUser={currentUser} />

      <main className="max-w-4xl mx-auto px-4 py-8">
        <h2 className="text-3xl font-bold text-slate-900 mb-8">Checkout: Your Information</h2>

        <div className="grid md:grid-cols-3 gap-8">
          <div className="md:col-span-2 bg-white rounded-lg p-8">
            {isImprovedCheckout ? (
              <form onSubmit={handleCheckout} className="checkout-form-v2 flex flex-col gap-8">
                <div className="checkout-fields-grid grid md:grid-cols-3 gap-6">
                  <div className="field-v2">
                    <label className="checkout-label block text-sm font-medium text-slate-900 mb-2">First Name</label>
                    <Input
                      type="text"
                      value={firstName}
                      onChange={(e) => setFirstName(e.target.value)}
                      className={`checkout-input w-full border-2 ${errors.firstName ? "border-red-500" : "border-slate-200"}`}
                      disabled={isLoading}
                    />
                    {errors.firstName && <p className="text-red-600 text-sm mt-1">{errors.firstName}</p>}
                  </div>
                  <div className="field-v2">
                    <label className="checkout-label block text-sm font-medium text-slate-900 mb-2">Last Name</label>
                    <Input
                      type="text"
                      value={lastName}
                      onChange={(e) => setLastName(e.target.value)}
                      className={`checkout-input w-full border-2 ${errors.lastName ? "border-red-500" : "border-slate-200"}`}
                      disabled={isLoading}
                    />
                    {errors.lastName && <p className="text-red-600 text-sm mt-1">{errors.lastName}</p>}
                  </div>
                  <div className="field-v2">
                    <label className="checkout-label block text-sm font-medium text-slate-900 mb-2">Postal Code</label>
                    <Input
                      type="text"
                      value={postalCode}
                      onChange={(e) => setPostalCode(e.target.value)}
                      className={`checkout-input w-full border-2 ${errors.postalCode ? "border-red-500" : "border-slate-200"}`}
                      disabled={isLoading}
                    />
                    {errors.postalCode && <p className="text-red-600 text-sm mt-1">{errors.postalCode}</p>}
                  </div>
                </div>

                <div className="country-field-wrapper">
                  <label className="checkout-label block text-sm font-medium text-slate-900 mb-2">Country</label>
                  <select
                    value={country}
                    onChange={(e) => setCountry(e.target.value)}
                    className={`checkout-select w-full border-2 rounded px-4 py-2 ${errors.country ? "border-red-500" : "border-slate-200"}`}
                    disabled={isLoading}
                  >
                    <option value="">Select Country</option>
                    <option value="us">United States</option>
                    <option value="ca">Canada</option>
                    <option value="uk">United Kingdom</option>
                    <option value="de">Germany</option>
                    <option value="fr">France</option>
                  </select>
                  {errors.country && <p className="text-red-600 text-sm mt-1">{errors.country}</p>}
                </div>

                <div className="shipping-method-wrapper">
                  <label className="checkout-label block text-sm font-medium text-slate-900 mb-2">Shipping Method</label>
                  <div className="shipping-options space-y-2">
                    <label className="shipping-option flex items-center gap-2 p-3 border rounded cursor-pointer hover:bg-slate-50">
                      <input
                        type="radio"
                        name="shippingMethod"
                        value="standard"
                        checked={shippingMethod === 'standard'}
                        onChange={(e) => setShippingMethod(e.target.value)}
                        disabled={isLoading}
                      />
                      <span>Standard Shipping (5-7 days) - Free</span>
                    </label>
                    <label className="shipping-option flex items-center gap-2 p-3 border rounded cursor-pointer hover:bg-slate-50">
                      <input
                        type="radio"
                        name="shippingMethod"
                        value="express"
                        checked={shippingMethod === 'express'}
                        onChange={(e) => setShippingMethod(e.target.value)}
                        disabled={isLoading}
                      />
                      <span>Express Shipping (2-3 days) - $9.99</span>
                    </label>
                    <label className="shipping-option flex items-center gap-2 p-3 border rounded cursor-pointer hover:bg-slate-50">
                      <input
                        type="radio"
                        name="shippingMethod"
                        value="overnight"
                        checked={shippingMethod === 'overnight'}
                        onChange={(e) => setShippingMethod(e.target.value)}
                        disabled={isLoading}
                      />
                      <span>Overnight Shipping (1 day) - $19.99</span>
                    </label>
                  </div>
                  {errors.shippingMethod && <p className="text-red-600 text-sm mt-1">{errors.shippingMethod}</p>}
                </div>

                <div className="checkout-actions flex flex-row-reverse gap-6 pt-8 border-t">
                  <Button
                    type="submit"
                    className="flex-1 bg-primary hover:bg-primary/90 text-white font-semibold"
                    disabled={isLoading}
                  >
                    {isLoading ? "Processing..." : "Continue"}
                  </Button>
                  <Button
                    type="button"
                    onClick={() => (window.location.href = "/cart")}
                    className="flex-1 bg-slate-300 hover:bg-slate-400 text-slate-900 font-semibold"
                    disabled={isLoading}
                  >
                    Cancel
                  </Button>
                </div>
              </form>
            ) : (
              <form onSubmit={handleCheckout} className="space-y-6">
                <div className="grid md:grid-cols-2 gap-4">
                  <div>
                    <label className="block text-sm font-medium text-slate-900 mb-2">First Name</label>
                    <Input
                      type="text"
                      value={firstName}
                      onChange={(e) => setFirstName(e.target.value)}
                      className={`w-full border-2 ${errors.firstName ? "border-red-500" : "border-slate-200"}`}
                      disabled={isLoading}
                    />
                    {errors.firstName && <p className="text-red-600 text-sm mt-1">{errors.firstName}</p>}
                  </div>
                  <div>
                    <label className="block text-sm font-medium text-slate-900 mb-2">Last Name</label>
                    <Input
                      type="text"
                      value={lastName}
                      onChange={(e) => setLastName(e.target.value)}
                      className={`w-full border-2 ${errors.lastName ? "border-red-500" : "border-slate-200"}`}
                      disabled={isLoading}
                    />
                    {errors.lastName && <p className="text-red-600 text-sm mt-1">{errors.lastName}</p>}
                  </div>
                </div>

                <div>
                  <label className="block text-sm font-medium text-slate-900 mb-2">Postal Code</label>
                  <Input
                    type="text"
                    value={postalCode}
                    onChange={(e) => setPostalCode(e.target.value)}
                    className={`w-full border-2 ${errors.postalCode ? "border-red-500" : "border-slate-200"}`}
                    disabled={isLoading}
                  />
                  {errors.postalCode && <p className="text-red-600 text-sm mt-1">{errors.postalCode}</p>}
                </div>

                <div className="flex gap-4 pt-6">
                  <Button
                    type="button"
                    onClick={() => (window.location.href = "/cart")}
                    className="flex-1 bg-slate-300 hover:bg-slate-400 text-slate-900 font-semibold"
                    disabled={isLoading}
                  >
                    Cancel
                  </Button>
                  <Button
                    type="submit"
                    className="flex-1 bg-primary hover:bg-primary/90 text-white font-semibold"
                    disabled={isLoading}
                  >
                    {isLoading ? "Processing..." : "Continue"}
                  </Button>
                </div>
              </form>
            )}
          </div>

          <div className="bg-white rounded-lg p-6 h-fit">
            <h3 className="text-lg font-semibold text-slate-900 mb-4">Order Summary</h3>
            <div className="space-y-2 mb-6 max-h-64 overflow-y-auto">
              {cartItems.map((item) => (
                <div key={item.product!.id} className="text-sm text-slate-600">
                  <div className="flex justify-between">
                    <span>
                      {item.product!.name} x {item.quantity}
                    </span>
                    <span>${(item.product!.price * item.quantity).toFixed(2)}</span>
                  </div>
                </div>
              ))}
            </div>
            <div className="border-t border-slate-200 pt-4 space-y-2">
              <div className="flex justify-between text-slate-600">
                <span>Subtotal:</span>
                <span>${subtotal.toFixed(2)}</span>
              </div>
              <div className="flex justify-between text-slate-600">
                <span>Tax:</span>
                <span>${tax.toFixed(2)}</span>
              </div>
              <div className="flex justify-between font-semibold text-slate-900 pt-2 border-t border-slate-200">
                <span>Total:</span>
                <span>${total.toFixed(2)}</span>
              </div>
            </div>
          </div>
        </div>
      </main>
    </div>
  )
}
