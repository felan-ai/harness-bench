import { describe, expect, it } from 'vitest';
import { POST as login } from '@/app/api/auth/login/route';
import { GET as products } from '@/app/api/products/route';
import { POST as orders } from '@/app/api/orders/route';
import { GET as orderById, PUT as updateOrder } from '@/app/api/orders/[id]/route';

const token = 'storzy-test-token-2024';
const auth = { Authorization: `Bearer ${token}` };
const json = (body: unknown, headers: Record<string, string> = {}) => new Request('http://localhost/api', {
  method: 'POST',
  headers: { 'content-type': 'application/json', ...headers },
  body: JSON.stringify(body),
});

async function body(response: Response) {
  return response.json() as Promise<Record<string, any>>;
}

describe('Storzy API contract', () => {
  it('authenticates valid credentials and rejects invalid credentials', async () => {
    expect((await login(json({ username: 'test_user', password: 'wrong' }))).status).toBe(401);
    const response = await login(json({ username: 'test_user', password: 'password' }));
    expect(response.status).toBe(200);
    expect(await body(response)).toEqual({ token, user: 'test_user' });
  });

  it('keeps products public and protects order creation', async () => {
    const productResponse = await products(new Request('http://localhost/api/products'));
    expect(productResponse.status).toBe(200);
    expect((await body(productResponse)).products).toHaveLength(6);

    expect((await orders(json({ items: [], customer: { firstName: 'A', lastName: 'B', postalCode: '12345' } }))).status).toBe(401);
    expect((await orders(json({ items: [], customer: { firstName: 'A', lastName: 'B', postalCode: '12345' } }, auth))).status).toBe(400);
  });

  it('creates an order without changing the API total contract and updates its status', async () => {
    const response = await orders(json({
      items: [{ productId: 1, quantity: 2 }, { productId: 3, quantity: 1 }],
      customer: { firstName: 'Ada', lastName: 'Lovelace', postalCode: '12345' },
    }, auth));
    expect(response.status).toBe(201);
    const order = (await body(response)).order;
    expect(order).toMatchObject({
      items: [{ productId: 1, quantity: 2 }, { productId: 3, quantity: 1 }],
      customer: { firstName: 'Ada', lastName: 'Lovelace', postalCode: '12345' },
      total: 69.97,
      status: 'pending',
    });

    const detail = await orderById(new Request('http://localhost/api/orders/' + order.id, { headers: auth }), { params: Promise.resolve({ id: order.id }) });
    expect((await body(detail)).order.id).toBe(order.id);
    const updated = await updateOrder(json({ status: 'confirmed' }, auth), { params: Promise.resolve({ id: order.id }) });
    expect((await body(updated)).order.status).toBe('confirmed');
  });
});
