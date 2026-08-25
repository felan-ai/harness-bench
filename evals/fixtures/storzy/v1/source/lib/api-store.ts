import { NextResponse } from 'next/server'
import { type Product, PRODUCTS } from './products'

// --- Types ---

export interface OrderItem {
  productId: number
  quantity: number
}

export interface Order {
  id: string
  items: OrderItem[]
  customer: { firstName: string; lastName: string; postalCode: string }
  total: number
  status: 'pending' | 'confirmed' | 'shipped'
  createdAt: string
}

// --- Auth ---

export const API_TOKEN = 'storzy-test-token-2024'
const VALID_USERNAME = 'test_user'
const VALID_PASSWORD = 'password'

export function requireAuth(request: Request): NextResponse | null {
  const auth = request.headers.get('Authorization')
  if (!auth || !auth.startsWith('Bearer ') || auth.slice(7) !== API_TOKEN) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }
  return null
}

export function validateCredentials(username: string, password: string): boolean {
  return username === VALID_USERNAME && password === VALID_PASSWORD
}

// --- In-memory stores ---

const products: Product[] = structuredClone(PRODUCTS)
const orders = new Map<string, Order>()
let orderCounter = 0

// --- Product operations ---

export function getProducts(): Product[] {
  return products
}

export function getProduct(id: number): Product | undefined {
  return products.find(p => p.id === id)
}

export function updateProduct(id: number, fields: { price?: number; description?: string }): Product | undefined {
  const product = products.find(p => p.id === id)
  if (!product) return undefined
  if (fields.price !== undefined) product.price = fields.price
  if (fields.description !== undefined) product.description = fields.description
  return product
}

// --- Order operations ---

export function getOrders(): Order[] {
  return Array.from(orders.values())
}

export function getOrder(id: string): Order | undefined {
  return orders.get(id)
}

export function createOrder(items: OrderItem[], customer: Order['customer']): Order | { error: string } {
  if (!items || items.length === 0) {
    return { error: 'Items array is required and cannot be empty' }
  }
  if (!customer?.firstName || !customer?.lastName || !customer?.postalCode) {
    return { error: 'Customer firstName, lastName, and postalCode are required' }
  }

  let total = 0
  for (const item of items) {
    const product = getProduct(item.productId)
    if (!product) return { error: `Product with id ${item.productId} not found` }
    if (!item.quantity || item.quantity < 1) return { error: `Invalid quantity for product ${item.productId}` }
    total += product.price * item.quantity
  }

  orderCounter++
  const order: Order = {
    id: `ord_${orderCounter.toString().padStart(4, '0')}`,
    items,
    customer,
    total: Math.round(total * 100) / 100,
    status: 'pending',
    createdAt: new Date().toISOString(),
  }
  orders.set(order.id, order)
  return order
}

export function updateOrderStatus(id: string, status: string): Order | { error: string } | undefined {
  const order = orders.get(id)
  if (!order) return undefined
  if (!['pending', 'confirmed', 'shipped'].includes(status)) {
    return { error: `Invalid status "${status}". Must be one of: pending, confirmed, shipped` }
  }
  order.status = status as Order['status']
  return order
}

export function deleteOrder(id: string): boolean {
  return orders.delete(id)
}
