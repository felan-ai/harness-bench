import { NextResponse } from 'next/server'
import { requireAuth, getOrder, updateOrderStatus, deleteOrder } from '@/lib/api-store'

type Params = { params: Promise<{ id: string }> }

export async function GET(request: Request, { params }: Params) {
  const authError = requireAuth(request)
  if (authError) return authError

  const { id } = await params
  const order = getOrder(id)
  if (!order) {
    return NextResponse.json({ error: `Order with id "${id}" not found` }, { status: 404 })
  }

  return NextResponse.json({ order })
}

export async function PUT(request: Request, { params }: Params) {
  const authError = requireAuth(request)
  if (authError) return authError

  const { id } = await params

  let body: { status?: string }
  try {
    body = await request.json()
  } catch {
    return NextResponse.json({ error: 'Invalid JSON body' }, { status: 400 })
  }

  if (!body.status) {
    return NextResponse.json({ error: 'Status field is required' }, { status: 400 })
  }

  const result = updateOrderStatus(id, body.status)
  if (result === undefined) {
    return NextResponse.json({ error: `Order with id "${id}" not found` }, { status: 404 })
  }
  if ('error' in result) {
    return NextResponse.json({ error: result.error }, { status: 400 })
  }

  return NextResponse.json({ order: result })
}

export async function DELETE(request: Request, { params }: Params) {
  const authError = requireAuth(request)
  if (authError) return authError

  const { id } = await params
  const deleted = deleteOrder(id)
  if (!deleted) {
    return NextResponse.json({ error: `Order with id "${id}" not found` }, { status: 404 })
  }

  return NextResponse.json({ message: `Order ${id} deleted` })
}
