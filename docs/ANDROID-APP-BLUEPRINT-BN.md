# ProcureBest Android App — Development Blueprint

## সিদ্ধান্ত
- Product: Independent ProcureBest mobile app experience
- First platform: Android
- Delivery approach: Progressive Web App (PWA), installable from the website
- Authentication: Not required in Version 1
- Budget target: ৳0 for the first working version, using existing hosting and free tools
- Source of truth: Existing ProcureBest website and its database/content

## Product principle
The app has its own mobile-first home screen, bottom navigation and feature discovery. It must reuse existing website pages, calculators and content rather than creating duplicate calculators or a second content database.

## Navigation
1. Home — welcome, featured career tools, procurement tools and latest learning links
2. Career — Career Hub, Career Roadmap and Career Calculator
3. Tools — Salary Calculator, TCO and Landing Cost
4. Learn — Blog and learning resources
5. Website / More — open the full ProcureBest website and contact/about pages

## Release scope
### Version 1
- Independent mobile-first app shell at /app/
- ProcureBest brand assets
- English/Bangla interface labels
- PWA manifest, installability and service worker
- Links to existing Career Hub, calculator and blog pages
- No login, payment or duplicate data storage
- Basic offline shell only; dynamic calculator pages and API responses remain online

### Version 1.1
- Connect live featured blog cards and tool metadata to public website APIs where available
- Improve install guidance and offline fallback
- Validate Android Chrome behaviour and small-screen accessibility

### Later releases
- Optional account/login
- Save career plans and calculator results
- Personal dashboard and progress tracking
- Push notifications only if there is a clear user need and consent

## Technical approach
- Existing application: Cloudflare Workers + static assets + D1
- App shell: static files under public/app/
- PWA: manifest.webmanifest and service worker scoped to /app/
- Reuse existing website routes for live career, calculator and blog functionality
- Keep all API and admin routes online; do not cache private or dynamic data
- Maintain source code in GitHub and deploy through the existing Cloudflare pipeline

## Existing website integration
| App feature | Existing website destination |
|---|---|
| Career Hub | /en/career or /bn/career |
| Career Roadmap / Career Calculator | Existing Career Hub functionality |
| Salary Calculator | Career Hub / salary feature when available |
| TCO | /en/calculators/total-cost-of-ownership |
| Landing Cost | Existing Shipping & Import Cost calculator |
| Blog | /en/blog or /bn/blog |
| All calculators | /en/calculators or /bn/calculators |

Routes must be verified against production before release. Do not create duplicate calculations just to fill a card.

## Quality and safety checks
- Test on Android Chrome at 360px, 390px and 412px widths
- Verify manifest, service-worker registration and install prompt
- Verify every navigation link in English and Bangla
- Do not cache /api/, /admin/, account, payment or other private responses
- Check keyboard focus, readable contrast, touch target size and page load performance
- Do not publish to production until the owner approves the release

## First implementation
The first implementation adds an independent app shell, basic bilingual labels, install prompt handling, PWA manifest and a minimal shell cache. It does not yet claim that all calculator experiences have been rebuilt as native app screens.
