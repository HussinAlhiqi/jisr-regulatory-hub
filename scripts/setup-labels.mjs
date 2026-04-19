#!/usr/bin/env node
// Run once to create the GitHub labels used by the automation pipeline.
// Usage: GITHUB_TOKEN=ghp_xxx node scripts/setup-labels.mjs

const REPO  = 'HussinAlhiqi/jisr-regulatory-hub';
const TOKEN = process.env.GITHUB_TOKEN;

if (!TOKEN) {
  console.error('Set GITHUB_TOKEN env var first');
  process.exit(1);
}

const LABELS = [
  { name: 'regulation-update', color: 'FF5C00', description: 'Detected regulation change — needs review' },
  { name: 'automated',         color: '0B1D2E', description: 'Created by the RSS monitor bot' },
  { name: 'pr-created',        color: '00A896', description: 'PR has been auto-generated from this issue' },
];

const headers = {
  Authorization: `Bearer ${TOKEN}`,
  Accept: 'application/vnd.github+json',
  'X-GitHub-Api-Version': '2022-11-28',
  'Content-Type': 'application/json',
};

for (const label of LABELS) {
  const res = await fetch(`https://api.github.com/repos/${REPO}/labels`, {
    method: 'POST',
    headers,
    body: JSON.stringify(label),
  });
  if (res.status === 422) {
    console.log(`  ⚠  Label already exists: ${label.name}`);
  } else if (res.ok) {
    console.log(`  ✓  Created label: ${label.name}`);
  } else {
    console.error(`  ✗  Failed to create ${label.name}: ${res.status}`);
  }
}

console.log('\nDone. Labels ready on GitHub.');
