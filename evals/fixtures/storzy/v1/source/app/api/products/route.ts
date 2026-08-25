import { NextResponse } from 'next/server'
import { getProducts } from '@/lib/api-store'

const VALID_SORTS = ['price_asc', 'price_desc', 'name_asc', 'name_desc'] as const

export async function GET(request: Request) {
  const { searchParams } = new URL(request.url)
  const sort = searchParams.get('sort')

  let products = getProducts()

  if (sort) {
    if (!VALID_SORTS.includes(sort as (typeof VALID_SORTS)[number])) {
      return NextResponse.json(
        { error: `Invalid sort value "${sort}". Must be one of: ${VALID_SORTS.join(', ')}` },
        { status: 400 },
      )
    }

    products = [...products].sort((a, b) => {
      switch (sort) {
        case 'price_asc': return a.price - b.price
        case 'price_desc': return b.price - a.price
        case 'name_asc': return a.name.localeCompare(b.name)
        case 'name_desc': return b.name.localeCompare(a.name)
        default: return 0
      }
    })
  }

  return NextResponse.json({ products, count: products.length })
}
