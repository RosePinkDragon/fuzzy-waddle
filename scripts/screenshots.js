#!/usr/bin/env node
/**
 * Screenshots the web build at 390x700 and 390x844 and lists layout problems
 * (things wider than the screen, text that doesn't fit, screens that scroll).
 * Used by the developer and ux-reviewer agents; see .claude/reference/expo-tooling.md.
 *
 *   npm run screenshots                                   # every screen in every theme
 *   npm run screenshots -- --screens game,win             # only these screens
 *   npm run screenshots -- --themes filmy,masala          # only these themes
 *   npm run screenshots -- --skip-build                   # reuse the last build in dist-test/
 *   npm run screenshots -- --out /tmp/shots               # save somewhere else
 *
 * Screens: home, difficulty, game, win, flop, challenge. "win" is the milestone
 * screen, which shows the theme's win scene (design/screens/*Win.png). "challenge"
 * covers its landing, game, solved and failed states, plus the bad-link screen.
 * It builds the web export into dist-test/ with EXPO_PUBLIC_TEST_LADDER=1, so the
 * first milestone comes after two words (progress copy shows that test ladder).
 * It reaches game states through the app itself: it finds the answer by looking
 * up the clue on screen in the word bank, then taps the keyboard.
 *
 * Needs Playwright with Chromium, like scripts/render-mockups.js.
 * Exits with 1 when any screen has a problem, and 2 on bad input.
 */
const { spawnSync } = require('child_process');
const fs = require('fs');
const http = require('http');
const path = require('path');

const { findProblems } = require('./render-mockups');

const ROOT = path.resolve(__dirname, '..');
const BUILD = path.join(ROOT, 'dist-test');
const WIDTH = 390;
const HEIGHTS = [844, 700];
const SCREENS = ['home', 'difficulty', 'game', 'win', 'flop', 'challenge'];
const SETTLE_MS = 700;

function fail(message) {
  console.error(`screenshots: ${message}`);
  process.exit(2);
}

/** Theme ids in the app's order, read from src/themes/themes.ts. */
function themeIds() {
  const src = fs.readFileSync(path.join(ROOT, 'src/themes/themes.ts'), 'utf8');
  const m = src.match(/THEME_ORDER: ThemeId\[\] = \[([^\]]+)\]/);
  if (!m) fail('could not find THEME_ORDER in src/themes/themes.ts');
  return m[1].split(',').map((s) => s.trim().replace(/'/g, '')).filter(Boolean);
}

/** Every word in the bank, keyed by its clue. */
function wordsByClue() {
  const dir = path.join(ROOT, 'src/data/words');
  const byClue = new Map();
  for (const file of fs.readdirSync(dir).filter((f) => f.endsWith('.json'))) {
    for (const w of JSON.parse(fs.readFileSync(path.join(dir, file), 'utf8'))) byClue.set(w.clue, w);
  }
  return byClue;
}

function parseList(value, allowed, flag) {
  const items = (value || '').split(',').map((s) => s.trim()).filter(Boolean);
  if (!items.length) fail(`${flag} needs a comma-separated list`);
  for (const item of items) if (!allowed.includes(item)) fail(`unknown ${flag.slice(2, -1)} "${item}" (use ${allowed.join(', ')})`);
  return items;
}

function parseArgs(argv, themes) {
  const opts = { screens: SCREENS, themes, build: true, out: path.join(ROOT, 'design/build-screenshots') };
  for (let i = 0; i < argv.length; i++) {
    const arg = argv[i];
    if (arg === '--screens') opts.screens = parseList(argv[++i], SCREENS, '--screens');
    else if (arg === '--themes') opts.themes = parseList(argv[++i], themes, '--themes');
    else if (arg === '--skip-build') opts.build = false;
    else if (arg === '--out') {
      if (!argv[i + 1]) fail('--out needs a folder');
      opts.out = path.resolve(argv[++i]);
    } else fail(`unknown option ${arg}`);
  }
  return opts;
}

function build() {
  console.log('Building the web export into dist-test/ (test ladder on)...');
  const r = spawnSync('npx', ['expo', 'export', '--platform', 'web', '--output-dir', 'dist-test'], {
    cwd: ROOT,
    stdio: ['ignore', 'ignore', 'inherit'],
    env: { ...process.env, EXPO_PUBLIC_TEST_LADDER: '1', CI: '1' },
  });
  if (r.status !== 0) fail('the web export failed');
}

const TYPES = {
  '.html': 'text/html',
  '.js': 'text/javascript',
  '.css': 'text/css',
  '.json': 'application/json',
  '.png': 'image/png',
  '.jpg': 'image/jpeg',
  '.svg': 'image/svg+xml',
  '.ttf': 'font/ttf',
  '.ico': 'image/x-icon',
};

/** Serves dist-test/ as a single-page app: unknown paths get index.html. */
function serve() {
  const server = http.createServer((req, res) => {
    const url = decodeURIComponent(req.url.split('?')[0]);
    let file = path.join(BUILD, url);
    if (!file.startsWith(BUILD) || !fs.existsSync(file) || fs.statSync(file).isDirectory()) {
      file = path.join(BUILD, 'index.html');
    }
    res.writeHead(200, { 'Content-Type': TYPES[path.extname(file)] || 'application/octet-stream' });
    fs.createReadStream(file).pipe(res);
  });
  return new Promise((resolve) => server.listen(0, '127.0.0.1', () => resolve(server)));
}

function loadPlaywright() {
  try {
    return require('playwright');
  } catch {
    return fail('Playwright not found. Run `npm i --no-save playwright && npx playwright install chromium`.');
  }
}

// Runs in the page: lists scroll containers whose content is taller than they are.
function findScrollers() {
  const out = [];
  for (const el of document.querySelectorAll('#root *')) {
    const s = getComputedStyle(el);
    const scrolls = /(auto|scroll)/.test(s.overflowY) && el.scrollHeight > el.clientHeight + 1;
    if (scrolls && el.clientHeight > 0) out.push(`scrolls: ${el.scrollHeight}px of content in ${el.clientHeight}px`);
  }
  return out;
}

const sleep = (ms) => new Promise((r) => setTimeout(r, ms));
const byTestId = (id) => `[data-testid="${id}"]`;

class Shooter {
  constructor(page, height, opts, origin, byClue) {
    Object.assign(this, { page, height, opts, origin, byClue });
    this.failed = 0;
  }

  async open(route, testId) {
    await this.page.goto(this.origin + route);
    await this.page.waitForSelector(byTestId(testId));
    await this.settle();
  }

  async settle() {
    await this.page.evaluate(() => document.fonts.ready);
    await sleep(SETTLE_MS);
  }

  async shot(name) {
    const png = path.join(this.opts.out, `${name}-${this.height}.png`);
    const shown = png.startsWith(ROOT + path.sep) ? path.relative(ROOT, png) : png;
    const problems = [
      ...(await this.page.evaluate(findProblems, '#root')),
      ...(await this.page.evaluate(findScrollers)),
    ];
    await this.page.screenshot({ path: png });
    if (problems.length) this.failed++;
    console.log(`${problems.length ? 'PROBLEMS' : 'ok'}  ${shown}`);
    for (const p of [...new Set(problems)]) console.log(`    ${p}`);
  }

  /** Waits until the keyboard takes guesses (Masala Mix spins its reel first), then returns the word. */
  async currentWord(previousId) {
    for (let tries = 0; tries < 60; tries++) {
      const ready = await this.page
        .locator(byTestId('key-A'))
        .getAttribute('aria-disabled')
        .catch(() => 'true');
      if (ready !== 'true') {
        const text = await this.page.locator('#root').innerText();
        const matches = [...this.byClue.values()].filter((w) => text.includes(w.clue) && w.id !== previousId);
        if (matches.length === 1) return matches[0];
      }
      await sleep(200);
    }
    throw new Error('no playable word found on screen');
  }

  async press(letters) {
    for (const l of letters) {
      const key = this.page.locator(byTestId(`key-${l}`));
      if ((await key.getAttribute('aria-disabled')) === 'true') continue;
      await key.click();
    }
  }

  async solve(word) {
    await this.press([...new Set(word.answer.replace(/[^A-Z]/g, ''))]);
  }

  /** Guesses wrong letters until the given screen shows. */
  async lose(word, doneTestId) {
    const wrong = [...'ABCDEFGHIJKLMNOPQRSTUVWXYZ'].filter((l) => !word.answer.includes(l));
    for (const l of wrong) {
      if ((await this.page.locator(byTestId(doneTestId)).count()) > 0) break;
      const key = this.page.locator(byTestId(`key-${l}`));
      if ((await key.count()) === 0) break;
      if ((await key.getAttribute('aria-disabled')) === 'true') continue;
      await key.click();
    }
    await this.page.waitForSelector(byTestId(doneTestId));
    await this.settle();
  }

  async run(theme, want) {
    if (want.has('difficulty')) {
      await this.open(`/play/${theme}`, 'difficulty-screen');
      await this.shot(`difficulty-${theme}`);
    }
    if (want.has('game') || want.has('win')) {
      await this.open(`/play/${theme}/easy`, 'game-screen');
      const first = await this.currentWord();
      await this.settle();
      if (want.has('game')) await this.shot(`${theme}-game`);
      if (want.has('win')) {
        // The win screen is the milestone screen; the test ladder puts it after two words.
        await this.solve(first);
        await this.solve(await this.currentWord(first.id));
        await this.page.waitForSelector(byTestId('milestone-screen'));
        await this.settle();
        await this.shot(`${theme}-win`);
      }
    }
    if (want.has('flop')) {
      await this.open(`/play/${theme}/easy`, 'game-screen');
      await this.lose(await this.currentWord(), 'flop-screen');
      await this.shot(`${theme}-flop`);
    }
    if (want.has('challenge')) await this.challenge(theme);
  }

  async challenge(theme) {
    // An easy word, so the clue the script looks up isn't locked.
    const word = [...this.byClue.values()].find((w) => w.id.startsWith(`${theme}-`) && w.difficulty === 'easy');
    if (!word) return; // Masala Mix has no words of its own, so no challenges.
    const accept = async () => {
      await this.open(`/c/${word.id}`, 'challenge-landing');
      await this.page.click(byTestId('accept-challenge'));
      await this.page.waitForSelector(byTestId('game-screen'));
      await this.currentWord();
      await this.settle();
    };
    await this.open(`/c/${word.id}`, 'challenge-landing');
    await this.shot(`${theme}-challenge-landing`);
    await accept();
    await this.shot(`${theme}-challenge-game`);
    await this.solve(word);
    await this.page.waitForSelector(byTestId('challenge-result'));
    await this.settle();
    await this.shot(`${theme}-challenge-solved`);
    await accept();
    await this.lose(word, 'challenge-result');
    await this.shot(`${theme}-challenge-failed`);
  }
}

async function main() {
  const themes = themeIds();
  const opts = parseArgs(process.argv.slice(2), themes);
  if (opts.build) build();
  else if (!fs.existsSync(path.join(BUILD, 'index.html'))) fail('no build in dist-test/; run without --skip-build');
  fs.mkdirSync(opts.out, { recursive: true });

  const { chromium } = loadPlaywright();
  const byClue = wordsByClue();
  const want = new Set(opts.screens);
  const server = await serve();
  const origin = `http://127.0.0.1:${server.address().port}`;
  const browser = await chromium.launch();
  let failed = 0;
  try {
    for (const height of HEIGHTS) {
      // A fresh context per height, so saved bests and names don't leak between runs.
      const context = await browser.newContext({ viewport: { width: WIDTH, height }, deviceScaleFactor: 1 });
      const page = await context.newPage();
      const shooter = new Shooter(page, height, opts, origin, byClue);
      try {
        if (want.has('home')) {
          await shooter.open('/', 'home-screen');
          await shooter.shot('home');
        }
        for (const theme of opts.themes) {
          try {
            await shooter.run(theme, want);
          } catch (err) {
            shooter.failed++;
            console.log(`PROBLEMS  ${theme} at ${height}px`);
            console.log(`    couldn't finish: ${err.message.split('\n')[0]}`);
          }
        }
        if (want.has('challenge')) {
          await shooter.open('/c/not-a-word', 'challenge-bad-link');
          await shooter.shot('challenge-bad-link');
        }
      } finally {
        failed += shooter.failed;
        await context.close();
      }
    }
  } finally {
    await browser.close();
    server.close();
  }
  console.log(failed ? `\n${failed} screen(s) with problems.` : '\nAll screens look fine.');
  process.exit(failed ? 1 : 0);
}

main().catch((err) => {
  console.error(err);
  process.exit(2);
});
