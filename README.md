# Coffee Cherry Intake & Farmer Management System

Digital system that supplements the paper receipt process at a coffee-cherry buying
station: clerks record intake (farmer, weight, receipt number, a photo of the paper
receipt) which builds a permanent farmer database, sends an SMS confirmation, and gives
each farmer a page showing their cumulative cherry weight delivered over time.

Built to be reusable across multiple factories/cooperatives (multi-tenant from the
ground up) and to work offline in the field, syncing once connectivity returns.

## Structure

```
apps/
  api/      Node.js + Express + Prisma (PostgreSQL) REST API
  web/      React + Vite web app: staff portal (clerks/admins) + farmer self-service portal
  mobile/   Expo (React Native) app for clerks: offline-first receipt recording w/ camera
packages/
  shared/   Shared TypeScript types, validation schemas, and API client
```

## Prerequisites

- Node.js 20+, `pnpm` (`npm install -g pnpm`)
- Docker (for local PostgreSQL) — or point `DATABASE_URL` at any Postgres you already have
- Expo Go app on your phone (for testing the mobile app quickly), or Android
  Studio/Xcode for emulators

## 1. Install dependencies

```bash
pnpm install
```

## 2. Start PostgreSQL and configure the API

```bash
docker compose up -d
cp apps/api/.env.example apps/api/.env
```

Edit `apps/api/.env` if needed. In development, leaving `AFRICASTALKING_*` and `S3_*`
blank is fine — SMS messages print to the API's console instead of sending for real,
and receipt photos are saved to `apps/api/uploads` and served from the API itself.

Run migrations and seed a demo organization:

```bash
pnpm --filter @coffee/api prisma:migrate
pnpm seed
```

This creates organization `demo-factory` with:
- Admin login: `+254700000001` / `changeme123`
- Clerk login: `+254700000002` / `changeme123`
- Two demo farmers you can record receipts against

Start the API:

```bash
pnpm dev:api
```

It listens on `http://localhost:4000`.

## 3. Run the web app

```bash
cp apps/web/.env.example apps/web/.env
pnpm dev:web
```

Open `http://localhost:5173`:
- `/login` — staff portal (clerk/admin)
- `/me/login` — farmer self-service portal (phone + SMS OTP; in dev the code is
  printed in the API's terminal output instead of actually being texted)

## 4. Run the mobile app

```bash
pnpm dev:mobile
```

Scan the QR code with Expo Go. Set `EXPO_PUBLIC_API_URL` to your machine's LAN IP (not
`localhost`) so a physical device can reach the API, e.g.:

```bash
EXPO_PUBLIC_API_URL=http://192.168.1.20:4000 pnpm dev:mobile
```

Try the offline flow: turn on airplane mode, record a receipt (it saves locally with a
"pending" badge), then reconnect — it syncs automatically within ~30 seconds, or tap
the sync badge to force it immediately.

## Onboarding a new factory/cooperative

The system is multi-tenant: each factory is an `Organization` with its own staff,
farmers, and receipts, fully isolated from other organizations. To provision a new one:

```bash
curl -X POST http://localhost:4000/orgs \
  -H "Content-Type: application/json" \
  -H "x-provisioning-secret: <ORG_PROVISIONING_SECRET from apps/api/.env>" \
  -d '{
    "name": "Kiambu Cooperative",
    "slug": "kiambu-coop",
    "smsSenderName": "KiambuCoop",
    "adminName": "Jane Admin",
    "adminPhone": "+254700000099",
    "adminPassword": "a-strong-password"
  }'
```

Point that factory's web/mobile deployment at the new `slug` (`VITE_ORGANIZATION_SLUG`
/ `EXPO_PUBLIC_ORGANIZATION_SLUG`) and give the admin their login.

## Going to production

Not included here, since only you can provision these:

- **Africa's Talking**: create an account, get `AFRICASTALKING_USERNAME` /
  `AFRICASTALKING_API_KEY`, and register a sender ID/shortcode for SMS.
- **Object storage**: an S3 bucket (AWS S3, or any S3-compatible service like
  Cloudflare R2/MinIO) for `S3_*` env vars, so receipt photos survive server restarts
  and scale past local disk.
- **Hosting**: the API + Postgres can run on any VPS/cloud provider; the web app is a
  static build (`pnpm build`) deployable to any static host.
- **App store builds**: `apps/mobile` is a complete Expo app; producing signed
  installable builds requires your own Apple Developer and Google Play accounts, then
  `eas build` (see [Expo's EAS Build docs](https://docs.expo.dev/build/introduction/)).
