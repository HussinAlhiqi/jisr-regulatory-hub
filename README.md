# Jisr Regulatory Hub

> Plain-language Saudi HR law for everyone working in the Kingdom.  
> Updated to reflect the February 2025 amendments (Royal Decree M/44).

**Live site:** https://jisr-regulatory-hub.netlify.app  
**Last verified:** April 2025

---

## Overview

The Jisr Regulatory Hub is a public reference guide covering KSA labour law across six topic areas:

| Topic | Articles | 2025 Changes |
|---|---|---|
| Hiring & Contracts | 7 | 2 |
| Pay & Compensation | 4 | 3 |
| Leave & Time Off | 6 | 3 |
| Termination | 5 | 2 |
| Worker Types | 4 | 1 |
| Compliance | 3 | 3 |

---

## Project structure

```
jisr-regulatory-hub/
├── public/
│   └── index.html          ← The site (single file, all content)
├── src/
│   └── content/            ← Future: structured JSON content per topic
│       ├── hiring/
│       ├── pay/
│       ├── leave/
│       ├── termination/
│       ├── worker-types/
│       └── compliance/
├── .github/
│   └── workflows/
│       └── deploy.yml      ← CI/CD: auto-deploy on push to main
├── netlify.toml            ← Netlify build + redirect config
└── README.md
```

---

## Deployment

The site deploys automatically via Netlify on every push to `main`.

- **Build command:** none (static HTML)
- **Publish directory:** `public/`
- **Deploy previews:** enabled on all pull requests

---

## Making content updates

### Quick update (edit HTML directly)
1. Edit `public/index.html`
2. Commit and push to `main`
3. Netlify deploys in ~30 seconds

### Regulation update (review workflow)
1. Create a branch: `git checkout -b update/regulation-name`
2. Make changes to `public/index.html`
3. Open a Pull Request — Netlify generates a deploy preview URL automatically
4. Review the preview, then merge to deploy

---

## Roadmap

- [ ] Phase 2: Convert to Next.js/Astro with JSON content files
- [ ] Phase 3: Automated regulation detection + Claude verification pipeline
- [ ] Phase 4: Admin review portal for approving content updates
- [ ] Phase 4: Arabic (RTL) version
- [ ] Phase 5: Multi-page with SEO-friendly URLs

---

## Legal

This hub is maintained by Jisr HR for informational purposes only.  
It does not constitute legal advice.  
Content reflects KSA Labour Law as amended by Royal Decree M/44 (effective February 2025).

**Sources:** MHRSD · Al Tamimi & Company · Morgan Lewis · Clyde & Co · Addleshaw Goddard · King & Spalding
