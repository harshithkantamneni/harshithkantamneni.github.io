#!/usr/bin/env node
// Refreshes PR states at deploy with the built-in token. If any request fails, the committed file stays as it is.
import { readFileSync, writeFileSync } from 'node:fs';

const FILE = 'web/src/data/prs.json';
const data = JSON.parse(readFileSync(FILE, 'utf8'));
const token = process.env.GITHUB_TOKEN;
const headers = { Accept: 'application/vnd.github+json', 'User-Agent': 'portfolio-site-build', ...(token ? { Authorization: `Bearer ${token}` } : {}) };

try {
  for (const pr of Object.values(data.prs)) {
    const res = await fetch(`https://api.github.com/repos/${pr.repo}/pulls/${pr.number}`, { headers });
    if (!res.ok) throw new Error(`${pr.repo}#${pr.number}: HTTP ${res.status}`);
    const j = await res.json();
    pr.state = j.state;
    pr.merged_at = j.merged_at ? j.merged_at.slice(0, 10) : null;
  }
  data.checked = new Date().toISOString().slice(0, 10);
  writeFileSync(FILE, JSON.stringify(data, null, 2) + '\n');
  console.log(`PR states refreshed, checked ${data.checked}`);
} catch (e) {
  console.log(`Keeping committed PR states from ${data.checked}: ${e.message}`);
}
