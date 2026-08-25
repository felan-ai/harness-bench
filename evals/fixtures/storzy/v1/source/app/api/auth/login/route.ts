import { NextResponse } from 'next/server'
import { API_TOKEN, validateCredentials } from '@/lib/api-store'

export async function POST(request: Request) {
  let body: { username?: string; password?: string }
  try {
    body = await request.json()
  } catch {
    return NextResponse.json({ error: 'Invalid JSON body' }, { status: 400 })
  }

  const { username, password } = body

  if (!username || !password) {
    return NextResponse.json(
      { error: 'Username and password are required' },
      { status: 400 },
    )
  }

  if (!validateCredentials(username, password)) {
    return NextResponse.json({ error: 'Invalid credentials' }, { status: 401 })
  }

  return NextResponse.json({ token: API_TOKEN, user: username })
}
