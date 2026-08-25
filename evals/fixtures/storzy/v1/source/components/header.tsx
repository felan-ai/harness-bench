"use client"

import { ShoppingCart, Menu, LogOut, X } from "lucide-react"
import { useState } from "react"

interface HeaderProps {
  cartCount: number
  currentUser: string | null
}

export default function Header({ cartCount, currentUser }: HeaderProps) {
  const [showMenu, setShowMenu] = useState(false)

  const handleLogout = () => {
    localStorage.removeItem("currentUser")
    localStorage.removeItem("cart")
    window.location.href = "/"
  }

  return (
    <header className="bg-slate-800 text-white sticky top-0 z-50">
      <div className="max-w-7xl mx-auto px-4 py-4 flex items-center justify-between">
        <div className="flex items-center gap-4">
          <h1 className="text-2xl font-bold">Storzy</h1>
          {currentUser && <span className="text-slate-400 text-sm">({currentUser})</span>}
        </div>

        {currentUser && (
          <>
            <nav className="hidden md:flex items-center gap-8">
              <a href="/inventory" className="hover:text-primary transition">
                Products
              </a>
              <a href="/cart" className="flex items-center gap-2 hover:text-primary transition">
                <ShoppingCart className="w-5 h-5" />
                <span>{cartCount}</span>
              </a>
              <button onClick={handleLogout} className="flex items-center gap-2 hover:text-primary transition">
                <LogOut className="w-5 h-5" />
                Logout
              </button>
            </nav>

            <button onClick={() => setShowMenu(!showMenu)} className="md:hidden p-2 hover:bg-slate-700 rounded">
              {showMenu ? <X className="w-6 h-6" /> : <Menu className="w-6 h-6" />}
            </button>
          </>
        )}
      </div>

      {showMenu && currentUser && (
        <div className="md:hidden border-t border-slate-700">
          <nav className="flex flex-col p-4 gap-4">
            <a href="/inventory" className="hover:text-primary transition">
              Products
            </a>
            <a href="/cart" className="flex items-center gap-2 hover:text-primary transition">
              <ShoppingCart className="w-5 h-5" />
              <span>Cart ({cartCount})</span>
            </a>
            <button
              onClick={handleLogout}
              className="flex items-center gap-2 hover:text-primary transition text-left"
            >
              <LogOut className="w-5 h-5" />
              Logout
            </button>
          </nav>
        </div>
      )}
    </header>
  )
}
