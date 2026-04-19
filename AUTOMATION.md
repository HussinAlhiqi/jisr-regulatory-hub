# Jisr Regulatory Hub — Automation Pipeline

## How it works

```
RSS feeds (MHRSD, Paul Hastings, Clyde & Co, Al Tamimi, Lexology)
        ↓  [Netlify Scheduled Function — every day at 07:00 UTC / 10:00 Riyadh]
        ↓  fetches feeds, filters by KSA labour law keywords
        ↓  new items only (deduped via Netlify Blobs)
        ↓
GitHub Issue created with:
  - Source article link + extracted summary
  - Pre-filled YAML template for you to complete
        ↓
You fill in the template in an issue comment
        ↓  [GitHub Action triggers on your comment]
Branch + PR auto-created with updated articles.json + changes.json
        ↓
Netlify attaches preview URL to PR automatically
        ↓
You review the preview → merge → Netlify deploys live
```

---

## One-time setup

### 1. GitHub labels

```bash
GITHUB_TOKEN=ghp_xxx node scripts/setup-labels.mjs
```

### 2. Netlify environment variables

In your Netlify dashboard → Site configuration → Environment variables, add:

| Variable | Value |
|---|---|
| `GITHUB_TOKEN` | Your fine-grained PAT (needs `contents: write` + `pull-requests: write` on this repo) |
| `GITHUB_REPO` | `HussinAlhiqi/jisr-regulatory-hub` |

### 3. GitHub Action permissions

In your GitHub repo → Settings → Actions → General:
- Set **Workflow permissions** to "Read and write permissions"
- Check "Allow GitHub Actions to create and approve pull requests"

---

## Using the pipeline

When a new regulation item is detected, you'll see a new issue like:
**[Regulation] Saudi Arabia amends social insurance contribution rates**

Open it, read the source article link, then add a comment with the filled YAML:

```yaml
REGULATION_UPDATE:
  topic: gosi
  article_id: gosi-contributions
  updated: true
  law_ref: Social Insurance Law Art. 7 (July 2025)
  question_en: How are GOSI contributions calculated in 2025?
  question_ar: كيف تُحسب اشتراكات التأمينات في 2025؟
  answer_en: |
    <p>Your HTML answer here...</p>
  answer_ar: |
    <p>إجابتك بالعربية هنا...</p>
  callout_en: <strong>July 2025 change:</strong> One-line callout.
  callout_ar: <strong>تغيير يوليو 2025:</strong> إشعار قصير.
  cite_en: Social Insurance Law (July 2025) · GOSI portal
  cite_ar: نظام التأمين الاجتماعي (يوليو 2025) · بوابة التأمينات
  change_summary_en: GOSI contribution rates revised — new system for post-July 2024 employees
  change_summary_ar: مراجعة نسب اشتراكات التأمينات — نظام جديد للمنضمين بعد يوليو 2024
```

The GitHub Action will:
1. Parse your YAML
2. Update `src/content/{topic}/articles.json`
3. Add an entry to `src/content/changes.json`
4. Create a branch and push
5. Open a PR with a Netlify preview URL
6. Comment the PR link back on the issue

Review the Netlify preview → merge to publish.

---

## RSS Sources monitored

| Source | Feed |
|---|---|
| MHRSD (Ministry of HR) | `hrsd.gov.sa/en/rss.xml` |
| Paul Hastings | Employment insights feed |
| Clyde & Co | Middle East employment feed |
| Al Tamimi | Employment & Incentives feed |
| Lexology | Saudi Arabia employment feed |

---

## Manually triggering the function

In Netlify dashboard → Functions → `rss-monitor` → **Run now**

Or via CLI:
```bash
netlify functions:invoke rss-monitor
```

---

## Skipping false positives

If the issue is not actually a relevant regulation change, just close it.
The item ID is stored in Netlify Blobs so it won't be re-detected.
