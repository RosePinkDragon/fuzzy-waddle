#!/usr/bin/env node
/**
 * Renders the mockups in design/source/*.dc.html to PNGs and lists layout
 * problems (content taller than the screen, things sticking out sideways,
 * clipped text). Used by the ux-designer and ux-reviewer agents.
 *
 *   node scripts/render-mockups.js                       # every mockup, 390x844, into design/screens/
 *   node scripts/render-mockups.js design/source/Home.dc.html
 *   node scripts/render-mockups.js --height 700 --out /tmp/mockups-700 design/source/Home.dc.html
 *
 * Needs Playwright with Chromium. Claude's cloud sessions have it already; on
 * your own machine run `npm i -g playwright && npx playwright install chromium`.
 * Exits with 1 when any mockup has a layout problem.
 */
const fs = require('fs');
const os = require('os');
const path = require('path');

const ROOT = path.resolve(__dirname, '..');
const WIDTH = 390;

function parseArgs(argv) {
  const opts = { height: 844, out: path.join(ROOT, 'design/screens'), files: [] };
  for (let i = 0; i < argv.length; i++) {
    if (argv[i] === '--height') opts.height = Number(argv[++i]);
    else if (argv[i] === '--out') opts.out = path.resolve(argv[++i]);
    else opts.files.push(path.resolve(argv[i]));
  }
  if (!opts.files.length) {
    const dir = path.join(ROOT, 'design/source');
    opts.files = fs
      .readdirSync(dir)
      .filter((f) => f.endsWith('.dc.html'))
      .sort()
      .map((f) => path.join(dir, f));
  }
  return opts;
}

// The app's own font files, so renders match the app and need no network.
function fontCss() {
  const fonts = path.join(ROOT, 'node_modules/@expo-google-fonts');
  const face = (family, weight, file) =>
    `@font-face{font-family:'${family}';font-weight:${weight};src:url('file://${file}') format('truetype');}`;
  const mukta = {
    400: '400Regular/Mukta_400Regular.ttf',
    600: '600SemiBold/Mukta_600SemiBold.ttf',
    700: '700Bold/Mukta_700Bold.ttf',
    800: '800ExtraBold/Mukta_800ExtraBold.ttf',
  };
  return [
    face('Yatra One', 400, path.join(fonts, 'yatra-one/400Regular/YatraOne_400Regular.ttf')),
    ...Object.entries(mukta).map(([w, f]) => face('Mukta', w, path.join(fonts, 'mukta', f))),
  ].join('\n');
}

// Runs in the page: expands the mockup's sc-for / sc-if templates with the
// values from its renderVals(), the same way the design canvas does.
function renderMockup({ src, height }) {
  function lookup(scope, p) {
    p = p.trim();
    if (p === 'true') return true;
    if (p === 'false') return false;
    if (/^-?\d+(\.\d+)?$/.test(p)) return Number(p);
    let v = scope;
    for (const part of p.split('.')) {
      if (v == null) return undefined;
      v = v[part];
    }
    return v;
  }
  const interp = (s, scope) =>
    s.replace(/\{\{\s*([^}]+?)\s*\}\}/g, (_, p) => {
      const v = lookup(scope, p);
      return v == null ? '' : String(v);
    });
  function expand(node, scope, out) {
    for (const c of Array.from(node.childNodes)) {
      if (c.nodeType === 3) {
        out.appendChild(document.createTextNode(interp(c.textContent, scope)));
        continue;
      }
      if (c.nodeType !== 1) continue;
      const binding = (attr) => (c.getAttribute(attr) || '').match(/\{\{\s*([^}]+?)\s*\}\}/);
      if (c.localName === 'sc-for') {
        const m = binding('list');
        (m ? lookup(scope, m[1]) || [] : []).forEach((item, i) => {
          const s = Object.create(scope);
          s[c.getAttribute('as')] = item;
          s.$index = i;
          expand(c, s, out);
        });
        continue;
      }
      if (c.localName === 'sc-if') {
        const m = binding('value');
        if (m && lookup(scope, m[1])) expand(c, scope, out);
        continue;
      }
      const el = document.createElementNS(c.namespaceURI, c.localName);
      for (const a of Array.from(c.attributes)) {
        const whole = a.value.match(/^\{\{\s*([^}]+?)\s*\}\}$/);
        if (!whole) {
          el.setAttribute(a.name, interp(a.value, scope));
          continue;
        }
        const v = lookup(scope, whole[1]);
        if (v === false || v == null || typeof v === 'function') continue;
        el.setAttribute(a.name, v === true ? '' : String(v));
      }
      expand(c, scope, el);
      out.appendChild(el);
    }
  }

  const doc = new DOMParser().parseFromString(src, 'text/html');
  const xdc = doc.querySelector('x-dc');
  const helmet = xdc.querySelector('helmet');
  if (helmet) {
    for (const st of helmet.querySelectorAll('style')) document.head.appendChild(document.importNode(st, true));
    helmet.remove();
  }
  const script = doc.querySelector('script[data-dc-script]');
  class DCLogic {
    constructor() {
      this.props = {};
      this.state = {};
    }
    setState() {}
    forceUpdate() {}
  }
  const vals = script
    ? new (new Function('DCLogic', script.textContent + '\nreturn Component;')(DCLogic))().renderVals()
    : {};
  const holder = document.createElement('div');
  expand(xdc, vals, holder);
  const root = holder.firstElementChild;
  root.style.height = height + 'px';
  document.body.appendChild(root);
}

// Runs in the page: returns layout problems for the rendered mockup.
function findProblems() {
  const root = document.body.firstElementChild;
  const box = root.getBoundingClientRect();
  const problems = [];
  if (root.scrollHeight > root.clientHeight + 1) {
    problems.push(`content is taller than the screen: ${root.scrollHeight}px > ${root.clientHeight}px`);
  }
  for (const el of root.querySelectorAll('*')) {
    if (el.closest('svg')) continue;
    const r = el.getBoundingClientRect();
    if (r.width === 0 && r.height === 0) continue;
    const label = (el.textContent || '').replace(/\s+/g, ' ').trim().slice(0, 40) || el.tagName.toLowerCase();
    if (r.right > box.right + 0.5 || r.left < box.left - 0.5) {
      problems.push(`sticks out sideways: "${label}" (${Math.round(r.left)}..${Math.round(r.right)})`);
    }
    const clips = getComputedStyle(el).overflow !== 'visible' || el.tagName === 'BUTTON';
    if (clips && el.scrollWidth > el.clientWidth + 1 && el.children.length === 0) {
      problems.push(`text doesn't fit: "${label}" (${el.scrollWidth}px in ${el.clientWidth}px)`);
    }
  }
  return problems;
}

(async () => {
  const opts = parseArgs(process.argv.slice(2));
  fs.mkdirSync(opts.out, { recursive: true });
  const { chromium } = require('playwright');
  const browser = await chromium.launch();
  const page = await browser.newPage({ viewport: { width: WIDTH, height: opts.height }, deviceScaleFactor: 1 });
  const shell = path.join(os.tmpdir(), 'render-mockups-shell.html');
  fs.writeFileSync(
    shell,
    `<!doctype html><html><head><meta charset="utf-8"><style>${fontCss()}</style></head><body style="margin:0"></body></html>`,
  );

  let failed = 0;
  for (const file of opts.files) {
    const name = path.basename(file, '.dc.html');
    await page.goto('file://' + shell);
    await page.evaluate(renderMockup, { src: fs.readFileSync(file, 'utf8'), height: opts.height });
    await page.evaluate(() => document.fonts.ready);
    const problems = await page.evaluate(findProblems);
    const png = path.join(opts.out, name + '.png');
    await page.screenshot({ path: png, clip: { x: 0, y: 0, width: WIDTH, height: opts.height } });
    if (problems.length) failed++;
    const shown = png.startsWith(ROOT + path.sep) ? path.relative(ROOT, png) : png;
    console.log(`${problems.length ? 'PROBLEMS' : 'ok'}  ${shown}`);
    for (const p of problems) console.log(`    ${p}`);
  }
  await browser.close();
  process.exit(failed ? 1 : 0);
})();
