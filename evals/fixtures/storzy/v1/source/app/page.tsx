"use client"

import type React from "react"

import { useState } from "react"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { AlertCircle } from "lucide-react"

const VALID_USERS = ["test_user"]
const VALID_PASSWORD = "password"

export default function LoginPage() {
  const [username, setUsername] = useState("")
  const [password, setPassword] = useState("")
  const [errors, setErrors] = useState<{ username?: string; password?: string }>({})
  const [isLoading, setIsLoading] = useState(false)

  const handleLogin = async (e: React.FormEvent) => {
    e.preventDefault()
    setErrors({})
    setIsLoading(true)

    // Simulate network delay
    await new Promise((resolve) => setTimeout(resolve, 500))

    const newErrors: typeof errors = {}

    if (!username) {
      newErrors.username = "Username is required"
    } else if (!VALID_USERS.includes(username)) {
      newErrors.username = "Invalid username"
    }

    if (!password) {
      newErrors.password = "Password is required"
    } else if (password !== VALID_PASSWORD) {
      newErrors.password = "Invalid password"
    }


    if (Object.keys(newErrors).length > 0) {
      setErrors(newErrors)
      setIsLoading(false)
      return
    }

    // Successful login - redirect to products
    localStorage.setItem("currentUser", username)
    window.location.href = "/inventory"
  }

  return (
    <div className="min-h-screen bg-slate-50 flex flex-col items-center justify-center p-4">
      <div className="w-full max-w-md">
        <h1 className="text-4xl font-bold text-center mb-12 text-slate-900">Storzy</h1>

        <div className="bg-white rounded-lg shadow-sm p-8 mb-8">
          <form onSubmit={handleLogin} className="space-y-6">
            <div>
              <label className="block text-sm text-slate-600 mb-2">Username</label>
              <div className="relative">
                <Input
                  type="text"
                  value={username}
                  onChange={(e) => setUsername(e.target.value)}
                  placeholder="Username"
                  className={`w-full border-2 ${errors.username ? "border-red-500" : "border-slate-200"}`}
                  disabled={isLoading}
                />
                {errors.username && <AlertCircle className="absolute right-3 top-3 w-5 h-5 text-red-500" />}
              </div>
            </div>

            <div>
              <label className="block text-sm text-slate-600 mb-2">Password</label>
              <div className="relative">
                <Input
                  type="password"
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  placeholder="Password"
                  className={`w-full border-2 ${errors.password ? "border-red-500" : "border-slate-200"}`}
                  disabled={isLoading}
                />
                {errors.password && <AlertCircle className="absolute right-3 top-3 w-5 h-5 text-red-500" />}
              </div>
            </div>

            {(errors.username || errors.password) && (
              <div className="bg-red-600 text-white p-3 rounded text-sm">{errors.username || errors.password}</div>
            )}

            <Button
              type="submit"
              className="w-full bg-primary hover:bg-primary/90 text-white font-semibold py-3 h-auto"
              disabled={isLoading}
            >
              {isLoading ? "Logging in..." : "Login"}
            </Button>
          </form>
        </div>

        <div className="bg-slate-800 text-white rounded-lg p-8">
          <div className="grid grid-cols-2 gap-8">
            <div>
              <h3 className="font-mono font-bold mb-3">Username:</h3>
              <p className="font-mono text-sm">test_user</p>
            </div>
            <div>
              <h3 className="font-mono font-bold mb-3">Password:</h3>
              <p className="font-mono text-sm">password</p>
            </div>
          </div>
        </div>
      </div>
    </div>
  )
}
