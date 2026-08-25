"use client"

import { useEffect, useState } from "react"
import { CheckCircle } from "lucide-react"
import { Button } from "@/components/ui/button"
import Header from "@/components/header"

export default function CheckoutCompletePage() {
  const [currentUser, setCurrentUser] = useState<string | null>(null)

  useEffect(() => {
    const user = localStorage.getItem("currentUser")
    if (!user) {
      window.location.href = "/"
    }
    setCurrentUser(user)
  }, [])

  const handleLogout = () => {
    localStorage.removeItem("currentUser")
    localStorage.removeItem("cart")
    window.location.href = "/"
  }

  return (
    <div className="min-h-screen bg-slate-50">
      <Header cartCount={0} currentUser={currentUser} />

      <main className="max-w-2xl mx-auto px-4 py-16">
        <div className="bg-white rounded-lg p-12 text-center">
          <CheckCircle className="w-16 h-16 text-primary mx-auto mb-6" />
          <h2 className="text-3xl font-bold text-slate-900 mb-2">Thank You For Your Order</h2>
          <p className="text-slate-600 mb-8">Your order has been completed successfully.</p>
          <Button onClick={handleLogout} className="bg-primary hover:bg-primary/90 text-white font-semibold">
            Back Home
          </Button>
        </div>
      </main>
    </div>
  )
}
