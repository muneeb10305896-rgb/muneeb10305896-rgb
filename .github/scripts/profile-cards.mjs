// Generates the profile README cards as static SVGs (no third-party card services):
//   stats.svg      – stars, commits, PRs, issues, repos + yearly contributions
//   top-langs.svg  – language share across your own public, non-fork repos
//   activity.svg   – weekly contributions over the last 12 months
// Runs in the profile-animations workflow with the built-in GITHUB_TOKEN.
// Local preview with sample data:  node .github/scripts/profile-cards.mjs --mock out-dir
import { mkdirSync, writeFileSync } from 'node:fs';
import { join } from 'node:path';

const USER = process.env.GH_USER || 'muneeb10305896-rgb';
const args = process.argv.slice(2);
const MOCK = args.includes('--mock');
const OUT = args.filter(a => a !== '--mock')[0] || 'dist';

/* "radical" palette, matching the streak card */
const T = { bg: '#141321', title: '#fe428e', text: '#a9fef7', icon: '#f8d847', muted: '#7c7a93', grid: '#2a2840' };

const esc = s => String(s).replace(/[&<>"]/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' }[c]));
const fmt = n => n >= 1000 ? (n / 1000).toFixed(1).replace(/\.0$/, '') + 'k' : String(n);

async function fetchData() {
  const token = process.env.GITHUB_TOKEN;
  if (!token) throw new Error('GITHUB_TOKEN is not set');
  const query = `query($login: String!) {
    user(login: $login) {
      name login
      followers { totalCount }
      pullRequests { totalCount }
      issues { totalCount }
      repositories(ownerAffiliations: OWNER, isFork: false, privacy: PUBLIC, first: 100) {
        totalCount
        nodes {
          stargazerCount
          languages(first: 10, orderBy: { field: SIZE, direction: DESC }) {
            edges { size node { name color } }
          }
        }
      }
      contributionsCollection {
        totalCommitContributions
        contributionCalendar {
          totalContributions
          weeks { contributionDays { date contributionCount } }
        }
      }
    }
  }`;
  const res = await fetch('https://api.github.com/graphql', {
    method: 'POST',
    headers: { Authorization: `bearer ${token}`, 'Content-Type': 'application/json', 'User-Agent': 'profile-cards' },
    body: JSON.stringify({ query, variables: { login: USER } }),
  });
  const json = await res.json();
  if (!res.ok || json.errors) throw new Error(`GraphQL error: ${res.status} ${JSON.stringify(json.errors || json)}`);
  const u = json.data.user;
  const repos = u.repositories.nodes;
  const langs = {};
  for (const r of repos) for (const e of r.languages.edges) {
    const l = langs[e.node.name] || (langs[e.node.name] = { size: 0, color: e.node.color || '#858585' });
    l.size += e.size;
  }
  const days = u.contributionsCollection.contributionCalendar.weeks.flatMap(w => w.contributionDays);
  return {
    name: u.name || u.login,
    stars: repos.reduce((a, r) => a + r.stargazerCount, 0),
    commits: u.contributionsCollection.totalCommitContributions,
    prs: u.pullRequests.totalCount,
    issues: u.issues.totalCount,
    repos: u.repositories.totalCount,
    followers: u.followers.totalCount,
    yearTotal: u.contributionsCollection.contributionCalendar.totalContributions,
    langs,
    days,
  };
}

function mockData() {
  const days = [];
  const today = new Date();
  for (let i = 364; i >= 0; i--) {
    const d = new Date(today); d.setDate(d.getDate() - i);
    days.push({ date: d.toISOString().slice(0, 10), contributionCount: (i > 130 && i < 175) ? [0, 0, 1, 3, 0, 2, 5, 0, 1][i % 9] : 0 });
  }
  return {
    name: 'Muneeb Ahmed Butt', stars: 3, commits: 31, prs: 2, issues: 1, repos: 6, followers: 4, yearTotal: 35,
    langs: { JavaScript: { size: 52000, color: '#f1e05a' }, CSS: { size: 30000, color: '#663399' }, HTML: { size: 21000, color: '#e34c26' },
             Solidity: { size: 6000, color: '#AA6746' }, Python: { size: 2000, color: '#3572A5' } },
    days,
  };
}

const svgOpen = (w, h, label) =>
  `<svg xmlns="http://www.w3.org/2000/svg" width="${w}" height="${h}" viewBox="0 0 ${w} ${h}" role="img" aria-label="${esc(label)}">
<style>
  .t { font: 600 18px 'Segoe UI', Ubuntu, 'Helvetica Neue', Sans-Serif; fill: ${T.title}; }
  .l { font: 600 14px 'Segoe UI', Ubuntu, 'Helvetica Neue', Sans-Serif; fill: ${T.text}; }
  .v { font: 700 14px 'Segoe UI', Ubuntu, 'Helvetica Neue', Sans-Serif; fill: ${T.text}; }
  .s { font: 400 12px 'Segoe UI', Ubuntu, 'Helvetica Neue', Sans-Serif; fill: ${T.muted}; }
  .big { font: 800 26px 'Segoe UI', Ubuntu, 'Helvetica Neue', Sans-Serif; fill: ${T.title}; }
  .fade { opacity: 0; animation: fade .6s ease-out forwards; }
  @keyframes fade { to { opacity: 1; } }
  @media (prefers-reduced-motion: reduce) { .fade { animation: none; opacity: 1; } }
</style>
<rect width="${w}" height="${h}" rx="6" fill="${T.bg}"/>`;

/* small line icons, drawn in the icon colour */
const ICONS = {
  star:   'M8 .25l2.35 4.76 5.26.77-3.8 3.7.9 5.24L8 12.25l-4.71 2.47.9-5.24-3.8-3.7 5.26-.77z',
  commit: 'M8 4.5a3.5 3.5 0 110 7 3.5 3.5 0 010-7zM0 8h4.5M11.5 8H16',
  pr:     'M4 3a1.5 1.5 0 110 .01M4 4.5v7M4 13a1.5 1.5 0 110 .01M12 13a1.5 1.5 0 110 .01M12 11.5V6a2 2 0 00-2-2H7',
  issue:  'M8 1a7 7 0 110 14A7 7 0 018 1zM8 4.5v4M8 11v.5',
  repo:   'M3 1.5h9.5v11H4a1.5 1.5 0 00-1.5 1.5V2.5a1 1 0 011-1zM2.5 14A1.5 1.5 0 004 15.5h8.5',
};
const icon = (name, x, y) =>
  `<path transform="translate(${x},${y})" d="${ICONS[name]}" fill="${name === 'star' ? T.icon : 'none'}" stroke="${T.icon}" stroke-width="1.4" stroke-linecap="round" stroke-linejoin="round"/>`;

function statsCard(d) {
  const W = 495, H = 195;
  const rows = [
    ['star', 'Total Stars', d.stars],
    ['commit', 'Commits (last year)', d.commits],
    ['pr', 'Pull Requests', d.prs],
    ['issue', 'Issues', d.issues],
    ['repo', 'Public Repositories', d.repos],
  ];
  const body = rows.map(([ic, label, val], i) => {
    const y = 62 + i * 25;
    return `<g class="fade" style="animation-delay:${150 + i * 120}ms">${icon(ic, 25, y - 12)}
  <text class="l" x="50" y="${y}">${esc(label)}:</text><text class="v" x="230" y="${y}">${fmt(val)}</text></g>`;
  }).join('\n');
  const cx = 400, cy = 105, r = 46, C = 2 * Math.PI * r;
  return `${svgOpen(W, H, `${d.name}'s GitHub stats`)}
<text class="t" x="25" y="35">${esc(d.name.split(' ')[0])}'s GitHub Stats</text>
${body}
<g class="fade" style="animation-delay:300ms">
  <circle cx="${cx}" cy="${cy}" r="${r}" fill="none" stroke="${T.grid}" stroke-width="6"/>
  <circle cx="${cx}" cy="${cy}" r="${r}" fill="none" stroke="${T.title}" stroke-width="6" stroke-linecap="round"
          stroke-dasharray="${C.toFixed(1)}" stroke-dashoffset="${(C * 0.25).toFixed(1)}" transform="rotate(-90 ${cx} ${cy})"/>
  <text class="big" x="${cx}" y="${cy + 9}" text-anchor="middle">${fmt(d.yearTotal)}</text>
  <text class="s" x="${cx}" y="${cy + r + 22}" text-anchor="middle">contributions in the last year</text>
</g>
</svg>
`;
}

function langsCard(d) {
  const entries = Object.entries(d.langs).sort((a, b) => b[1].size - a[1].size).slice(0, 6);
  const total = entries.reduce((a, [, v]) => a + v.size, 0) || 1;
  const W = 350, rowsN = Math.ceil(entries.length / 2), H = 90 + rowsN * 26;
  let x = 25; const barW = W - 50;
  const bar = entries.map(([, v]) => {
    const w = (v.size / total) * barW;
    const seg = `<rect x="${x.toFixed(2)}" y="50" width="${w.toFixed(2)}" height="8" fill="${v.color}"/>`;
    x += w; return seg;
  }).join('');
  const legend = entries.map(([name, v], i) => {
    const cx = 25 + (i % 2) * 160, cy = 85 + Math.floor(i / 2) * 26;
    return `<g class="fade" style="animation-delay:${200 + i * 100}ms"><circle cx="${cx + 5}" cy="${cy - 4}" r="5" fill="${v.color}"/>
  <text class="l" x="${cx + 16}" y="${cy}">${esc(name)} <tspan class="s">${((v.size / total) * 100).toFixed(1)}%</tspan></text></g>`;
  }).join('\n');
  return `${svgOpen(W, H, 'Most used languages')}
<text class="t" x="25" y="35">Most Used Languages</text>
<clipPath id="bar"><rect x="25" y="50" width="${barW}" height="8" rx="4"/></clipPath>
<g clip-path="url(#bar)">${entries.length ? bar : `<rect x="25" y="50" width="${barW}" height="8" fill="${T.grid}"/>`}</g>
${legend}
</svg>
`;
}

function activityCard(d) {
  /* weekly totals over the last 12 months: a 31-day window is often empty
     for a student account, which renders as a flat line at zero */
  const MONTHS = ['Jan','Feb','Mar','Apr','May','Jun','Jul','Aug','Sep','Oct','Nov','Dec'];
  const daily = d.days.slice(-364);
  const weeks = [];
  for (let i = 0; i < daily.length; i += 7) {
    const chunk = daily.slice(i, i + 7);
    weeks.push({ date: chunk[0].date, count: chunk.reduce((a, x) => a + x.contributionCount, 0) });
  }
  const W = 900, H = 300, L = 55, R = 25, Tp = 60, B = 50;
  const pw = W - L - R, ph = H - Tp - B;
  const max = Math.max(4, ...weeks.map(w => w.count));
  const yMax = Math.ceil(max / 4) * 4;
  const px = i => L + (weeks.length > 1 ? (i / (weeks.length - 1)) * pw : 0);
  const py = v => Tp + ph - (v / yMax) * ph;
  const pts = weeks.map((w, i) => [px(i), py(w.count)]);
  const line = pts.map((p, i) => `${i ? 'L' : 'M'}${p[0].toFixed(1)},${p[1].toFixed(1)}`).join(' ');
  const area = `${line} L${px(weeks.length - 1).toFixed(1)},${Tp + ph} L${L},${Tp + ph} Z`;
  const grid = [0, 1, 2, 3, 4].map(k => {
    const v = (yMax / 4) * k, y = py(v);
    return `<line x1="${L}" x2="${W - R}" y1="${y}" y2="${y}" stroke="${T.grid}" stroke-dasharray="${k ? '3 4' : ''}"/>
<text class="s" x="${L - 10}" y="${y + 4}" text-anchor="end">${v}</text>`;
  }).join('\n');
  /* month label at the first week that starts in a new month */
  let prevM = -1;
  const xLabels = weeks.map((w, i) => {
    const m = Number(w.date.slice(5, 7)) - 1;
    if (m === prevM) return '';
    prevM = m;
    return i === 0 ? '' : `<text class="s" x="${px(i)}" y="${H - B + 22}" text-anchor="middle">${MONTHS[m]}</text>`;
  }).join('');
  const dots = pts.map((p, i) => weeks[i].count
    ? `<circle cx="${p[0].toFixed(1)}" cy="${p[1].toFixed(1)}" r="3.5" fill="${T.bg}" stroke="${T.text}" stroke-width="1.5"/>` : '').join('');
  const total = weeks.reduce((a, w) => a + w.count, 0);
  return `${svgOpen(W, H, 'Contribution activity, last 12 months')}
<defs><linearGradient id="fill" x1="0" y1="0" x2="0" y2="1">
  <stop offset="0" stop-color="${T.title}" stop-opacity=".45"/><stop offset="1" stop-color="${T.title}" stop-opacity="0"/>
</linearGradient></defs>
<text class="t" x="25" y="35">${esc(d.name.split(' ')[0])}'s Contribution Graph</text>
<text class="s" x="${W - 25}" y="35" text-anchor="end">${total} contributions · weekly, last 12 months</text>
${grid}
<path d="${area}" fill="url(#fill)" class="fade"/>
<path d="${line}" fill="none" stroke="${T.title}" stroke-width="2.5" stroke-linejoin="round" class="fade"/>
<g class="fade" style="animation-delay:250ms">${dots}</g>
${xLabels}
<text class="s" x="${L + pw / 2}" y="${H - 8}" text-anchor="middle">Weeks</text>
</svg>
`;
}

const data = MOCK ? mockData() : await fetchData();
mkdirSync(OUT, { recursive: true });
writeFileSync(join(OUT, 'stats.svg'), statsCard(data));
writeFileSync(join(OUT, 'top-langs.svg'), langsCard(data));
writeFileSync(join(OUT, 'activity.svg'), activityCard(data));
console.log(`cards written to ${OUT}: ${data.yearTotal} contributions, ${data.repos} repos, ${Object.keys(data.langs).length} languages`);
