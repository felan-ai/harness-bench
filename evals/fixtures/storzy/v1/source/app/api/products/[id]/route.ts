import { NextResponse } from 'next/server'
import { getProduct, updateProduct, requireAuth } from '@/lib/api-store'

type Params = { params: Promise<{ id: string }> }

export async function GET(_request: Request, { params }: Params) {
  const { id } = await params
  const numId = Number(id)

  if (isNaN(numId)) {
    return NextResponse.json({ error: `Invalid product id "${id}". Must be a number` }, { status: 400 })
  }

  const product = getProduct(numId)
  if (!product) {
    return NextResponse.json({ error: `Product with id ${id} not found` }, { status: 404 })
  }

  return NextResponse.json({ product })
}

export async function PATCH(request: Request, { params }: Params) {
  const authError = requireAuth(request)
  if (authError) return authError

  const { id } = await params
  const numId = Number(id)

  if (isNaN(numId)) {
    return NextResponse.json({ error: `Invalid product id "${id}". Must be a number` }, { status: 400 })
  }

  let body: { price?: number; description?: string }
  try {
    body = await request.json()
  } catch {
    return NextResponse.json({ error: 'Invalid JSON body' }, { status: 400 })
  }

  if (body.price === undefined && body.description === undefined) {
    return NextResponse.json({ error: 'At least one field (price, description) is required' }, { status: 400 })
  }

  const product = updateProduct(numId, body)
  if (!product) {
    return NextResponse.json({ error: `Product with id ${id} not found` }, { status: 404 })
  }

  return NextResponse.json({ product })
}
