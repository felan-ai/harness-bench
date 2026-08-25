import { NextResponse } from 'next/server'
import { requireAuth, getOrders, createOrder } from '@/lib/api-store'

export async function GET(request: Request) {
  const authError = requireAuth(request)
  if (authError) return authError

  const orders = getOrders()
  return NextResponse.json({ orders, count: orders.length })
}

export async function POST(request: Request) {
  const authError = requireAuth(request)
  if (authError) return authError

  let body: { items?: { productId: number; quantity: number }[]; customer?: { firstName: string; lastName: string; postalCode: string } }
  try {
    body = await request.json()
  } catch {
    return NextResponse.json({ error: 'Invalid JSON body' }, { status: 400 })
  }

  if (!body.items) {
    return NextResponse.json({ error: 'Items array is required' }, { status: 400 })
  }
  if (!body.customer) {
    return NextResponse.json({ error: 'Customer object is required' }, { status: 400 })
  }

  const result = createOrder(body.items, body.customer)

  if ('error' in result) {
    return NextResponse.json({ error: result.error }, { status: 400 })
  }

  return NextResponse.json({ order: result }, { status: 201 })
}
