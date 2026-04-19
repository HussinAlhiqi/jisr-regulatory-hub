import { schedule } from '@netlify/functions';
import { getStore } from '@netlify/blobs';

// ── RSS sources ───────────────────────────────────────────────────────────────
// Each source has a feed URL, a human label, and keyword filters.
// An item must match at least one keyword (case-insensitive) to be considered
// regulation-relevant. This prevents noise from generic blog posts.

const SOURCES = [
  {
    label: 'MHRSD — Ministry of Human Resources',
    url: 'https://www.hrsd.gov.sa/en/rss.xml',
    keywords: ['labor', 'labour', 'employment', 'worker', 'salary', 'wage',
               'contract', 'iqama', 'saudization', 'nitaqat', 'leave',
               'termination', 'gosi', 'work permit', 'qiwa'],
  },
  {
    label: 'Paul Hastings — KSA Employment Law',
    url: 'https://www.paulhastings.com/rss/insights?practice=employment',
    keywords: ['saudi', 'ksa', 'mhrsd', 'labour law', 'labor law', 'qiwa',
               'gosi', 'saudization', 'royal decree', 'work permit'],
  },
  {
    label: 'Clyde & Co — Middle East Employment',
    url: 'https://www.clydeco.com/en/insights/rss?region=middle-east&topic=employment',
    keywords: ['saudi', 'ksa', 'labour', 'labor', 'employment', 'mhrsd',
               'qiwa', 'gosi', 'work permit', 'royal decree'],
  },
  {
    label: 'Al Tamimi — Employment & Incentives',
    url: 'https://www.tamimi.com/feed/?cat=employment-incentives',
    keywords: ['saudi', 'ksa', 'labour', 'labor', 'employment', 'mhrsd',
               'qiwa', 'gosi', 'saudization', 'nitaqat'],
  },
  {
    label: 'Lexology — Saudi Arabia Employment',
    url: 'https://www.lexology.com/rss/employment/saudi-arabia',
    keywords: ['labour law', 'labor law', 'mhrsd', 'qiwa', 'gosi',
               'saudization', 'royal decree', 'work permit', 'nitaqat'],
  },
];

// ── KSA topic mapping ─────────────────────────────────────────────────────────
// Maps keywords in a headline to the most likely hub topic.
// Used to pre-fill the issue template suggestion field.

const TOPIC_HINTS: [string[], string][] = [
  [['gosi', 'social insurance', 'pension', 'contribution', 'saned'], 'gosi'],
  [['outdoor', 'sun', 'heat', 'safety', 'health insurance', 'osh', 'occupational'], 'osh'],
  [['domestic worker', 'housemaid', 'musaned', 'driver', 'kafala'], 'domestic-workers'],
  [['internal work regulation', 'iwr', 'workplace rules'], 'iwr'],
  [['salary', 'wage', 'pay', 'mudad', 'wps', 'overtime', 'gratuity', 'eosb', 'allowance'], 'pay'],
  [['leave', 'maternity', 'paternity', 'sick leave', 'annual leave', 'bereavement', 'hajj'], 'leave'],
  [['termination', 'resignation', 'dismissal', 'end of service', 'notice period'], 'termination'],
  [['contract', 'probation', 'qiwa contract', 'hiring', 'work permit', 'iqama'], 'hiring'],
  [['nitaqat', 'saudization', 'compliance', 'training', 'anti-discrimination', 'equal opportunity'], 'compliance'],
  [['contractor', 'freelance', 'part-time', 'expat', 'worker type'], 'worker-types'],
];

function guessTopic(text: string): string {
  const lower = text.toLowerCase();
  for (const [keywords, topic] of TOPIC_HINTS) {
    if (keywords.some(k => lower.includes(k))) return topic;
  }
  return 'compliance'; // safe fallback
}

// ── RSS parser (no external dependency) ──────────────────────────────────────

interface RssItem {
  id: string;       // guid or link — used for dedup
  title: string;
  link: string;
  pubDate: string;
  description: string;
  source: string;
}

function extractTag(xml: string, tag: string): string {
  // Handle both <tag>content</tag> and <tag><![CDATA[content]]></tag>
  const re = new RegExp(`<${tag}[^>]*>(?:<!\\[CDATA\\[)?([\\s\\S]*?)(?:\\]\\]>)?<\\/${tag}>`, 'i');
  const m = xml.match(re);
  if (!m) return '';
  return m[1]
    .replace(/<[^>]+>/g, ' ')   // strip any inner HTML tags
    .replace(/&amp;/g, '&')
    .replace(/&lt;/g, '<')
    .replace(/&gt;/g, '>')
    .replace(/&quot;/g, '"')
    .replace(/&#39;/g, "'")
    .replace(/\s+/g, ' ')
    .trim();
}

async function fetchFeed(source: typeof SOURCES[0]): Promise<RssItem[]> {
  let xml: string;
  try {
    const res = await fetch(source.url, {
      headers: { 'User-Agent': 'JisrRegulatoryHub/1.0 RSS Monitor' },
      signal: AbortSignal.timeout(10_000),
    });
    if (!res.ok) return [];
    xml = await res.text();
  } catch {
    console.warn(`[rss-monitor] Failed to fetch ${source.label}`);
    return [];
  }

  // Split into individual <item> blocks
  const items: RssItem[] = [];
  const itemBlocks = xml.match(/<item[\s\S]*?<\/item>/gi) ?? [];

  for (const block of itemBlocks) {
    const title = extractTag(block, 'title');
    const link  = extractTag(block, 'link') || extractTag(block, 'guid');
    const guid  = extractTag(block, 'guid') || link;
    const desc  = extractTag(block, 'description') || extractTag(block, 'summary');
    const date  = extractTag(block, 'pubDate') || extractTag(block, 'published') || new Date().toISOString();

    if (!title || !guid) continue;

    // Keyword relevance filter
    const combined = (title + ' ' + desc).toLowerCase();
    const relevant = source.keywords.some(k => combined.includes(k));
    if (!relevant) continue;

    items.push({
      id: guid,
      title,
      link,
      pubDate: date,
      description: desc.slice(0, 600),
      source: source.label,
    });
  }

  return items;
}

// ── GitHub issue creator ──────────────────────────────────────────────────────

async function createGitHubIssue(item: RssItem, token: string, repo: string) {
  const suggestedTopic = guessTopic(item.title + ' ' + item.description);

  const body = `## 🔔 Regulation change detected

**Source:** ${item.source}
**Published:** ${item.pubDate}
**Link:** ${item.link}

### Summary from feed
> ${item.description}

---

## ✍️ Fill in this template to create a PR

To trigger an automatic PR, add a comment on this issue using **exactly** this format.
Replace everything between the \`[[ ]]\` markers with your content.
Do not remove or rename any field.

\`\`\`yaml
REGULATION_UPDATE:
  topic: [[${suggestedTopic}]]
  article_id: [[e.g. gosi-contributions — use existing id or create new one]]
  updated: [[true or false]]
  law_ref: [[e.g. Social Insurance Law Art. 7]]
  question_en: [[What changed about X?]]
  question_ar: [[ما الذي تغيّر في X؟]]
  answer_en: |
    [[Full HTML answer in English. Use <p>, <ul>, <li>, <strong>, <table class="data-tbl"> as needed.]]
  answer_ar: |
    [[Full HTML answer in Arabic. Mirror structure of answer_en.]]
  callout_en: [[Optional: <strong>Change label:</strong> One-line callout text. Leave blank if none.]]
  callout_ar: [[اختياري: نص الإشعار بالعربية. اتركه فارغًا إن لم يكن ضرورياً.]]
  cite_en: [[e.g. Social Insurance Law (July 2025) · GOSI portal]]
  cite_ar: [[مثال: نظام التأمين الاجتماعي (يوليو 2025) · بوابة التأمينات]]
  change_summary_en: [[One sentence for the changes feed, e.g. "GOSI contribution rates revised from July 2025"]]
  change_summary_ar: [[جملة واحدة لخلاصة التغيير بالعربية]]
\`\`\`

---

*This issue was opened automatically by the Jisr Regulatory Hub RSS monitor.*
*Merge the resulting PR to publish the change to the site.*`;

  const res = await fetch(`https://api.github.com/repos/${repo}/issues`, {
    method: 'POST',
    headers: {
      Authorization: `Bearer ${token}`,
      Accept: 'application/vnd.github+json',
      'X-GitHub-Api-Version': '2022-11-28',
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({
      title: `[Regulation] ${item.title}`,
      body,
      labels: ['regulation-update', 'automated'],
    }),
  });

  if (!res.ok) {
    const err = await res.text();
    throw new Error(`GitHub issue creation failed: ${res.status} ${err}`);
  }

  const issue = await res.json() as { number: number; html_url: string };
  console.log(`[rss-monitor] Created issue #${issue.number}: ${issue.html_url}`);
  return issue;
}

// ── Main handler ──────────────────────────────────────────────────────────────

const handler = async () => {
  const GITHUB_TOKEN = process.env.GITHUB_TOKEN;
  const GITHUB_REPO  = process.env.GITHUB_REPO ?? 'HussinAlhiqi/jisr-regulatory-hub';

  if (!GITHUB_TOKEN) {
    console.error('[rss-monitor] GITHUB_TOKEN env var not set — aborting');
    return { statusCode: 500, body: 'Missing GITHUB_TOKEN' };
  }

  // Load seen item IDs from Netlify Blobs
  const store = getStore('rss-monitor');
  let seenIds: Set<string>;
  try {
    const raw = await store.get('seen-ids', { type: 'json' }) as string[] | null;
    seenIds = new Set(raw ?? []);
  } catch {
    seenIds = new Set();
  }

  console.log(`[rss-monitor] Loaded ${seenIds.size} previously seen item IDs`);

  const newSeenIds = new Set(seenIds);
  let issuesCreated = 0;

  for (const source of SOURCES) {
    console.log(`[rss-monitor] Fetching: ${source.label}`);
    const items = await fetchFeed(source);
    console.log(`[rss-monitor]   → ${items.length} relevant items found`);

    for (const item of items) {
      if (seenIds.has(item.id)) continue;

      try {
        await createGitHubIssue(item, GITHUB_TOKEN, GITHUB_REPO);
        issuesCreated++;
        newSeenIds.add(item.id);

        // Small delay to avoid GitHub rate limiting
        await new Promise(r => setTimeout(r, 1000));
      } catch (err) {
        console.error(`[rss-monitor] Failed to create issue for "${item.title}":`, err);
      }
    }
  }

  // Persist updated seen IDs (cap at 2000 to prevent unbounded growth)
  const idsToStore = [...newSeenIds].slice(-2000);
  await store.setJSON('seen-ids', idsToStore);

  console.log(`[rss-monitor] Done. ${issuesCreated} new issue(s) created.`);
  return {
    statusCode: 200,
    body: JSON.stringify({ issuesCreated, totalSeen: idsToStore.length }),
  };
};

// Run daily at 07:00 UTC (10:00 Riyadh / AST)
export default schedule('0 7 * * *', handler);
