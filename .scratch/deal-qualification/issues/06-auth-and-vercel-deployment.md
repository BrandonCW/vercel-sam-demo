# Authentication Gate & Vercel Deployment Pipeline

Type: task
Status: open
Blocked by: 01

## Question

How should the lightweight password protection gate be implemented (e.g. Next.js middleware checking a hashed session or password token from `APP_PASSWORD`, bypassed when `NODE_ENV === 'development'`), and how should the Git-based rolling release pipeline be configured on Vercel (`mvp` branch as Preview, `main` branch as Production)?
