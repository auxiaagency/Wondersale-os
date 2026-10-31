# Technical Architecture & Engineering Decisions

## DECISION-001: Technology Stack Confirmation

- **Status**: Approved
- **Context**: Wondersale needs a high-performance, mobile-first storefront for retail in Bhopal and pan-India shipping, with SSR for SEO and fast catalog browsing.
- **Decision**:
  - **Framework**: Next.js 16 (App Router) with TypeScript in strict mode.
  - **Styling**: Tailwind CSS mapped to Stitch design tokens.
  - **Testing**: Vitest for unit & API integration testing; Playwright for mobile-first e2e testing.
  - **Data Layer**: PostgreSQL with Prisma ORM (integer paise for monetary values).
  - **Service Layer**: Adapter/interface pattern for catalog and stock isolation, enabling pluggable synchronization with the separate Wondersale ERP/inventory management system.
  - **Validation**: Zod schema validation across client and server boundaries.
  - **Payments**: Razorpay with server-side HMAC-SHA256 signature verification and idempotent webhook processing.
  - **Auth**: Mobile OTP-first with provider-agnostic SMS adapter (Console provider for local dev; MSG91/Twilio for production) and httpOnly secure session cookies.

## DECISION-002: Monies Represented in Integer Paise

- **Status**: Approved
- **Context**: Floating-point rounding errors in currency and tax computations cause reconciliations to fail.
- **Decision**: All prices, MRPs, discounts, GST, and totals are strictly stored and computed as integer paise (1 INR = 100 paise). Display formatting uses standard Indian numbering (`₹12,499.00`).

## DECISION-003: UI Governance with Stitch MCP

- **Status**: Approved
- **Context**: Visual fidelity and consistency across devices must remain strictly aligned with the design system.
- **Decision**: All visuals, screens, components, and responsive variants are designed and generated in Stitch MCP, then fetched and converted into reusable React primitives without hand-crafting visual deviations in code.

## DECISION-004: Clean Decoupling for Catalog & Inventory System

- **Status**: Approved
- **Context**: A separate Wondersale business and inventory management system is in active development.
- **Decision**: The storefront catalog and stock operations run through abstract repository interfaces (`ICatalogService`, `IInventoryService`). While the storefront DB serves as the local source of truth, replacing the adapter with the external ERP requires zero UI or routing rewrites.
