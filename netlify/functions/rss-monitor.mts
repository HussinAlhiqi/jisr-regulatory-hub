import type { Config } from '@netlify/functions';
import { getStore } from '@netlify/blobs';

// ── RSS sources ───────────────────────────────────────────────────────────────
// Google News RSS confirmed working — returns 40+ items per query.
// Each query covers a different angle of KSA employment regulation.
// Items are deduplicated by GUID across all sources.

const SOURCES = [
  {
    label: 'Google News — MHRSD & Saudi employment regulation',
    url: 'https://news.google.com/rss/search?q=MHRSD+Saudi+employment+regulation&hl=en-US&gl=US&ceid=US:en',
    keywords: ['saudi','ksa','mhrsd','labour','labor','employment','worker',
               'salary','wage','contract','saudization','nitaqat','leave',
               'termination','gosi','work permit','qiwa','royal decree'],
  },
  {
    label: 'Google News — Saudi Arabia labour law 2025',
    url: 'https://news.google.com/rss/search?q=Saudi+Arabia+labour+law+2025&hl=en-US&gl=US&ceid=US:en',
    keywords: ['saudi','ksa','mhrsd','labour','labor','employment','worker',
               'regulation','decree','ministry','qiwa','gosi','visa','iqama'],
  },
  {
    label: 'Google News — Saudi Arabia Qiwa GOSI Mudad',
    url: 'https://news.google.com/rss/search?q=Saudi+Arabia+Qiwa+GOSI+Mudad+employment&hl=en-US&gl=US&ceid=US:en',
    keywords: ['saudi','qiwa','gosi','mudad','wps','saudization','nitaqat',
               'iqama','labour','labor','employment','regulation'],
  },
];

// ── Topic hint mapping ────────────────────────────────────────────────────────
const TOPIC_HINTS: [string[], string][] = [
  [['gosi','social insurance','pension','contribution','saned'], 'gosi'],
  [['outdoor','sun','heat','safety','health insurance','osh','occupational'], 'osh'],
  [['domestic worker','housemaid','musaned','driver','kafala'], 'domestic-workers'],
  [['internal work regulation','iwr','workplace rules'], 'iwr'],
  [['salary','wage','pay','mudad','wps','overtime','gratuity','eosb','allowance'], 'pay'],
  [['leave','maternity','paternity','sick leave','annual leave','bereavement','hajj'], 'leave'],
  [['termination','resignation','dismissal','end of service','notice period'], 'termination'],
  [['contract','probation','qiwa contract','hiring','work permit','iqama'], 'hiring'],
  [['nitaqat','saudization','compliance','training','anti-discrimination'], 'compliance'],
];

function guessTopic(text: string): string {
  const lower = text.toLowerCase();
  for (const [keywords, topic] of TOPIC_HINTS) {
    if (keywords.some(k => lower.includes(k))) return topic;
  }
  return 'compliance';
}

// ── RSS parser ────────────────────────────────────────────────────────────────
interface RssItem {
  id: string;
  title: string;
  link: string;
  pubDate: string;
  description: string;
  source: string;
}

function extractTag(xml: string, tag: string): string {
  const re = new RegExp(`<${tag}[^>]*>(?:<!\\[CDATA\\[)?([\\s\\S]*?)(?:\\]\\]>)?<\\/${tag}>`, 'i');
  const m = xml.match(re);
  if (!m) return '';
  return m[1]
    .replace(/<[^>]+>/g, ' ')
    .replace(/&amp;/g, '&').replace(/&lt;/g, '<').replace(/&gt;/g, '>')
    .replace(/&quot;/g, '"').replace(/&#39;/g, "'")
    .replace(/\s+/g, ' ').trim();
}

async function fetchFeed(source: typeof SOURCES[0]): Promise<RssItem[]> {
  try {
    const res = await fetch(source.url, {
      headers: {
        // Must use a browser-like UA — Google News blocks generic bots
        'User-Agent': 'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36',
        'Accept': 'application/rss+xml, application/xml, text/xml, */*',
        'Accept-Language': 'en-US,en;q=0.9',
      },
      signal: AbortSignal.timeout(12_000),
    });

    if (!res.ok) {
      console.warn(`[rss-monitor] ${source.label}: HTTP ${res.status}`);
      return [];
    }

    const xml = await res.text();
    const items: RssItem[] = [];

    // Split on <item> boundaries
    const blocks = xml.match(/<item[\s\S]*?<\/item>/gi) ?? [];

    for (const block of blocks) {
      const title = extractTag(block, 'title');
      const guid  = extractTag(block, 'guid') || extractTag(block, 'link');
      const link  = extractTag(block, 'link') || guid;
      const desc  = extractTag(block, 'description') || '';
      const date  = extractTag(block, 'pubDate') || new Date().toUTCString();
      const src   = extractTag(block, 'source') || source.label;

      if (!title || !guid) continue;

      // Skip items older than 90 days to avoid noise from old articles
      const pubMs = new Date(date).getTime();
      if (!isNaN(pubMs) && Date.now() - pubMs > 90 * 24 * 60 * 60 * 1000) continue;

      // Keyword relevance filter
      const combined = (title + ' ' + desc).toLowerCase();
      if (!source.keywords.some(k => combined.includes(k))) continue;

      items.push({
        id: guid,
        title,
        link: link || guid,
        pubDate: date,
        description: desc.slice(0, 500),
        source: src,
      });
    }

    return items;
  } catch (err) {
    console.warn(`[rss-monitor] ${source.label}: fetch failed —`, err);
    return [];
  }
}

// ── GitHub issue creator ──────────────────────────────────────────────────────
async function createGitHubIssue(item: RssItem, token: string, repo: string) {
  const suggestedTopic = guessTopic(item.title + ' ' + item.description);

  const body = `## 🔔 Regulation change detected

**Source:** ${item.source}
**Published:** ${item.pubDate}
**Link:** ${item.link}

### Summary from feed
> ${item.description || 'No description available — open the link above for full content.'}

---

## ✍️ Fill in this template to create a PR

Add a comment on this issue with the block below, fully filled in.
Replace everything between \`[[ ]]\` with your content.
**Do not remove or rename any field.**

\`\`\`yaml
REGULATION_UPDATE:
  topic: [[${suggestedTopic}]]
  article_id: [[e.g. gosi-contributions — use existing id or a new slug]]
  updated: [[true]]
  law_ref: [[e.g. Social Insurance Law Art. 7 (July 2025)]]
  question_en: [[What changed about X?]]
  question_ar: [[ما الذي تغيّر في X؟]]
  answer_en: |
    [[<p>Full HTML answer in English. Use &lt;p&gt;, &lt;ul&gt;, &lt;li&gt;, &lt;strong&gt;, &lt;table class="data-tbl"&gt; as needed.</p>]]
  answer_ar: |
    [[<p>إجابة HTML كاملة بالعربية. طابق هيكل الإجابة الإنجليزية.</p>]]
  callout_en: [[<strong>July 2025 change:</strong> One-line callout. Leave blank if none.]]
  callout_ar: [[<strong>تغيير يوليو 2025:</strong> إشعار قصير. اتركه فارغًا إن لم يكن ضرورياً.]]
  cite_en: [[e.g. Social Insurance Law (July 2025) · GOSI portal]]
  cite_ar: [[مثال: نظام التأمين الاجتماعي (يوليو 2025) · بوابة التأمينات]]
  change_summary_en: [[One sentence for changes feed, e.g. "GOSI contribution rates revised from July 2025"]]
  change_summary_ar: [[جملة واحدة للتغيير بالعربية]]
\`\`\`

---
*Auto-opened by the Jisr Regulatory Hub RSS monitor. Close this issue if not relevant.*`;

  const res = await fetch(`https://api.github.com/repos/${repo}/issues`, {
    method: 'POST',
    headers: {
      Authorization: `Bearer ${token}`,
      Accept: 'application/vnd.github+json',
      'X-GitHub-Api-Version': '2022-11-28',
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({
      title: `[Regulation] ${item.title.slice(0, 120)}`,
      body,
      labels: ['regulation-update', 'automated'],
    }),
  });

  if (!res.ok) {
    throw new Error(`GitHub API ${res.status}: ${await res.text()}`);
  }

  const issue = await res.json() as { number: number; html_url: string };
  console.log(`[rss-monitor] ✓ Issue #${issue.number}: ${issue.html_url}`);
  return issue;
}

// ── Main handler ──────────────────────────────────────────────────────────────
export default async (req: Request) => {
  console.log('[rss-monitor] Starting RSS monitor run');

  const GITHUB_TOKEN = process.env.GITHUB_TOKEN;
  const GITHUB_REPO  = process.env.GITHUB_REPO ?? 'HussinAlhiqi/jisr-regulatory-hub';

  if (!GITHUB_TOKEN) {
    console.error('[rss-monitor] GITHUB_TOKEN not set — aborting');
    return new Response('Missing GITHUB_TOKEN', { status: 500 });
  }

  // Load seen IDs from Netlify Blobs
  const store = getStore('rss-monitor');
  let seenIds: Set<string>;
  try {
    const raw = await store.get('seen-ids', { type: 'json' }) as string[] | null;
    seenIds = new Set(raw ?? []);
    console.log(`[rss-monitor] Loaded ${seenIds.size} seen IDs`);
  } catch {
    seenIds = new Set();
    console.log('[rss-monitor] No seen IDs — starting fresh');
  }

  const newSeenIds = new Set(seenIds);
  let issuesCreated = 0;
  let itemsChecked = 0;

  for (const source of SOURCES) {
    console.log(`[rss-monitor] Fetching: ${source.label}`);
    const items = await fetchFeed(source);
    console.log(`[rss-monitor]   → ${items.length} relevant items`);
    itemsChecked += items.length;

    for (const item of items) {
      if (seenIds.has(item.id)) continue;

      console.log(`[rss-monitor]   NEW: ${item.title.slice(0, 70)}`);
      try {
        await createGitHubIssue(item, GITHUB_TOKEN, GITHUB_REPO);
        issuesCreated++;
        newSeenIds.add(item.id);
        // Avoid GitHub rate limiting
        await new Promise(r => setTimeout(r, 1500));
      } catch (err) {
        console.error(`[rss-monitor] Failed to create issue:`, err);
      }
    }
  }

  // Persist updated seen IDs (cap at 3000)
  const idsToStore = [...newSeenIds].slice(-3000);
  try {
    await store.setJSON('seen-ids', idsToStore);
    console.log(`[rss-monitor] Saved ${idsToStore.length} seen IDs`);
  } catch (err) {
    console.error('[rss-monitor] Failed to save seen IDs:', err);
  }

  const summary = { issuesCreated, itemsChecked, totalSeen: idsToStore.length };
  console.log('[rss-monitor] Done:', summary);
  return new Response(JSON.stringify(summary), { status: 200 });
};

// Run daily at 07:00 UTC = 10:00 Riyadh (AST = UTC+3)
export const config: Config = {
  schedule: '0 7 * * *',
};
