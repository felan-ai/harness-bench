# Storzy

A Next.js 16 e-commerce demo application built with React 19, shadcn/ui, and Tailwind CSS.

## Prerequisites

- Node.js 18.17 or later
- pnpm

## Setup

1. Clone the repository:
   ```bash
   git clone <repository-url>
   cd storzy
   ```

2. Install dependencies:
   ```bash
   pnpm install
   ```

3. Create environment file:
   ```bash
   cp .env.local.example .env.local
   ```
   Or create `.env.local` manually (see Environment Variables below).

## Environment Variables

Create a `.env.local` file in the project root with the following variables:

```env
NEXT_PUBLIC_IMPROVED_CHECKOUT=false
NEXT_PUBLIC_ADD_TO_CART_BUG=false
```

| Variable | Description | Default |
|----------|-------------|---------|
| `NEXT_PUBLIC_IMPROVED_CHECKOUT` | Enables the improved checkout flow | `false` |
| `NEXT_PUBLIC_ADD_TO_CART_BUG` | Enables add-to-cart bug simulation for testing | `false` |

Set any variable to `true` to enable the feature.

## Running Locally

```bash
# Start development server
pnpm dev

# Build for production
pnpm build

# Start production server
pnpm start

# Run linting
pnpm lint
```

The development server runs at [http://localhost:3000](http://localhost:3000).
