#!/usr/bin/env node
// orc — gate-free development orchestrator for Claude Code.
// Node 20+, no dependencies. Design: docs/SYSTEM-DESIGN.md (`orc explain`).
import fs from 'node:fs';
import path from 'node:path';
import { spawnSync } from 'node:child_process';
import { fileURLToPath } from 'node:url';

const PLUGIN_ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const VERSION = '0.1.0';

/* ----------------------------- yaml subset ------------------------------ */
// Supports: nested maps by 2-space indent, lists ("- x", "- k: v"), inline
// [a, b] and { k: v }, quoted strings, numbers, booleans, null, # comments.
function parseYaml(src) {
  const lines = [];
  for (const raw of src.split(/\r?\n/)) {
    const s = stripComment(raw);
    if (!s.trim()) continue;
    lines.push({ indent: s.match(/^ */)[0].length, text: s.trim() });
  }
  if (!lines.length) return {};
  return parseBlock(lines, 0, lines[0].indent)[0] ?? {};
}
function stripComment(s) {
  let q = null, out = '';
  for (let i = 0; i < s.length; i++) {
    const c = s[i];
    if (q) { out += c; if (c === q) q = null; continue; }
    if (c === '"' || c === "'") { q = c; out += c; continue; }
    if (c === '#' && (i === 0 || /\s/.test(s[i - 1]))) break;
    out += c;
  }
  return out.replace(/\s+$/, '');
}
function parseBlock(L, i, ind) {
  if (i >= L.length) return [null, i];
  return (L[i].text === '-' || L[i].text.startsWith('- ')) ? parseList(L, i, ind) : parseMap(L, i, ind);
}
function parseMap(L, i, ind) {
  const o = {};
  while (i < L.length && L[i].indent === ind) {
    const m = L[i].text.match(/^([^:]+):(?:\s+(.*))?$/);
    if (!m) break;
    const k = m[1].trim().replace(/^["']|["']$/g, '');
    if (m[2] !== undefined && m[2] !== '') { o[k] = parseScalar(m[2]); i++; continue; }
    i++;
    if (i < L.length && L[i].indent > ind) { const [v, j] = parseBlock(L, i, L[i].indent); o[k] = v; i = j; }
    else o[k] = null;
  }
  return [o, i];
}
function parseList(L, i, ind) {
  const a = [];
  while (i < L.length && L[i].indent === ind && (L[i].text === '-' || L[i].text.startsWith('- '))) {
    const rest = L[i].text.slice(1).trim();
    if (rest === '') { i++; const [v, j] = parseBlock(L, i, L[i]?.indent ?? ind + 2); a.push(v); i = j; continue; }
    const km = rest.match(/^([^:\[\]{}"']+):(?:\s+(.*))?$/);
    if (!km) { a.push(parseScalar(rest)); i++; continue; }
    const o = {}; const k = km[1].trim(); i++;
    if (km[2] !== undefined && km[2] !== '') o[k] = parseScalar(km[2]);
    else if (i < L.length && L[i].indent > ind) { const [v, j] = parseBlock(L, i, L[i].indent); o[k] = v; i = j; }
    else o[k] = null;
    if (i < L.length && L[i].indent > ind && !L[i].text.startsWith('- ')) { const [more, j] = parseMap(L, i, L[i].indent); Object.assign(o, more); i = j; }
    a.push(o);
  }
  return [a, i];
}
function splitTop(s) {
  const out = []; let d = 0, q = null, cur = '';
  for (const c of s) {
    if (q) { cur += c; if (c === q) q = null; continue; }
    if (c === '"' || c === "'") { q = c; cur += c; continue; }
    if (c === '[' || c === '{') d++;
    if (c === ']' || c === '}') d--;
    if (c === ',' && d === 0) { out.push(cur); cur = ''; continue; }
    cur += c;
  }
  if (cur.trim()) out.push(cur);
  return out;
}
function parseScalar(s) {
  s = s.trim();
  if (s === '' || s === 'null' || s === '~') return s === '' ? '' : null;
  if (s === 'true') return true;
  if (s === 'false') return false;
  if (/^-?\d+(\.\d+)?$/.test(s)) return Number(s);
  if (s.startsWith('"') && s.endsWith('"')) { try { return JSON.parse(s); } catch { return s.slice(1, -1); } }
  if (s.startsWith("'") && s.endsWith("'")) return s.slice(1, -1).replace(/''/g, "'");
  if (s.startsWith('[') && s.endsWith(']')) return splitTop(s.slice(1, -1)).map(parseScalar);
  if (s.startsWith('{') && s.endsWith('}')) {
    const o = {};
    for (const p of splitTop(s.slice(1, -1))) { const i = p.indexOf(':'); if (i < 0) continue; o[p.slice(0, i).trim().replace(/^["']|["']$/g, '')] = parseScalar(p.slice(i + 1)); }
    return o;
  }
  return s;
}
const isScalar = x => x === null || x === undefined || ['string', 'number', 'boolean'].includes(typeof x);
function scalar(x) {
  if (x === null || x === undefined) return 'null';
  if (typeof x !== 'string') return String(x);
  if (x === '' || /[:#\[\]{},"']|^\s|\s$|^(true|false|null|~|-?\d+(\.\d+)?)$/.test(x) || x.startsWith('- ')) return JSON.stringify(x);
  return x;
}
function dumpYaml(v, ind = 0) {
  const pad = ' '.repeat(ind); let out = '';
  for (const [k, val] of Object.entries(v)) {
    if (Array.isArray(val)) {
      if (!val.length) out += `${pad}${k}: []\n`;
      else if (val.every(isScalar)) out += `${pad}${k}: [${val.map(scalar).join(', ')}]\n`;
      else {
        out += `${pad}${k}:\n`;
        for (const it of val) {
          if (isScalar(it)) { out += `${pad}  - ${scalar(it)}\n`; continue; }
          const ls = dumpYaml(it, ind + 4).split('\n').filter(Boolean);
          out += `${pad}  - ${ls[0].trimStart()}\n` + ls.slice(1).map(l => l + '\n').join('');
        }
      }
    } else if (val && typeof val === 'object') {
      const vs = Object.values(val);
      if (!vs.length) out += `${pad}${k}: {}\n`;
      else if (vs.every(isScalar) && vs.length <= 8) out += `${pad}${k}: { ${Object.entries(val).map(([a, b]) => `${a}: ${scalar(b)}`).join(', ')} }\n`;
      else out += `${pad}${k}:\n` + dumpYaml(val, ind + 2);
    } else out += `${pad}${k}: ${scalar(val)}\n`;
  }
  return out;
}

/* ------------------------------ helpers --------------------------------- */
const read = f => fs.readFileSync(f, 'utf8');
const exists = f => fs.existsSync(f);
const write = (f, s) => { fs.mkdirSync(path.dirname(f), { recursive: true }); fs.writeFileSync(f, s); };
const append = (f, s) => { fs.mkdirSync(path.dirname(f), { recursive: true }); fs.appendFileSync(f, s); };
const posix = p => p.split(path.sep).join('/');
const now = () => new Date().toISOString().replace(/\.\d{3}Z$/, 'Z');
const stamp = () => now().slice(0, 16).replace('T', ' ');
const slug = s => s.toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, '').slice(0, 40);
const die = (m, code = 1) => { process.stderr.write(m + '\n'); process.exit(code); };
const say = (...a) => process.stdout.write(a.join(' ') + '\n');
const fmtK = n => n >= 1e6 ? (n / 1e6).toFixed(2) + 'M' : n >= 1e3 ? Math.round(n / 1e3) + 'k' : String(n || 0);
const usd = n => '$' + (Number(n) || 0).toFixed(2);
function readMd(f) {
  const s = read(f); const m = s.match(/^---\r?\n([\s\S]*?)\r?\n---\r?\n?([\s\S]*)$/);
  return m ? { fm: parseYaml(m[1]), body: m[2] } : { fm: {}, body: s };
}
function writeMd(f, fm, body) { write(f, `---\n${dumpYaml(fm)}---\n${(body || '').replace(/^\n+/, '')}`); }
function globRe(g, forCmd = false) {
  let r = '';
  for (let i = 0; i < g.length; i++) {
    const c = g[i];
    if (c === '*') {
      if (!forCmd && g[i + 1] === '*') { i++; if (g[i + 1] === '/') { i++; r += '(?:.*/)?'; } else r += '.*'; }
      else r += forCmd ? '.*' : '[^/]*';
    } else if (c === '?') r += forCmd ? '.' : '[^/]';
    else r += c.replace(/[.+^${}()|\\\[\]]/, '\\$&');
  }
  return new RegExp(forCmd ? r : `^${r}$`, 'i');
}
const matchPath = (globs, rel) => (globs || []).some(g => globRe(g).test(rel) || globRe(g).test(path.posix.basename(rel)));
const matchCmd = (globs, cmd) => (globs || []).some(g => globRe(g, true).test(cmd));
function git(root, args, opts = {}) {
  const r = spawnSync('git', ['-C', root, ...args], { encoding: 'utf8' });
  if (r.status !== 0 && !opts.ok) die(`git ${args.join(' ')} failed:\n${(r.stderr || r.stdout || '').trim()}`);
  return { out: (r.stdout || '').trim(), err: (r.stderr || '').trim(), ok: r.status === 0 };
}
function sh(cmd, cwd) { const r = spawnSync(cmd, { cwd, shell: true, encoding: 'utf8', timeout: 900000 }); return { ok: r.status === 0, out: `${r.stdout || ''}${r.stderr || ''}` }; }
function argsOf(argv) {
  const pos = [], opt = {};
  for (let i = 0; i < argv.length; i++) {
    const a = argv[i];
    if (a.startsWith('--')) { const k = a.slice(2); const nx = argv[i + 1]; if (nx !== undefined && !nx.startsWith('--')) { opt[k] = nx; i++; } else opt[k] = true; }
    else pos.push(a);
  }
  return { pos, opt };
}

/* ------------------------------ project --------------------------------- */
const DEFAULTS = {
  project: 'project', level: 0, store: 'vault', postgres: { url_env: 'ORC_DATABASE_URL' }, check: null, base_branch: 'main', engine: 'subagent',
  models: { control: 'inherit', scout: 'haiku', worker: { S: 'sonnet', M: 'sonnet', L: 'opus', chore: 'haiku' }, reviewer: 'opus' },
  review: { S: 'none', M: ['bug'], L: ['bug', 'proof', 'simplify'], max_fix_rounds: 2 },
  caps: { turns: { scout: 15, worker: 40, reviewer: 20 }, budget_usd: { S: 2, M: 8, L: 25 }, stall_minutes: 10 },
  forced_L: ['auth', 'login', 'password', 'payment', 'billing', 'stripe', 'delete', 'migration', 'secret', 'token'],
  pricing: { fable: { in: 10, out: 50, cache_read: 1 }, opus: { in: 4, out: 20, cache_read: 0.2 }, sonnet: { in: 2, out: 10, cache_read: 0.2 }, haiku: { in: 0.1, out: 0.5, cache_read: 0.01 } },
  lessons: { guide_cap_lines: 30, promote_to_guide_at: 2, promote_to_enforce_at: 3 },
  security: {
    secrets: ['**/.env*', '**/*secret*', '**/*credential*', '**/*.pem', '**/*.key', '**/id_rsa*'],
    destructive: ['git push --force*', 'git push -f*', 'git reset --hard*', 'git branch -D*', 'git clean -fd*', 'rm -rf *', 'DROP TABLE*', '*migrate reset*', 'TRUNCATE *'],
    production: ['vercel --prod*', 'npm publish*', 'ssh *', 'kubectl apply*', 'docker push*', 'fly deploy*', 'git push * production*'],
  },
};
function merge(a, b) { const o = { ...a }; for (const [k, v] of Object.entries(b || {})) o[k] = (v && typeof v === 'object' && !Array.isArray(v) && a?.[k] && typeof a[k] === 'object' && !Array.isArray(a[k])) ? merge(a[k], v) : v; return o; }
function findRoot(from = process.cwd()) {
  const r = spawnSync('git', ['-C', from, 'rev-parse', '--path-format=absolute', '--git-common-dir'], { encoding: 'utf8' });
  if (r.status === 0) { const main = path.dirname(r.stdout.trim()); if (exists(path.join(main, 'orc.yaml'))) return main; }
  let d = path.resolve(from);
  for (;;) { if (exists(path.join(d, 'orc.yaml'))) return d; const p = path.dirname(d); if (p === d) return null; d = p; }
}
function project(from) {
  const root = findRoot(from); if (!root) return null;
  const cfg = merge(DEFAULTS, parseYaml(read(path.join(root, 'orc.yaml'))));
  const v = path.join(root, 'vault'), o = path.join(root, '.orc');
  const P = { root, vault: v, tickets: path.join(v, 'Tickets'), lessons: path.join(v, 'Lessons'), reports: path.join(v, 'Reports'), templates: path.join(v, '_templates'), orc: o, state: path.join(o, 'state.json'), cache: path.join(o, 'cache'), wt: path.join(o, 'wt'), rules: path.join(root, '.claude', 'rules') };
  return { root, cfg, P };
}
const need = () => project() || die('No orc.yaml here. Run `orc init` in your project first.');
const loadState = P => { try { return JSON.parse(read(P.state)); } catch { return { active: null, tickets: {} }; } };
const saveState = (P, s) => write(P.state, JSON.stringify(s, null, 2));
const family = (m = '') => ['fable', 'opus', 'sonnet', 'haiku'].find(f => String(m).toLowerCase().includes(f)) || 'sonnet';
const costOf = (cfg, model, u) => { const p = cfg.pricing[family(model)] || { in: 0, out: 0, cache_read: 0 }; return ((u.in || 0) * p.in + (u.out || 0) * p.out + (u.cache_read || 0) * p.cache_read + (u.cache_write || 0) * p.in * 1.25) / 1e6; };
const tmpl = (P, name) => { const local = path.join(P.templates, name); return read(exists(local) ? local : path.join(PLUGIN_ROOT, 'templates', name)); };
const fill = (s, vars) => s.replace(/\{\{(\w+)\}\}/g, (_, k) => vars[k] ?? '');

/* ------------------------------ tickets --------------------------------- */
const ticketFiles = P => exists(P.tickets) ? fs.readdirSync(P.tickets).filter(f => /^T-\d+.*\.md$/.test(f) && !f.endsWith('.log.md')).sort() : [];
function ticketFrom(P, f) { const file = path.join(P.tickets, f); const { fm, body } = readMd(file); return { ...fm, body, file, log: file.replace(/\.md$/, '.log.md') }; }
const loadTickets = P => ticketFiles(P).map(f => ticketFrom(P, f));
function loadTicket(P, id) { const f = ticketFiles(P).find(f => f === `${id}.md` || f.startsWith(`${id}-`)); if (!f) die(`No ticket ${id}.`); return ticketFrom(P, f); }
function saveTicket(t) { const { body, file, log, ...fm } = t; writeMd(file, fm, body); }
const logEvent = (t, ev, msg) => append(t.log, `${stamp()}  ${ev.padEnd(11)} ${msg}\n`);
const lastLog = t => { try { return read(t.log).trim().split('\n').pop(); } catch { return ''; } };
function nextId(dir, prefix) { let n = 0; if (exists(dir)) for (const f of fs.readdirSync(dir)) { const m = f.match(new RegExp(`^${prefix}-(\\d+)`)); if (m) n = Math.max(n, +m[1]); } return `${prefix}-${String(n + 1).padStart(3, '0')}`; }
const reportDir = (P, id) => path.join(P.reports, id);
const setStatus = (t, status, msg) => { t.status = status; saveTicket(t); logEvent(t, status, msg || ''); };
const acList = t => [...(t.body || '').matchAll(/^- (AC\d+)\b\s*(.*)$/gm)].map(m => ({ id: m[1], text: m[2] }));
const sizeOf = (cfg, t) => (t.type === 'chore' ? 'chore' : (t.size || 'M'));
const workerModel = (cfg, t) => cfg.models.worker[sizeOf(cfg, t)] || 'sonnet';
const forcedL = (cfg, text) => (cfg.forced_L || []).some(w => new RegExp(`\\b${w}`, 'i').test(text));

/* ------------------------------ lessons --------------------------------- */
function loadLessons(P) {
  const out = [];
  for (const [dir, shipped] of [[path.join(PLUGIN_ROOT, 'lessons'), true], [P.lessons, false]]) {
    if (!exists(dir)) continue;
    for (const f of fs.readdirSync(dir).filter(f => f.endsWith('.md')).sort()) {
      const { fm, body } = readMd(path.join(dir, f));
      const rule = body.trim().split('\n').find(l => l.trim()) || '';
      out.push({ id: fm.id || f.replace(/\.md$/, ''), tier: fm.tier || 'reference', scope: fm.scope || 'any', confidence: fm.confidence ?? 0.6, trigger_count: fm.trigger_count || 0, last_triggered: fm.last_triggered || null, check: fm.check || null, status: fm.status || 'active', rule, body, file: path.join(dir, f), shipped, fm });
    }
  }
  return out.filter(l => l.status === 'active');
}
const words = s => new Set(String(s).toLowerCase().replace(/[^a-z0-9 ]/g, ' ').split(/\s+/).filter(w => w.length > 2));
function similar(a, b) { const A = words(a), B = words(b); let n = 0; for (const w of A) if (B.has(w)) n++; return n / (A.size + B.size - n || 1); }
function lessonApplies(l, files, role) { if (l.scope === 'any' || l.scope === role) return true; if (['scout', 'worker', 'reviewer'].includes(l.scope)) return false; return (files || []).some(f => globRe(l.scope).test(posix(f))); }
function addLesson(ctx, cand, origin) {
  const { P, cfg } = ctx; const all = loadLessons(P);
  const dup = all.find(l => similar(l.rule, cand.rule) >= 0.6);
  if (dup) { bump(ctx, dup, origin); return dup.id; }
  const id = nextId(P.lessons, 'L');
  const fm = { id, tier: 'reference', scope: cand.scope || 'any', confidence: Number(cand.confidence) || 0.6, trigger_count: 1, last_triggered: now().slice(0, 10), check: cand.check || null, status: 'active', origin: origin || 'review' };
  writeMd(path.join(P.lessons, `${id}-${slug(cand.rule)}.md`), fm, `${cand.rule}\n${cand.trigger ? `\nSeen: ${cand.trigger}\n` : ''}`);
  return id;
}
function bump(ctx, l, origin) {
  if (l.shipped) { // copy into the vault so it can be promoted
    const fm = { ...l.fm, trigger_count: (l.trigger_count || 0) + 1, last_triggered: now().slice(0, 10), origin: l.fm.origin || 'shipped' };
    writeMd(path.join(ctx.P.lessons, path.basename(l.file)), fm, l.body); l = { ...l, ...fm, file: path.join(ctx.P.lessons, path.basename(l.file)), shipped: false };
  } else { l.fm.trigger_count = l.trigger_count = (l.trigger_count || 0) + 1; l.fm.last_triggered = now().slice(0, 10); writeMd(l.file, l.fm, l.body); }
  if (origin) append(l.file, `Seen: ${origin}\n`);
  promote(ctx, l);
}
function promote(ctx, l) {
  const { cfg, P } = ctx; const { fm } = readMd(l.file);
  if (fm.tier === 'reference' && fm.trigger_count >= cfg.lessons.promote_to_guide_at) { setTier(ctx, l.id, 'guide'); }
  else if (fm.tier === 'guide' && fm.check && fm.trigger_count >= cfg.lessons.promote_to_enforce_at) { setTier(ctx, l.id, 'enforce'); }
}
function setTier(ctx, id, tier) {
  const { P, cfg } = ctx; const l = loadLessons(P).find(x => x.id === id) || die(`No lesson ${id}`);
  let file = l.file;
  if (l.shipped) { file = path.join(P.lessons, path.basename(l.file)); writeMd(file, l.fm, l.body); }
  const { fm, body } = readMd(file); fm.tier = tier; writeMd(file, fm, body);
  const rf = path.join(P.rules, `orc-${slug(l.scope === 'any' ? 'general' : l.scope)}.md`);
  let lines = exists(rf) ? read(rf).split('\n') : [];
  lines = lines.filter(x => !x.includes(`(${id})`));
  if (tier === 'guide' || tier === 'enforce') {
    const head = lines.find(x => x.startsWith('---')) ? [] : ['---', `paths: [${JSON.stringify(/[*/]/.test(l.scope) ? l.scope : '**/*')}]`, '---', `# Rules learned for ${l.scope}`, ''];
    const rules = lines.filter(x => x.startsWith('- '));
    rules.push(`- ${l.rule} (${id})`);
    while (rules.length > cfg.lessons.guide_cap_lines) { const dropped = rules.shift(); const did = dropped.match(/\((L-\d+)\)/)?.[1]; if (did) { const d = loadLessons(P).find(x => x.id === did); if (d && !d.shipped) { const r = readMd(d.file); r.fm.tier = 'reference'; writeMd(d.file, r.fm, r.body); } } }
    const base = lines.length ? lines.filter(x => !x.startsWith('- ')) : head;
    write(rf, [...base, ...rules].join('\n').replace(/\n{3,}/g, '\n\n') + '\n');
  } else write(rf, lines.join('\n'));
  say(`${id} → ${tier}${tier !== 'reference' ? ` · ${posix(path.relative(P.root, rf))}` : ''}`);
}
function lessonsFromFile(file) {
  const m = read(file).match(/```lessons\s*\n([\s\S]*?)```/); if (!m) return [];
  try { const v = JSON.parse(m[1]); return Array.isArray(v) ? v : []; } catch { return []; }
}

/* ------------------------------ commands -------------------------------- */
function cmdInit(opt) {
  const root = process.cwd();
  if (!git(root, ['rev-parse', '--is-inside-work-tree'], { ok: true }).ok) { git(root, ['init', '-q']); say('git repository created'); }
  const base = git(root, ['rev-parse', '--abbrev-ref', 'HEAD'], { ok: true }).out || 'main';
  const check = exists(path.join(root, 'package.json')) && JSON.parse(read(path.join(root, 'package.json'))).scripts?.test ? 'npm test'
    : exists(path.join(root, 'pyproject.toml')) || exists(path.join(root, 'pytest.ini')) ? 'pytest -q'
    : exists(path.join(root, 'go.mod')) ? 'go test ./...' : exists(path.join(root, 'Cargo.toml')) ? 'cargo test' : null;
  const yml = path.join(root, 'orc.yaml');
  if (!exists(yml)) write(yml, fill(read(path.join(PLUGIN_ROOT, 'templates', 'orc.yaml')), { name: path.basename(root), check: check ?? 'null', base: base === 'HEAD' ? 'main' : base, store: opt.store || 'vault' }));
  for (const d of ['vault/Tickets', 'vault/Lessons', 'vault/Reports', 'vault/_templates', '.orc/cache', '.claude/rules']) fs.mkdirSync(path.join(root, d), { recursive: true });
  for (const f of ['ticket.md']) { const t = path.join(root, 'vault/_templates', f); if (!exists(t)) fs.copyFileSync(path.join(PLUGIN_ROOT, 'templates', f), t); }
  const gi = path.join(root, '.gitignore'); const giLines = exists(gi) ? read(gi) : '';
  if (!giLines.includes('.orc/')) append(gi, `${giLines && !giLines.endsWith('\n') ? '\n' : ''}# orc\n.orc/\n`);
  const sj = path.join(root, '.claude', 'settings.json'); let settings = {}; try { settings = JSON.parse(read(sj)); } catch {}
  settings.permissions = settings.permissions || {}; settings.permissions.deny = settings.permissions.deny || [];
  for (const g of DEFAULTS.security.secrets) { const rule = `Read(${g})`; if (!settings.permissions.deny.includes(rule)) settings.permissions.deny.push(rule); }
  write(sj, JSON.stringify(settings, null, 2) + '\n');
  const cm = path.join(root, 'CLAUDE.md'); const block = read(path.join(PLUGIN_ROOT, 'templates', 'claude-md-block.md'));
  if (!exists(cm) || !read(cm).includes('<!-- orc:start -->')) append(cm, (exists(cm) && !read(cm).endsWith('\n') ? '\n' : '') + block);
  const ctx = project(root); saveState(ctx.P, loadState(ctx.P)); cmdBoard(ctx, true);
  say(`orc ${VERSION} initialised in ${root}`);
  say(`  orc.yaml          check: ${check ?? 'none (each ticket must add a smoke check)'} · base branch: ${base}`);
  say('  vault/            Tickets, Lessons, Reports, Home.md, Board.md, Dashboard.html');
  say('  .claude/          settings.json deny rules for secrets · rules/ for learned guides');
  say('  CLAUDE.md         block appended: route build requests to /orc');
  say('Next: describe a change with  /orc <what you want>');
}

function cmdNew(ctx, pos, opt) {
  const { P, cfg } = ctx; const title = pos.join(' ').trim() || die('orc new "<title>"');
  const id = nextId(P.tickets, 'T'); const type = opt.type || 'feature';
  let size = opt.size || (type === 'chore' ? 'S' : 'M'); if (forcedL(cfg, title)) size = 'L';
  const file = path.join(P.tickets, `${id}-${slug(title)}.md`);
  write(file, fill(tmpl(P, 'ticket.md'), { id, title, size, type, created: now() }));
  const t = loadTicket(P, id); logEvent(t, 'created', `${type} · size ${size}${forcedL(cfg, title) ? ' (forced: sensitive domain)' : ''}`);
  const s = loadState(P); s.active = id; s.tickets[id] = { round: 0 }; saveState(P, s);
  say(`${id}  ${title}  (${type}, size ${size})`); say(`spec: ${posix(path.relative(P.root, file))}`);
}

function cmdTicket(ctx, pos) {
  const { P } = ctx; const [sub, id, ...rest] = pos;
  if (sub === 'list' || !sub) { for (const t of loadTickets(P)) say(`${t.id}  ${String(t.status).padEnd(10)} ${String(t.size || '-').padEnd(2)} ${usd(t.cost_usd).padStart(7)}  ${t.title}`); return; }
  const t = loadTicket(P, id);
  if (sub === 'show') { say(read(t.file)); return; }
  if (sub === 'set') { for (const kv of rest) { const i = kv.indexOf('='); if (i < 0) continue; t[kv.slice(0, i)] = parseScalar(kv.slice(i + 1)); } saveTicket(t); logEvent(t, 'set', rest.join(' ')); say(`${id} updated`); return; }
  if (sub === 'log') { say(exists(t.log) ? read(t.log) : '(no log)'); return; }
  die('orc ticket list | show T-001 | set T-001 key=value | log T-001');
}

function cmdReady(ctx) {
  const ts = loadTickets(ctx.P); const merged = new Set(ts.filter(t => t.status === 'merged').map(t => t.id));
  const ready = ts.filter(t => ['queued', 'asking'].includes(t.status) && (t.depends_on || []).every(d => merged.has(d)));
  if (!ready.length) say('nothing ready'); for (const t of ready) say(`${t.id}  ${t.size}  ${t.title}`);
}
function cmdNeedsYou(ctx) { const ts = loadTickets(ctx.P).filter(t => t.status === 'needs-you'); if (!ts.length) say('nothing is waiting on you'); for (const t of ts) say(`${t.id}  ${t.title}\n      ${lastLog(t).replace(/^\S+ \S+\s+\S+\s+/, '')}\n      resume with: orc resume ${t.id}`); }
function statusLines(ctx) {
  const ts = loadTickets(ctx.P); const wk = Date.now() - 7 * 864e5;
  const fly = ts.filter(t => ['building', 'checking', 'reviewing', 'fixing', 'asking'].includes(t.status));
  const ny = ts.filter(t => t.status === 'needs-you'); const m7 = ts.filter(t => t.status === 'merged' && Date.parse(t.merged) > wk);
  const merged = new Set(ts.filter(t => t.status === 'merged').map(t => t.id));
  const ready = ts.filter(t => t.status === 'queued' && (t.depends_on || []).every(d => merged.has(d)));
  return [`orc · ${ctx.cfg.project} · store ${ctx.cfg.store}`,
    `in flight   ${fly.length ? fly.map(t => `${t.id} ${t.status} (${t.size})`).join(' · ') : 'nothing'}`,
    `needs-you   ${ny.length ? ny.map(t => `${t.id}: ${lastLog(t).replace(/^\S+ \S+\s+\S+\s+/, '')}`).join(' · ') : 'nothing'}`,
    `merged 7d   ${m7.length} tickets · ${usd(m7.reduce((a, t) => a + (+t.cost_usd || 0), 0))}`,
    `ready       ${ready.length ? ready.map(t => t.id).join(', ') : 'nothing'}`];
}

function cmdScout(ctx, id, opt) {
  const { P, cfg } = ctx; const t = loadTicket(P, id);
  if (opt.record) {
    const rf = path.join(reportDir(P, id), 'scout.md'); if (!exists(rf)) die(`no ${posix(path.relative(P.root, rf))} yet`);
    const { fm } = readMd(rf); if (fm.size && !forcedL(cfg, t.title + ' ' + (fm.files || []).join(' '))) t.size = fm.size; else if (forcedL(cfg, t.title)) t.size = 'L';
    t.files = fm.files || []; saveTicket(t); logEvent(t, 'scouted', `size ${t.size} · ${t.files.length} files · ${(fm.lessons || []).length} lessons`);
    say(`${id} size ${t.size} · files: ${t.files.join(', ') || 'none'}`); if (fm.questions?.length) say(`suggested questions:\n- ${fm.questions.join('\n- ')}`);
    return;
  }
  const files = git(P.root, ['ls-files'], { ok: true }).out.split('\n').filter(f => f && !f.startsWith('vault/') && !f.startsWith('.orc/')).slice(0, 400);
  const lessons = loadLessons(P).filter(l => !['scout', 'reviewer'].includes(l.scope)).slice(0, 80).map(l => `- ${l.id} · ${l.scope} · ${l.rule}`).join('\n');
  const prompt = `# Scout ${id} · ${t.title}\nYou are read-only. Write exactly one file: ${posix(path.join(reportDir(P, id), 'scout.md'))}\n\nRequest / goal:\n${t.body.trim()}\n\n## Repo files (git ls-files, first 400)\n${files.join('\n')}\n\n## Lessons available (pick those that apply to this ticket)\n${lessons || '(none)'}\n\n## Size rules\nS: one file, text/config/style, no new behavior · M: up to five files, one behavior, no schema/auth/payments/deletion · L: anything else\n\n## Output\nFrontmatter: size (S|M|L), files (list of repo paths the worker must touch or read), lessons (list of lesson ids), questions (0-3 outcome-level questions a non-engineer can answer, only if the answer changes the build).\nBody: what exists already, what is missing, risks. Under 40 lines.\n`;
  const pf = path.join(P.cache, `${id}.scout.md`); write(pf, prompt); setStatus(t, 'asking', 'scout dispatched');
  say(`prompt: ${posix(path.relative(P.root, pf))}\nrun Agent(subagent_type: "orc:scout", model: "${cfg.models.scout}", prompt: <that file>) then  orc scout ${id} --record`);
}

function cmdDispatch(ctx, id, opt) {
  const { P, cfg } = ctx; const t = loadTicket(P, id); const base = cfg.base_branch;
  const branch = `orc/${id}`; const wt = path.join(P.wt, id);
  if (!git(P.root, ['rev-parse', '--verify', '-q', branch], { ok: true }).ok) git(P.root, ['branch', branch, base]);
  if (!exists(wt)) git(P.root, ['worktree', 'add', wt, branch]);
  const s = loadState(P); s.active = id; const round = (s.tickets[id]?.round || 0) + 1; s.tickets[id] = { ...(s.tickets[id] || {}), worktree: wt, branch, round }; saveState(P, s);
  const model = opt.model || workerModel(cfg, t); const files = t.files || [];
  const lessons = loadLessons(P).filter(l => lessonApplies(l, files, 'worker') && l.tier !== 'enforce').slice(0, 25).map(l => `- ${l.rule} (${l.id})`).join('\n');
  const findings = latestReport(P, id, /^review-\d+\.md$/); const checks = path.join(reportDir(P, id), 'checks.md');
  const decisions = (t.decisions || []).map(d => `- ${d.q} → ${d.a}${d.default_used ? ' (default)' : ''}`).join('\n');
  const prompt = `# Build ${id} · ${t.title} · size ${t.size} · round ${round}\nWork ONLY inside this directory and run every command there: ${wt}\nBranch: ${branch}. Never touch ${base}; orc merges. Never edit files under vault/Tickets. Prefix scratch files with ${id}-.\n\n## Spec\n${t.body.trim()}\n${decisions ? `\n## Decisions already made\n${decisions}\n` : ''}${files.length ? `\n## Files the scout found relevant\n${files.map(f => '- ' + f).join('\n')}\n` : ''}${lessons ? `\n## Lessons that apply\n${lessons}\n` : ''}${findings ? `\n## Last review findings (fix these)\n${read(findings)}\n` : ''}${exists(checks) ? `\n## Last check output\n${read(checks).slice(-3000)}\n` : ''}
## How to work
1. Run the check first and note the baseline: ${cfg.check || '(no check command; add one small smoke check for this behavior)'}
2. Build. Commit per acceptance criterion on ${branch}; message "${id}: ...". Add files by name, never \`git add -A\`.
3. Proof, not claims: for every acceptance criterion paste the command you ran and its output into vault/Reports/${id}/work.md (inside the worktree) under "## Proof". A new check must be watched to fail before it passes.
4. Need a secret, an account, or a decision only the user can make? Write it under "## Needs you" in work.md and stop. Never read or print secret values.
5. Finish work.md with: ## What changed (plain words) · ## Proof · ## Needs you · ## Lesson candidates (\`\`\`lessons JSON list of {rule, scope, trigger, check, confidence}\`\`\`).
`;
  const pf = path.join(P.cache, `${id}.build.md`); write(pf, prompt);
  t.branch = branch; t.models = { ...(t.models || {}), worker: model }; t.base_sha = git(P.root, ['rev-parse', base]).out; setStatus(t, 'building', `round ${round} · worker ${model} · worktree ${posix(path.relative(P.root, wt))} · cap ${cfg.caps.turns.worker} turns · ${usd(cfg.caps.budget_usd[t.size] || 8)}`);
  say(`prompt: ${posix(path.relative(P.root, pf))}\nrun Agent(subagent_type: "orc:worker", model: "${model}", prompt: <that file>) then  orc check ${id}`);
}
function latestReport(P, id, re) { const d = reportDir(P, id); if (!exists(d)) return null; const fs_ = fs.readdirSync(d).filter(f => re.test(f)).sort((a, b) => (+a.match(/\d+/)?.[0] || 0) - (+b.match(/\d+/)?.[0] || 0)); return fs_.length ? path.join(d, fs_.pop()) : null; }
function wtOf(ctx, t) { const s = loadState(ctx.P); const wt = s.tickets[t.id]?.worktree; return wt && exists(wt) ? wt : null; }

function cmdCheck(ctx, id) {
  const { P, cfg } = ctx; const t = loadTicket(P, id); const cwd = wtOf(ctx, t) || P.root;
  const cmds = []; if (cfg.check) cmds.push(cfg.check);
  for (const l of loadLessons(P).filter(l => l.tier === 'enforce' && l.check)) cmds.push(l.check);
  let out = '', ok = true;
  for (const c of cmds) { const r = sh(c, cwd); out += `$ ${c}\n${r.out}\n`; if (!r.ok) { ok = false; break; } }
  const status = cmds.length ? (ok ? 'pass' : 'fail') : 'none';
  write(path.join(reportDir(P, id), 'checks.md'), `# Checks · ${id} · ${status} · ${stamp()}\n\n\`\`\`\n${out.slice(-8000) || 'no check command configured'}\n\`\`\`\n`);
  t.checks = status; saveTicket(t); logEvent(t, 'checked', `${status}${cmds.length ? ` · ${cmds.length} command(s)` : ' · no check command'}`);
  say(`${id} checks: ${status}`);
  if (status === 'fail') { const s = loadState(P); const r = s.tickets[id]?.round || 1; say(r < cfg.review.max_fix_rounds + 1 ? `re-run the worker:  orc dispatch ${id}` : `too many failed rounds → orc ticket set ${id} status=needs-you`); }
  else say(reviewNeeded(cfg, t) ? `next:  orc review ${id}` : `next:  orc merge ${id}`);
}
const reviewNeeded = (cfg, t) => { const r = cfg.review[sizeOf(cfg, t)]; return Array.isArray(r) && r.length > 0; };

function cmdReview(ctx, id, opt) {
  const { P, cfg } = ctx; const t = loadTicket(P, id); const wt = wtOf(ctx, t) || die(`${id} has no worktree; dispatch first`);
  if (opt.record) {
    const rf = latestReport(P, id, /^review-\d+\.md$/) || die('no review report yet'); const { fm } = readMd(rf);
    t.review_rounds = (t.review_rounds || 0) + 1;
    const cands = lessonsFromFile(rf); const ids = cands.map(c => addLesson(ctx, c, `${id} review`));
    if (String(fm.verdict).toLowerCase() === 'pass') { setStatus(t, 'checking', `review ${t.review_rounds} pass${ids.length ? ` · lessons ${ids.join(', ')}` : ''}`); say(`${id} review passed · next:  orc merge ${id}`); }
    else if (t.review_rounds > cfg.review.max_fix_rounds) { setStatus(t, 'needs-you', `review ${t.review_rounds} still failing after ${cfg.review.max_fix_rounds} fix rounds · see ${posix(path.relative(P.root, rf))}`); say(`${id} → needs-you`); }
    else { setStatus(t, 'fixing', `review ${t.review_rounds} fail · ${fm.failing || ''}`); say(`${id} review failed · next:  orc dispatch ${id}  (fix round)`); }
    return;
  }
  const n = (t.review_rounds || 0) + 1; const passes = cfg.review[sizeOf(cfg, t)];
  const diff = git(wt, ['diff', `${t.base_sha || cfg.base_branch}...HEAD`, '--stat'], { ok: true }).out; const full = git(wt, ['diff', `${t.base_sha || cfg.base_branch}...HEAD`], { ok: true }).out;
  const checks = path.join(reportDir(P, id), 'checks.md'); const work = path.join(wt, 'vault', 'Reports', id, 'work.md');
  const prompt = `# Review ${id} · ${t.title} · round ${n} · passes: ${passes.join(', ')}\nYou are read-only. Never edit code, never commit. Write exactly one file: ${posix(path.join(reportDir(P, id), `review-${n}.md`))}\nThe code is in the worktree ${wt} (branch ${t.branch}). Run commands there to verify.\n\n## Spec\n${t.body.trim()}\n\n## Diff stat\n${diff}\n\n## Diff\n${full.length > 60000 ? full.slice(0, 60000) + '\n[truncated; run git diff in the worktree]' : full}\n\n## Check output\n${exists(checks) ? read(checks).slice(-4000) : '(none)'}\n\n## Worker report\n${exists(work) ? read(work) : '(no work.md)'}\n\n## Passes\n${passes.includes('bug') ? '- bug: for each acceptance criterion, does the code do it? Look for the failure the worker did not test.\n' : ''}${passes.includes('proof') ? '- proof: re-run the verification commands from the spec yourself and quote the output. A claim without output is a fail.\n' : ''}${passes.includes('simplify') ? '- simplify: name code that can be removed or shortened without changing behavior. Findings only.\n' : ''}
## Output format (frontmatter then body)
---
ticket: ${id}
round: ${n}
verdict: pass | fail
failing: "AC ids that fail, comma separated, or empty"
---
## Acceptance criteria
- AC1 ✓|✗ one line why
## Findings
numbered, each with file:line and what to change
## Proof
commands you ran and their output
## Lessons
\`\`\`lessons
[{"rule": "Never ...", "scope": "src/x/**", "trigger": "what happened", "check": "optional command", "confidence": 0.8}]
\`\`\`
`;
  const pf = path.join(P.cache, `${id}.review.md`); write(pf, prompt); t.models = { ...(t.models || {}), reviewer: cfg.models.reviewer }; setStatus(t, 'reviewing', `round ${n} · reviewer ${cfg.models.reviewer} · ${passes.join('+')}`);
  say(`prompt: ${posix(path.relative(P.root, pf))}\nrun Agent(subagent_type: "orc:reviewer", model: "${cfg.models.reviewer}", prompt: <that file>) then  orc review ${id} --record`);
}

function cmdMerge(ctx, id) {
  const { P, cfg } = ctx; const t = loadTicket(P, id); const wt = wtOf(ctx, t) || die(`${id} has no worktree`); const base = cfg.base_branch;
  const cur = git(P.root, ['rev-parse', '--abbrev-ref', 'HEAD']).out; if (cur !== base) die(`Main checkout is on ${cur}; switch to ${base} first.`);
  const rb = git(wt, ['rebase', base], { ok: true }); if (!rb.ok) { git(wt, ['rebase', '--abort'], { ok: true }); setStatus(t, 'needs-you', `rebase onto ${base} conflicts: ${rb.err.split('\n')[0]}`); die(`${id} → needs-you (rebase conflict)`); }
  if (cfg.check) { const r = sh(cfg.check, wt); if (!r.ok) { write(path.join(reportDir(P, id), 'checks.md'), `# Checks · ${id} · fail after rebase\n\n\`\`\`\n${r.out.slice(-8000)}\n\`\`\`\n`); t.checks = 'fail'; setStatus(t, 'fixing', 'check failed after rebase'); die(`${id} check failed after rebase · orc dispatch ${id}`); } }
  const before = git(P.root, ['rev-parse', base]).out; const ff = git(P.root, ['merge', '--ff-only', t.branch], { ok: true }); if (!ff.ok) die(`fast-forward failed:\n${ff.err}`);
  const after = git(P.root, ['rev-parse', 'HEAD']).out;
  git(P.root, ['worktree', 'remove', '--force', wt], { ok: true }); git(P.root, ['branch', '-d', t.branch], { ok: true });
  t.merge_base = before; t.merge_sha = after; t.merged = now(); setStatus(t, 'merged', `${after.slice(0, 7)} · worktree removed`);
  const s = loadState(P); delete s.tickets[id]?.worktree; if (s.active === id) s.active = null; saveState(P, s);
  cmdBoard(ctx, true); say(`${id} merged ${after.slice(0, 7)} · undo with: orc undo ${id}`);
}
function cmdUndo(ctx, id) {
  const { P, cfg } = ctx; const t = loadTicket(P, id); if (t.status !== 'merged' || !t.merge_sha) die(`${id} is not merged`);
  const r = git(P.root, ['revert', '--no-edit', `${t.merge_base}..${t.merge_sha}`], { ok: true }); if (!r.ok) { git(P.root, ['revert', '--abort'], { ok: true }); die(`revert failed:\n${r.err}`); }
  setStatus(t, 'undone', `reverted ${t.merge_base.slice(0, 7)}..${t.merge_sha.slice(0, 7)}`);
  const nid = nextId(P.tickets, 'T'); const file = path.join(P.tickets, `${nid}-${slug('redo ' + t.title)}.md`);
  write(file, fill(tmpl(P, 'ticket.md'), { id: nid, title: `Redo: ${t.title}`, size: t.size, type: 'fix', created: now() }));
  const n = loadTicket(P, nid); n.depends_on = [id]; saveTicket(n); logEvent(n, 'created', `redo of ${id}`); cmdBoard(ctx, true);
  say(`${id} undone · ${nid} created for the redo (edit its spec or close it)`);
}
function cmdResume(ctx, id) { const t = loadTicket(ctx.P, id); if (t.status !== 'needs-you') die(`${id} is ${t.status}`); const s = loadState(ctx.P); s.active = id; saveState(ctx.P, s); setStatus(t, wtOf(ctx, t) ? 'fixing' : 'queued', 'resumed by user'); say(`${id} resumed · next: orc dispatch ${id}`); }
function cmdClose(ctx, id, opt) { const t = loadTicket(ctx.P, id); const wt = wtOf(ctx, t); if (wt) { git(ctx.P.root, ['worktree', 'remove', '--force', wt], { ok: true }); git(ctx.P.root, ['branch', '-D', t.branch], { ok: true }); } setStatus(t, opt.failed ? 'failed' : 'closed', opt.reason || ''); cmdBoard(ctx, true); say(`${id} ${t.status}`); }

function cmdDone(ctx, id) {
  const { P, cfg } = ctx; const t = loadTicket(P, id); const acs = acList(t); const rf = latestReport(P, id, /^review-\d+\.md$/);
  const verdicts = rf ? [...read(rf).matchAll(/^- (AC\d+)\s*(✓|✗)/gm)] : []; const ok = verdicts.filter(v => v[2] === '✓').length;
  const tok = Object.entries(t.tokens || {}).map(([r, n]) => `${r} ${t.models?.[r] || ''} ${fmtK(n)}`).join(' · ');
  const learned = (exists(t.log) ? [...read(t.log).matchAll(/lessons? (L-\d+(?:, L-\d+)*)/g)].map(m => m[1]) : []).join(', ');
  const W = 70; const line = (k, v) => `│ ${k.padEnd(14)} ${String(v).padEnd(W - 17)}│`;
  say(`┌ ${id} ${t.status} ${'─'.repeat(Math.max(1, W - id.length - String(t.status).length - 3))}┐`);
  say(line('What changed', t.summary || '(set with: orc ticket set ' + id + ' summary="...")'));
  (t.try_it || []).forEach((s, i) => say(line(i ? '' : 'Try it', `${i + 1}. ${s}`)));
  say(line('Checks', t.checks || 'none')); say(line('Review', rf ? `${ok} of ${acs.length || verdicts.length} criteria verified · ${t.review_rounds || 0} round(s)` : 'skipped (size ' + t.size + ')'));
  say(line('Cost', `${usd(t.cost_usd)}${tok ? ' · ' + tok : ''}`)); if (learned) say(line('Learned', learned));
  say(line('Undo', `orc undo ${id}`)); say(`└${'─'.repeat(W - 1)}┘`);
}

function cmdLessons(ctx, pos, opt) {
  const { P } = ctx; const [sub, a] = pos;
  if (!sub || sub === 'list') { for (const l of loadLessons(P)) say(`${l.id}  ${l.tier.padEnd(9)} ${String(l.trigger_count).padStart(2)}x  ${l.scope.padEnd(18)} ${l.rule.slice(0, 90)}${l.shipped ? '  (shipped)' : ''}`); return; }
  if (sub === 'add') { if (opt.from) { const c = lessonsFromFile(path.resolve(opt.from)); const ids = c.map(x => addLesson(ctx, x, opt.origin || posix(opt.from))); say(ids.length ? `filed: ${ids.join(', ')}` : 'no ```lessons block found'); return; } if (!opt.rule) die('orc lessons add --rule "Never ..." [--scope glob|worker] [--trigger ...] [--check cmd] [--confidence 0.8]'); say('filed: ' + addLesson(ctx, { rule: opt.rule, scope: opt.scope, trigger: opt.trigger, check: opt.check, confidence: opt.confidence }, opt.origin || 'manual')); return; }
  if (sub === 'reject') { const l = loadLessons(P).find(x => x.id === a) || die(`no ${a}`); if (l.tier !== 'reference') setTier(ctx, a, 'reference'); const f = l.shipped ? path.join(P.lessons, path.basename(l.file)) : l.file; const r = l.shipped ? { fm: l.fm, body: l.body } : readMd(f); r.fm.status = 'rejected'; writeMd(f, r.fm, r.body); say(`${a} rejected`); return; }
  if (sub === 'tier') { setTier(ctx, a, pos[2] || die('orc lessons tier L-001 reference|guide|enforce')); return; }
  if (sub === 'skill') { return cmdSkillFromLessons(ctx, a, opt); }
  die('orc lessons list | add | reject L-001 | tier L-001 <tier> | skill <scope> --name <name>');
}
function cmdSkillFromLessons(ctx, scope, opt) {
  const { P } = ctx; if (!scope) die('orc lessons skill <scope> --name <name>');
  const ls = loadLessons(P).filter(l => l.scope === scope || (scope !== 'any' && l.scope.startsWith(scope)));
  if (!ls.length) die(`no lessons with scope ${scope}`);
  const name = slug(opt.name || `orc-${scope.replace(/[*/]+/g, ' ').trim()}`); const dir = path.join(P.root, '.claude', 'skills', name);
  const checks = ls.filter(l => l.check).map(l => `- \`${l.check}\`  (${l.id})`);
  const body = `---\nname: ${name}\ndescription: Rules learned while working on ${scope}. Use before editing files under ${scope}.\n${/[*/]/.test(scope) ? `paths: [${JSON.stringify(scope)}]\n` : ''}user-invocable: false\n---\n# ${name}\n\nGenerated by orc from ${ls.length} lessons on ${now().slice(0, 10)}. Refine with /orc-skill-creator ${name}.\n\n## Never\n${ls.map(l => `- ${l.rule} (${l.id}, seen ${l.trigger_count}x)`).join('\n')}\n${checks.length ? `\n## Checks to run before saying done\n${checks.join('\n')}\n` : ''}`;
  write(path.join(dir, 'SKILL.md'), body); say(`${posix(path.relative(P.root, dir))}/SKILL.md written from ${ls.length} lessons · refine with /orc-skill-creator ${name}`);
}

function cmdCost(ctx, pos, opt) {
  const ts = loadTickets(ctx.P); const wk = Date.now() - 7 * 864e5;
  const sel = pos[0] ? ts.filter(t => t.id === pos[0]) : opt.week ? ts.filter(t => Date.parse(t.merged || t.created) > wk) : ts;
  let tot = 0; for (const t of sel) { tot += +t.cost_usd || 0; say(`${t.id}  ${usd(t.cost_usd).padStart(7)}  ${Object.entries(t.tokens || {}).map(([r, n]) => `${r} ${fmtK(n)}`).join(' · ')}  ${t.title}`); }
  say(`total  ${usd(tot)}`);
}
function cmdModels(ctx) {
  const ts = loadTickets(ctx.P).filter(t => t.status === 'merged'); const g = {};
  for (const t of ts) { const k = `${family(t.models?.worker)} on ${t.size}`; (g[k] = g[k] || []).push(t); }
  if (!Object.keys(g).length) return say('no merged tickets yet');
  for (const [k, v] of Object.entries(g)) say(`${k.padEnd(14)} ${v.length} tickets · ${(v.reduce((a, t) => a + (+t.review_rounds || 0), 0) / v.length).toFixed(1)} review rounds · ${usd(v.reduce((a, t) => a + (+t.cost_usd || 0), 0) / v.length)} avg`);
  for (const size of ['S', 'M', 'L']) { const s = g[`sonnet on ${size}`], o = g[`opus on ${size}`]; if (s && o) { const rs = s.reduce((a, t) => a + (+t.review_rounds || 0), 0) / s.length, ro = o.reduce((a, t) => a + (+t.review_rounds || 0), 0) / o.length; say(`→ ${rs <= ro + 0.5 ? `keep sonnet on ${size}` : `consider opus on ${size}: sonnet needs ${rs.toFixed(1)} rounds vs ${ro.toFixed(1)}`}`); } }
}
function cmdStore(ctx, pos) {
  const { cfg, P } = ctx; const [sub] = pos;
  if (!sub || sub === 'status') return say(`store: ${cfg.store}${cfg.store === 'postgres' ? ` · url from $${cfg.postgres.url_env}` : ' · vault/'}`);
  if (sub === 'migrate' || sub === 'postgres') {
    const url = process.env[cfg.postgres.url_env]; if (!url) die(`${cfg.postgres.url_env} is not set. Put it in your shell, not in a file an agent can read. Then run again.`);
    const r = spawnSync('psql', [url, '-v', 'ON_ERROR_STOP=1', '-q', '-f', path.join(PLUGIN_ROOT, 'storage', 'schema.sql')], { encoding: 'utf8' });
    if (r.status !== 0) die(`psql failed:\n${r.stderr}`);
    if (sub === 'postgres') { const y = path.join(P.root, 'orc.yaml'); write(y, read(y).replace(/^store:.*$/m, 'store: postgres')); }
    say('applied 0001_initial' + (sub === 'postgres' ? ' · store: postgres (mirror and import arrive in v0.2; the vault stays the working copy until then)' : ''));
    return;
  }
  die('orc store status | migrate | postgres');
}
function cmdDoctor(ctx) {
  const ok = (c, m) => say(`${c ? '✓' : '✗'} ${m}`);
  ok(+process.versions.node.split('.')[0] >= 20, `node ${process.versions.node}`);
  ok(spawnSync('git', ['--version']).status === 0, 'git'); ok(spawnSync(process.platform === 'win32' ? 'where' : 'which', ['claude']).status === 0, 'claude on PATH');
  ok(!!ctx, 'orc.yaml found'); if (!ctx) return;
  ok(exists(ctx.P.vault), 'vault/'); ok(!!ctx.cfg.check, `check command: ${ctx.cfg.check || 'none (tickets must add smoke checks)'}`);
  const wts = git(ctx.P.root, ['worktree', 'list'], { ok: true }).out.split('\n').length - 1; ok(true, `${wts} worktree(s) open`);
  if (ctx.cfg.store === 'postgres') ok(spawnSync('psql', ['--version']).status === 0, 'psql on PATH');
}
function cmdExplain(pos) {
  const doc = read(path.join(PLUGIN_ROOT, 'explain.md')); const blocks = [...doc.matchAll(/```\n(\$ orc explain(?: (\w+))?\n[\s\S]*?)\n```/g)];
  const topic = pos[0]; const b = blocks.find(x => (x[2] || '') === (topic || '')); if (!b) { say(`unknown topic ${topic}. topics: ${blocks.map(x => x[2]).filter(Boolean).join(', ')}`); return; }
  say(b[1]);
}

/* ------------------------------ board ----------------------------------- */
function cmdBoard(ctx, quiet) {
  const { P, cfg } = ctx; const ts = loadTickets(P); const ls = loadLessons(P); const gen = stamp();
  const cols = ['queued', 'asking', 'building', 'checking', 'reviewing', 'fixing', 'needs-you', 'merged', 'undone', 'failed', 'closed'];
  const by = s => ts.filter(t => t.status === s);
  let board = `# Board · ${cfg.project} · ${gen}\n\n`;
  for (const c of cols) { const v = by(c); if (!v.length && !['queued', 'building', 'needs-you', 'merged'].includes(c)) continue; board += `## ${c} (${v.length})\n${v.map(t => `- [[${path.basename(t.file, '.md')}|${t.id}]] ${t.title} · ${t.size || '-'} · ${usd(t.cost_usd)}`).join('\n') || '- (none)'}\n\n`; }
  write(path.join(P.vault, 'Board.md'), board);
  const st = statusLines(ctx);
  write(path.join(P.vault, 'Home.md'), `# ${cfg.project}\n\n\`\`\`\n${st.join('\n')}\n\`\`\`\n\n- [[Board]] · [Dashboard](Dashboard.html) · [[Decisions]]\n- Tickets: ${ts.length} · Lessons: ${ls.length} (${ls.filter(l => l.tier === 'guide').length} guide, ${ls.filter(l => l.tier === 'enforce').length} enforce)\n\n## Needs you\n${by('needs-you').map(t => `- [[${path.basename(t.file, '.md')}|${t.id}]] ${lastLog(t).replace(/^\S+ \S+\s+\S+\s+/, '')}`).join('\n') || '- nothing'}\n\n_generated by orc ${gen}_\n`);
  write(path.join(P.vault, 'Decisions.md'), `# Decisions\n\n${ts.flatMap(t => (t.decisions || []).map(d => `- **${t.id}** ${d.q} → ${d.a}${d.default_used ? ' _(default)_' : ''}`)).join('\n') || '- none yet'}\n`);
  const data = { project: cfg.project, generated: gen, status: st, tickets: ts.map(t => ({ id: t.id, title: t.title, status: t.status, size: t.size, type: t.type, cost: +t.cost_usd || 0, rounds: t.review_rounds || 0, checks: t.checks, summary: t.summary, try_it: t.try_it || [], decisions: t.decisions || [], tokens: t.tokens || {}, models: t.models || {}, created: t.created, merged: t.merged, acs: acList(t), log: exists(t.log) ? read(t.log).trim().split('\n').slice(-25) : [] })), lessons: ls.map(l => ({ id: l.id, tier: l.tier, scope: l.scope, count: l.trigger_count, rule: l.rule, shipped: l.shipped })), cost: costByModel(ts, cfg) };
  write(path.join(P.vault, 'Dashboard.html'), dashboardHtml(data));
  if (!quiet) say(`vault/Board.md, Home.md, Decisions.md, Dashboard.html regenerated`);
}
function costByModel(ts, cfg) { const g = {}; for (const t of ts) for (const [role, u] of Object.entries(t.usage || {})) { const k = `${role} · ${family(u.model || t.models?.[role])}`; g[k] = g[k] || { tickets: 0, tokens: 0, cost: 0, rounds: 0 }; g[k].tickets++; g[k].tokens += (u.in || 0) + (u.out || 0); g[k].cost += costOf(cfg, u.model || t.models?.[role], u); g[k].rounds += +t.review_rounds || 0; } return Object.entries(g).map(([k, v]) => ({ k, ...v })); }
function dashboardHtml(d) {
  return `<!doctype html><html lang="en"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><title>${esc(d.project)} · orc</title>
<style>:root{--bg:#fafaf9;--fg:#1c1917;--mut:#78716c;--card:#fff;--line:#e7e5e4;--acc:#2563eb;--warn:#b45309;--ok:#15803d;--bad:#b91c1c}@media(prefers-color-scheme:dark){:root{--bg:#0c0a09;--fg:#f5f5f4;--mut:#a8a29e;--card:#1c1917;--line:#292524;--acc:#60a5fa;--warn:#fbbf24;--ok:#4ade80;--bad:#f87171}}
*{box-sizing:border-box}body{margin:0;background:var(--bg);color:var(--fg);font:14px/1.45 ui-sans-serif,system-ui,sans-serif}header{padding:14px 16px;border-bottom:1px solid var(--line);display:flex;gap:16px;align-items:baseline;flex-wrap:wrap}h1{font-size:18px;margin:0}small{color:var(--mut)}nav{display:flex;gap:4px;padding:8px 16px;border-bottom:1px solid var(--line);flex-wrap:wrap}nav button{background:none;border:1px solid var(--line);color:var(--fg);padding:6px 12px;border-radius:6px;cursor:pointer}nav button.on{background:var(--acc);color:#fff;border-color:var(--acc)}main{padding:16px}.cols{display:grid;grid-template-columns:repeat(auto-fit,minmax(170px,1fr));gap:10px}.col h3{margin:0 0 6px;font-size:12px;text-transform:uppercase;color:var(--mut)}.card{background:var(--card);border:1px solid var(--line);border-radius:8px;padding:8px 10px;margin-bottom:8px;cursor:pointer}.card b{display:block}.card.ny{border-color:var(--warn)}pre{background:var(--card);border:1px solid var(--line);border-radius:8px;padding:10px;overflow:auto;white-space:pre-wrap}table{border-collapse:collapse;width:100%}td,th{text-align:left;padding:6px 8px;border-bottom:1px solid var(--line);vertical-align:top}th{color:var(--mut);font-weight:500}.tag{display:inline-block;padding:1px 6px;border-radius:4px;border:1px solid var(--line);font-size:12px;color:var(--mut)}.ok{color:var(--ok)}.bad{color:var(--bad)}.hide{display:none}#detail{max-width:860px}</style></head>
<body><header><h1>${esc(d.project)}</h1><small>orc · generated ${esc(d.generated)}</small></header>
<nav><button data-v="board" class="on">Board</button><button data-v="tickets">Tickets</button><button data-v="cost">Cost</button><button data-v="lessons">Lessons</button><button data-v="health">Health</button></nav>
<main><section id="board"></section><section id="tickets" class="hide"></section><section id="cost" class="hide"></section><section id="lessons" class="hide"></section><section id="health" class="hide"></section><section id="detail" class="hide"></section></main>
<script>const D=${JSON.stringify(d)};const $=s=>document.querySelector(s);const esc=s=>String(s??'').replace(/[&<>"]/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;'}[c]));const usd=n=>'$'+(+n||0).toFixed(2);
const COLS=['queued','asking','building','checking','reviewing','fixing','needs-you','merged'];
function show(v){document.querySelectorAll('nav button').forEach(b=>b.classList.toggle('on',b.dataset.v===v));document.querySelectorAll('main section').forEach(s=>s.classList.toggle('hide',s.id!==v));}
document.querySelectorAll('nav button').forEach(b=>b.onclick=()=>show(b.dataset.v));
$('#board').innerHTML='<div class="cols">'+COLS.map(c=>{const v=D.tickets.filter(t=>t.status===c);return '<div class="col"><h3>'+c+' '+v.length+'</h3>'+v.map(t=>'<div class="card'+(c==='needs-you'?' ny':'')+'" onclick="detail(\\''+t.id+'\\')"><b>'+t.id+' <span class="tag">'+esc(t.size)+'</span></b>'+esc(t.title)+'<br><small>'+usd(t.cost)+(c==='needs-you'?' · '+esc((t.log.at(-1)||'').replace(/^\\S+ \\S+\\s+\\S+\\s+/,'')):'')+'</small></div>').join('')+'</div>'}).join('')+'</div>';
$('#tickets').innerHTML='<table><tr><th>id</th><th>status</th><th>size</th><th>cost</th><th>rounds</th><th>checks</th><th>title</th></tr>'+D.tickets.slice().reverse().map(t=>'<tr onclick="detail(\\''+t.id+'\\')" style="cursor:pointer"><td>'+t.id+'</td><td>'+esc(t.status)+'</td><td>'+esc(t.size)+'</td><td>'+usd(t.cost)+'</td><td>'+t.rounds+'</td><td class="'+(t.checks==='pass'?'ok':t.checks==='fail'?'bad':'')+'">'+esc(t.checks)+'</td><td>'+esc(t.title)+'</td></tr>').join('')+'</table>';
$('#cost').innerHTML='<h3>Per role and model</h3><table><tr><th>role · model</th><th>tickets</th><th>tokens</th><th>cost</th><th>avg review rounds</th></tr>'+(D.cost.map(c=>'<tr><td>'+esc(c.k)+'</td><td>'+c.tickets+'</td><td>'+c.tokens.toLocaleString()+'</td><td>'+usd(c.cost)+'</td><td>'+(c.rounds/c.tickets).toFixed(1)+'</td></tr>').join('')||'<tr><td colspan=5>no usage recorded yet</td></tr>')+'</table><h3>Per ticket</h3><table><tr><th>id</th><th>cost</th><th>tokens</th></tr>'+D.tickets.map(t=>'<tr><td>'+t.id+'</td><td>'+usd(t.cost)+'</td><td>'+Object.entries(t.tokens).map(([r,n])=>r+' '+n.toLocaleString()).join(' · ')+'</td></tr>').join('')+'</table>';
$('#lessons').innerHTML='<table><tr><th>id</th><th>tier</th><th>seen</th><th>scope</th><th>rule</th></tr>'+D.lessons.map(l=>'<tr><td>'+l.id+'</td><td>'+esc(l.tier)+'</td><td>'+l.count+'x</td><td>'+esc(l.scope)+'</td><td>'+esc(l.rule)+(l.shipped?' <span class="tag">shipped</span>':'')+'</td></tr>').join('')+'</table><p><small>veto: <code>orc lessons reject L-###</code> · demote: <code>orc lessons tier L-### reference</code></small></p>';
$('#health').innerHTML='<pre>'+esc(D.status.join('\\n'))+'</pre>';
function detail(id){const t=D.tickets.find(x=>x.id===id);show('detail');$('#detail').innerHTML='<p><a href="#" onclick="show(\\'board\\');return false">← board</a></p><h2>'+t.id+' '+esc(t.title)+' <span class="tag">'+esc(t.status)+'</span> <span class="tag">'+esc(t.size)+'</span></h2><p>'+esc(t.summary||'(no summary yet)')+'</p>'+(t.try_it.length?'<h3>Try it</h3><ol>'+t.try_it.map(s=>'<li>'+esc(s)+'</li>').join('')+'</ol>':'')+(t.decisions.length?'<h3>Decisions</h3><ul>'+t.decisions.map(d=>'<li>'+esc(d.q)+' → <b>'+esc(d.a)+'</b>'+(d.default_used?' <small>(default)</small>':'')+'</li>').join('')+'</ul>':'')+(t.acs.length?'<h3>Acceptance criteria</h3><ul>'+t.acs.map(a=>'<li><b>'+a.id+'</b> '+esc(a.text)+'</li>').join('')+'</ul>':'')+'<h3>Cost</h3><p>'+usd(t.cost)+' · '+Object.entries(t.tokens).map(([r,n])=>r+' '+(t.models[r]||'')+' '+n.toLocaleString()).join(' · ')+'</p><h3>Log</h3><pre>'+esc(t.log.join('\\n'))+'</pre>';}
</script></body></html>`;
}
const esc = s => String(s ?? '').replace(/[&<>"]/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' }[c]));

/* ------------------------------ hooks ----------------------------------- */
function hook(event) {
  let input = {}; try { input = JSON.parse(fs.readFileSync(0, 'utf8') || '{}'); } catch {}
  const ctx = project(input.cwd || process.cwd()); if (!ctx) return; // not an orc project: no-op
  try {
    if (event === 'guard') return guard(ctx, input);
    if (event === 'session-start') return say(statusLines(ctx).join('\n') + '\nUse /orc <request> to build. `orc explain` describes the system.');
    if (event === 'prompt') { const ts = loadTickets(ctx.P).filter(t => ['asking', 'needs-you'].includes(t.status)); if (ts.length) say(`orc: ${ts.map(t => `${t.id} is ${t.status}`).join(', ')}.`); return; }
    if (event === 'stop') { const dash = path.join(ctx.P.vault, 'Dashboard.html'); const latest = Math.max(0, ...(exists(ctx.P.tickets) ? fs.readdirSync(ctx.P.tickets).map(f => fs.statSync(path.join(ctx.P.tickets, f)).mtimeMs) : [0])); if (!exists(dash) || fs.statSync(dash).mtimeMs < latest) cmdBoard(ctx, true); return; }
    if (event === 'subagent-stop') return account(ctx, input);
  } catch (e) { process.stderr.write(`orc hook ${event}: ${e.message}\n`); }
}
const out = o => say(JSON.stringify({ hookSpecificOutput: { hookEventName: 'PreToolUse', ...o } }));
function guard(ctx, input) {
  const { cfg, P } = ctx; const tool = input.tool_name; const ti = input.tool_input || {}; const cwd = input.cwd || P.root;
  const isAgent = !!input.agent_id; const at = String(input.agent_type || '').toLowerCase();
  const role = at.includes('scout') ? 'scout' : at.includes('worker') ? 'worker' : at.includes('reviewer') ? 'reviewer' : isAgent ? 'agent' : 'control';
  const interactive = !isAgent && !['bypassPermissions', 'dontAsk'].includes(input.permission_mode);
  const deny = r => out({ permissionDecision: 'deny', permissionDecisionReason: r });
  const pause = (kind, r) => { if (interactive) return out({ permissionDecision: 'ask', permissionDecisionReason: `${kind}: ${r}` }); const s = loadState(P); if (s.active) { try { const t = loadTicket(P, s.active); if (t.status !== 'needs-you') setStatus(t, 'needs-you', `${kind} blocked: ${r.slice(0, 120)}`); } catch {} } return deny(`${kind} command blocked while running in the background. The ticket now needs the user: ${r}`); };
  if (['Read', 'Edit', 'Write', 'MultiEdit', 'NotebookEdit'].includes(tool)) {
    const fp = ti.file_path || ti.notebook_path || ti.path; if (!fp) return;
    const abs = path.resolve(cwd, fp); const rel = posix(path.relative(P.root, abs));
    if (process.env.ORC_DEBUG) process.stderr.write(`guard ${tool} role=${role} rel=${rel} secrets=${JSON.stringify(cfg.security.secrets)}\n`);
    if (matchPath(cfg.security.secrets, rel)) return deny(`${rel} matches a secret pattern. Never read or write secret values. Name the variable and where it goes, then hand that step to the user.`);
    if (tool === 'Read') return;
    if (isAgent && rel.startsWith('vault/Tickets/')) return deny('Ticket specs are written by control and orc only. Put findings in your report file.');
    if (rel.startsWith('.orc/state.json')) return deny('state.json is written by orc only.');
    if (role === 'worker') { const wt = loadState(P).tickets[loadState(P).active]?.worktree; if (wt && !abs.startsWith(path.resolve(wt)) && !rel.startsWith('vault/Reports/')) return deny(`Workers write only inside their worktree: ${wt}`); }
    if ((role === 'scout' || role === 'reviewer') && !rel.startsWith('vault/Reports/')) return deny(`${role} is read-only except vault/Reports/. Report, do not change.`);
    return;
  }
  if (tool === 'Bash') {
    const cmd = String(ti.command || '');
    for (const tok of cmd.split(/\s+/)) { const p = tok.replace(/^["']|["']$/g, ''); if (p && /[\/.]/.test(p) && matchPath(cfg.security.secrets, posix(p))) return deny(`${p} matches a secret pattern. Never read or print secret values.`); }
    if (matchCmd(cfg.security.destructive, cmd)) return pause('destructive', cmd.slice(0, 160));
    if (matchCmd(cfg.security.production, cmd)) return pause('production', cmd.slice(0, 160));
    if (isAgent && /\bgit\b[^|;&]*\b(push|merge|checkout|switch|rebase)\b[^|;&]*\b(main|master)\b/.test(cmd)) return deny(`Agents never touch ${cfg.base_branch}. Commit on the ticket branch; orc merges.`);
    if (isAgent && /\bgit\s+add\s+(-A|--all|\.)(\s|$)/.test(cmd)) return deny('git add -A / git add . is blocked for agents. Add files by name.');
    if ((role === 'scout' || role === 'reviewer') && /\bgit\s+(commit|push|rebase|reset|checkout|switch|stash|merge)\b/.test(cmd)) return deny(`${role} is read-only: findings, not commits.`);
  }
}
function account(ctx, input) {
  const { P, cfg } = ctx; const at = String(input.agent_type || '').toLowerCase();
  const role = at.includes('scout') ? 'scout' : at.includes('worker') ? 'worker' : at.includes('reviewer') ? 'reviewer' : null; if (!role) return;
  const s = loadState(P); if (!s.active) return; const t = loadTicket(P, s.active);
  const u = { in: 0, out: 0, cache_read: 0, cache_write: 0, model: null, turns: 0 }; const tp = input.agent_transcript_path;
  if (tp && exists(tp)) for (const line of read(tp).split('\n')) { if (!line.trim()) continue; let j; try { j = JSON.parse(line); } catch { continue; } const m = j.message || j; const us = m.usage || j.usage; if (!us || (m.role && m.role !== 'assistant')) continue; u.in += us.input_tokens || 0; u.out += us.output_tokens || 0; u.cache_read += us.cache_read_input_tokens || 0; u.cache_write += us.cache_creation_input_tokens || 0; u.turns++; if (m.model) u.model = m.model; }
  if (!u.turns) { logEvent(t, 'cost', `${role}: no usage found in transcript (${tp ? 'format changed?' : 'no transcript path'})`); return; }
  u.model = u.model || t.models?.[role] || cfg.models[role] || 'sonnet'; const prev = t.usage?.[role] || {};
  const merged = { model: u.model, in: (prev.in || 0) + u.in, out: (prev.out || 0) + u.out, cache_read: (prev.cache_read || 0) + u.cache_read, cache_write: (prev.cache_write || 0) + u.cache_write, turns: (prev.turns || 0) + u.turns };
  t.usage = { ...(t.usage || {}), [role]: merged }; t.tokens = Object.fromEntries(Object.entries(t.usage).map(([r, x]) => [r, (x.in || 0) + (x.out || 0)]));
  t.cost_usd = +Object.values(t.usage).reduce((a, x) => a + costOf(cfg, x.model, x), 0).toFixed(4); t.models = { ...(t.models || {}), [role]: family(u.model) };
  saveTicket(t); logEvent(t, 'cost', `${role} ${family(u.model)} ${fmtK(u.in + u.out)} tokens · ${u.turns} turns · ticket total ${usd(t.cost_usd)}`);
}

/* ------------------------------ main ------------------------------------ */
const { pos, opt } = argsOf(process.argv.slice(2)); const [cmd, ...rest] = pos;
if (!cmd || cmd === 'help' || opt.help) { say(`orc ${VERSION} · gate-free development orchestrator for Claude Code\n\nsetup     orc init [--store vault|postgres] · orc doctor · orc explain [topic]\ntickets   orc new "<title>" [--size S|M|L] [--type feature|fix|chore] · orc ticket list|show|set|log · orc ready · orc needs-you\nrun       orc scout T-001 [--record] · orc dispatch T-001 [--model m] · orc check T-001 · orc review T-001 [--record] · orc merge T-001 · orc undo T-001 · orc resume T-001 · orc close T-001 [--failed]\nsee       orc status · orc board · orc done T-001 · orc cost [T-001|--week] · orc models suggest\nlearn     orc lessons list|add|reject|tier|skill\nstore     orc store status|migrate|postgres\n\n/orc <request> inside Claude Code drives all of this for you.`); process.exit(0); }
if (cmd === 'hook') { hook(rest[0]); process.exit(0); }
if (cmd === 'init') { cmdInit(opt); process.exit(0); }
if (cmd === 'explain') { cmdExplain(rest); process.exit(0); }
if (cmd === 'version') { say(VERSION); process.exit(0); }
if (cmd === 'doctor') { cmdDoctor(project()); process.exit(0); }
const ctx = need();
({ new: () => cmdNew(ctx, rest, opt), ticket: () => cmdTicket(ctx, rest), ready: () => cmdReady(ctx), 'needs-you': () => cmdNeedsYou(ctx), status: () => say(statusLines(ctx).join('\n')),
  scout: () => cmdScout(ctx, rest[0] || die('ticket id?'), opt), dispatch: () => cmdDispatch(ctx, rest[0] || die('ticket id?'), opt), check: () => cmdCheck(ctx, rest[0] || die('ticket id?')), review: () => cmdReview(ctx, rest[0] || die('ticket id?'), opt),
  merge: () => cmdMerge(ctx, rest[0] || die('ticket id?')), undo: () => cmdUndo(ctx, rest[0] || die('ticket id?')), resume: () => cmdResume(ctx, rest[0] || die('ticket id?')), close: () => cmdClose(ctx, rest[0] || die('ticket id?'), opt), done: () => cmdDone(ctx, rest[0] || die('ticket id?')),
  board: () => cmdBoard(ctx, false), dashboard: () => { cmdBoard(ctx, false); if (opt.open) spawnSync(process.platform === 'win32' ? 'cmd' : 'open', process.platform === 'win32' ? ['/c', 'start', '', path.join(ctx.P.vault, 'Dashboard.html')] : [path.join(ctx.P.vault, 'Dashboard.html')]); },
  lessons: () => cmdLessons(ctx, rest, opt), lesson: () => cmdLessons(ctx, rest, opt), cost: () => cmdCost(ctx, rest, opt), models: () => cmdModels(ctx), store: () => cmdStore(ctx, rest),
}[cmd] || (() => die(`unknown command ${cmd}. Try: orc help`)))();
