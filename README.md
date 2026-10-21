# ProcureBest — Cloudflare edition

Bilingual (English / বাংলা) procurement site that runs on Cloudflare's free plan:
Workers + D1 (database) + KV (files), deployed from GitHub. No npm dependencies at runtime.

**Setup guide (Bengali, step by step): [docs/SETUP-GUIDE-BN.md](docs/SETUP-GUIDE-BN.md)**

## What's included
- 3 calculators (TCO, Shipping & Import Cost, Comparative Statement) — run in the browser, Excel export (built-in .xlsx writer) and PDF via print
- Library: books, Excel, CV samples, documents — free or paid; every download needs a confirmed email
- Manual bKash / Nagad payments: buyer submits the Transaction ID, admin approves
- 3 MCQ exams × 20 random questions (2 free, 1 paid with 3 attempts per payment), server-side scoring, certificates with QR code and public verification
- Blog, Career and Glossary sections
- Admin panel (English/বাংলা): library with chunked uploads, posts, glossary, exams, question bank with CSV import/export, orders, email list with CSV export, downloads log, certificates, messages, settings

## Configuration
| Name | Kind | Needed |
|---|---|---|
| `DB` | D1 binding (`wrangler.jsonc`) | yes |
| `FILES_KV` | KV binding | recommended (otherwise files ≤ 5 MB, stored in D1) |
| `FILES` | R2 binding | optional |
| `ADMIN_PASSWORD` | secret | yes |
| `BREVO_API_KEY` | secret | for email verification (otherwise "collect-only" mode) |
| `SITE_URL` | variable | optional, e.g. `https://procurebest.com` |
| `SESSION_SECRET` | secret | optional (a random one is stored in D1 automatically) |

The database schema is created automatically on the first request.

## Local development
```
node --experimental-sqlite dev/server.mjs   # http://localhost:8787, admin password: local-admin-password
node --experimental-sqlite dev/test.mjs     # end-to-end tests
```
