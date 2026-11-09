# SpendWise Mobile (employee app)

React Native (Expo SDK 58, TypeScript strict) app for employees: submit expenses with receipts, track approvals, see limits, cards, transactions and notifications. Every screen calls the real SpendWise REST API (`apps/api`).

`apps/mobile` is intentionally **not** an npm workspace; it has its own `node_modules`.

## Setup

```bash
cd apps/mobile
npm install
cp .env.example .env        # optional; defaults to http://localhost:3000/api
```

Make sure the API is running (`http://localhost:3000/api`, Swagger at `/api/docs`).

### API URL (`EXPO_PUBLIC_API_URL`)

| Where the app runs | Value |
| --- | --- |
| iOS simulator / Expo web | `http://localhost:3000/api` (default) |
| Android emulator | `http://10.0.2.2:3000/api` |
| Physical phone (Expo Go) | `http://<your computer's LAN IP>:3000/api` |

Restart `expo start` after changing it (`expo start -c` to clear the cache).

## Run

```bash
npm start          # Expo dev server; scan the QR with Expo Go (iOS/Android)
npm run ios        # iOS simulator (needs Xcode)
npm run android    # Android emulator (needs Android Studio; use the 10.0.2.2 URL)
```

Camera and gallery receipts need a device or an emulator with a camera/photo library. Expo Go supports every module used here.

## Demo logins

Password for all accounts: `Spendwise123!`

- `employee@spendwise.demo` (Ingrid Berg; has a card and a 20000.00 NOK monthly limit)
- `lars@spendwise.demo`, `nora@spendwise.demo`, `erik@spendwise.demo`

Admin/finance accounts also work and show their own employee profile.

## Checks

```bash
npx tsc --noEmit   # type-check
npm test           # jest-expo: money helpers, API client refresh/retry, expense form validation
npx expo-doctor
```

## Structure

- `src/theme.ts` design tokens; `src/components/` Button, Card, Field, StatusBadge, EmptyState, ErrorState, Money, Screen, etc.
- `src/api/client.ts` fetch client: bearer auth, one single-flight refresh on 401, one retry, session cleared when refresh is rejected. Tokens are stored only in `expo-secure-store`.
- `src/screens/` Login, Forgot password, Home, Expenses (list/detail/form), Cards and limits, Transactions, Notifications, Profile, Change password.
- `src/lib/` money (decimal strings, display-only formatting), dates, validation.

## Behaviour notes

- Money is handled as decimal strings; `Intl.NumberFormat` is used for display only. Progress bars use a display-only ratio.
- Creating an expense: create draft, upload receipts, then submit. If a later step fails, the draft is kept and a retry updates it instead of creating a duplicate. Server 422 messages (for example "A receipt is required...") are shown verbatim.
- Changing the password revokes all refresh tokens on the server, so the app signs in again with the new password straight away.
- "Card spend this month" (dashboard) is card transactions only; the limit "Used" figure comes from `/employees/me/limits` and also includes submitted expense claims, so the two numbers differ by design.

## Known limitations

- Not run on a device or simulator in this build (no Xcode simulator available). Verified: type-check, unit tests, `expo-doctor`, a web bundle export, and the API client against the live API from Node. Camera/gallery permission flows, SecureStore, receipt download (`expo-file-system`) and the screens' on-device layout are unverified.
- The expense date is a typed `YYYY-MM-DD` field with Today/Yesterday shortcuts (no native date picker).
- Receipts: camera/gallery images only (JPEG/PNG/WebP, max 5 MB, up to 5 per expense). PDFs already on an expense are listed but cannot be previewed in-app. The API has no endpoint to delete a receipt, so attached receipts cannot be removed.
- The receipt-required threshold (default 500.00) is not exposed by the API, so the form only hints at it; the server decides on submit.
- Employees can freeze a card but not unfreeze it (API rule).
- Web (`expo start --web`) is only used for bundling checks; SecureStore does not work on web, so sign-in will not persist there.
