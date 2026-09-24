# Authentication Gate & Vercel Deployment Pipeline

Type: task
Status: resolved
Blocked by: 01

## Question

How should the lightweight password protection gate be implemented (e.g. Next.js middleware checking a hashed session or password token from `APP_PASSWORD`, bypassed when `NODE_ENV === 'development'`), and how should the Git-based rolling release pipeline be configured on Vercel (`mvp` branch as Preview, `main` branch as Production)?

## Answer

### 1. Lightweight Authentication Gate

- **Implementation Strategy**:
  - Stateless authentication implemented directly in Next.js App Router Edge `middleware.ts` using standard Web Crypto APIs (`crypto.subtle`).
  - Zero heavy third-party dependencies (no NextAuth, Auth.js, or Clerk required for this MVP gate).
- **Environment Variables**:
  - `APP_PASSWORD`: The secret access string. Generated per environment using `openssl rand -base64 32`.
  - `AUTH_SECRET`: Secret key used to sign and verify HMAC-SHA256 session tokens.
- **Local Development Bypass**:
  - If `process.env.NODE_ENV === 'development'` or `!process.env.APP_PASSWORD`, the middleware bypasses all verification, allowing instant friction-free development.
- **Session & Cookie Mechanism**:
  - **Cookie Name**: `deal_qual_session`
  - **Attributes**: `HttpOnly: true`, `SameSite: 'lax'`, `Secure: true` (in production / preview), `Path: '/'`, `Max-Age: 604800` (7 days).
  - **Payload Structure**: `<timestamp>.<hmacSignature>` where `hmacSignature = HMAC_SHA256("${timestamp}:${APP_PASSWORD}", AUTH_SECRET)`.
  - Storing only the signature and timestamp avoids exposing or persisting the raw password on the client while guaranteeing tamper resistance.
- **Middleware Routing Logic**:
  - **Public / Whitelist Paths**: `/_next/static`, `/_next/image`, `/favicon.ico`, `/login`, `/api/auth/login`.
  - **Protected Page Routes**: Redirect to `/login?redirect=${encodeURIComponent(pathname)}` upon missing or invalid session cookie.
  - **Protected API Routes**: Return `401 Unauthorized` with JSON payload `{ error: "Authentication required" }`.
- **API & UI Endpoints**:
  - `/login`: Minimal page containing a password input field and submit action.
  - `POST /api/auth/login`: Validates submitted password against `process.env.APP_PASSWORD`. On match, creates signed cookie header and returns `{ success: true }`. On failure, returns `401 Invalid password`.
  - `POST /api/auth/logout`: Clears the `deal_qual_session` cookie and redirects to `/login`.

### 2. Vercel Deployment & Git Release Pipeline

- **Branch Topology**:
  - **`mvp` branch $\rightarrow$ Vercel Preview**:
    - Serves as the active development and feature integration branch.
    - Every push triggers an automatic Vercel Preview deployment with its own unique URL (and can be linked to an alias like `preview.vercel-sam-demo.vercel.app`).
    - Connects to the staging/preview database branch on Neon.
  - **`main` branch $\rightarrow$ Vercel Production**:
    - Serves as the locked, stable production deployment.
    - Merged strictly via Pull Request from `mvp` upon milestone sign-off.
    - Automatically deployed by Vercel to the primary production domain.
- **Vercel Project Configuration**:
  - **Environment Scopes**:
    - **Preview**: `APP_PASSWORD` (preview password), `AUTH_SECRET`, `POSTGRES_URL` (Neon staging branch), `EVE_API_KEY`.
    - **Production**: `APP_PASSWORD` (separate production password), `AUTH_SECRET`, `POSTGRES_URL` (Neon production branch), `EVE_API_KEY`.
- **Zero-Config Build**:
  - Standard `next build` framework preset on Vercel with automatic Edge and Node.js function optimization.
