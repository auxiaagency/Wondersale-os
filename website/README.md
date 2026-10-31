# Wondersale E-Commerce Storefront

A production-grade, mobile-first e-commerce web platform for **Wondersale** — retail superstore in Bhopal, Madhya Pradesh, selling across India.

Categories:

- Home & Kitchen Appliances
- Electronics
- Toys & Games
- Packaged Food & Snacks
- Clocks & Timepieces
- Sunglasses & Accessories
- Crockery & Kitchenware

---

## Technical Stack

- **Framework**: Next.js 16 (App Router) + React 19 + TypeScript (Strict)
- **Styling**: Tailwind CSS + Stitch Design System Tokens
- **Database**: PostgreSQL + Prisma ORM (Integer paise currency)
- **Validation**: Zod (Client & Server)
- **Payments**: Razorpay (UPI, Cards, Netbanking, COD)
- **Testing**: Vitest (Unit/API) + Playwright (E2E)
- **Storage**: S3-compatible object storage (MinIO / AWS S3)

---

## Getting Started

### Prerequisites

- Node.js 22.x or higher
- npm 10.x or higher

### Environment Setup

Copy the environment template:

```bash
cp .env.example .env
```

### Installation

```bash
npm install
```

### Available Scripts

- `npm run dev` - Start local development server on port 3000
- `npm run build` - Create optimized production build
- `npm run start` - Start production server
- `npm run lint` - Run ESLint code checks
- `npm run type-check` - Run TypeScript compiler checks
- `npm run test` - Run Vitest unit & API tests
- `npm run format:check` - Check code formatting with Prettier
- `npm run format` - Auto-format files with Prettier
- `npm run audit:prod` - Check production dependencies for security advisories

---

## Documentation

- [Progress Tracker](docs/PROGRESS.md)
- [Architecture & Decisions](docs/DECISIONS.md)
- [Open Questions](docs/OPEN_QUESTIONS.md)
