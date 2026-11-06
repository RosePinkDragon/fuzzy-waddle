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
 * Screens: home, difficulty, game, win, flop, challenge. "game" shoots the first word
 * (<theme>-game) and the boss round that follows it (<theme>-game-boss). "win" is the milestone
 * screen, which shows the theme's win scene (design/screens/*Win.png). "challenge"
 * covers its landing, game, solved and failed states, plus the bad-link screen.
 * "prompt" opens the first-share name prompt over the win, flop and challenge
 * result screens (no saved name) and checks the sheet sits inside the viewport.
 * It builds the web export into dist-test/ with the two test switches from the
 * README: EXPO_PUBLIC_TEST_LADDER=1, so the first milestone comes after two words
 * (progress copy shows that test ladder), and EXPO_PUBLIC_TEST_HOOKS=1, so it can
 * read the current answer and tap the keyboard to win or lose. App code is untouched.
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
const SCREENS = ['home', 'difficulty', 'game', 'win', 'flop', 'challenge', 'prompt'];
const SETTLE_MS = 700;
/** Per-wait timeout, so a broken build fails in seconds rather than minutes. */
const WAIT_MS = 10000;

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

/** Every word in the bank. */
function allWords() {
  const dir = path.join(ROOT, 'src/data/words');
  return fs
    .readdirSync(dir)
    .filter((f) => f.endsWith('.json'))
    .flatMap((file) => JSON.parse(fs.readFileSync(path.join(dir, file), 'utf8')));
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
  console.log('Building the web export into dist-test/ (test ladder and hooks on)...');
  const r = spawnSync('npx', ['expo', 'export', '--platform', 'web', '--output-dir', 'dist-test'], {
    cwd: ROOT,
    stdio: ['ignore', 'ignore', 'inherit'],
    env: { ...process.env, EXPO_PUBLIC_TEST_LADDER: '1', EXPO_PUBLIC_TEST_HOOKS: '1', CI: '1' },
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
    let url;
    try {
      url = decodeURIComponent(req.url.split('?')[0]);
    } catch {
      url = '/';
    }
    let file = path.join(BUILD, url);
    if (!file.startsWith(BUILD + path.sep) || !fs.existsSync(file) || fs.statSync(file).isDirectory()) {
      file = path.join(BUILD, 'index.html');
    }
    res.writeHead(200, { 'Content-Type': TYPES[path.extname(file)] || 'application/octet-stream' });
    fs.createReadStream(file)
      .on('error', () => res.end())
      .pipe(res);
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
  constructor(page, height, opts, origin, words) {
    Object.assign(this, { page, height, opts, origin, words });
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

  async shot(name, extra = []) {
    const png = path.join(this.opts.out, `${name}-${this.height}.png`);
    const shown = png.startsWith(ROOT + path.sep) ? path.relative(ROOT, png) : png;
    const problems = [
      ...(await this.page.evaluate(findProblems, '#root')),
      ...(await this.page.evaluate(findScrollers)),
      ...extra,
    ];
    await this.page.screenshot({ path: png });
    if (problems.length) this.failed++;
    this.report(problems.length ? 'PROBLEMS' : 'ok', name, shown, problems);
  }

  report(status, name, shown, problems = []) {
    console.log(`${status.padEnd(8)}  ${name}  ${WIDTH}x${this.height}  ${shown}`);
    for (const p of [...new Set(problems)]) console.log(`    ${p}`);
  }

  /** Runs one step; a failure is reported against it, and the sweep carries on. */
  async attempt(name, fn) {
    try {
      await fn();
    } catch (err) {
      this.failed++;
      this.report('PROBLEMS', name, '(no screenshot)', [`couldn't finish: ${err.message.split('\n')[0]}`]);
    }
  }

  /**
   * Waits for a word to be in play with the keyboard taking guesses (Masala Mix
   * spins its reel first), then returns its answer from the test hook.
   */
  async currentAnswer(previous) {
    for (let tries = 0; tries < 60; tries++) {
      const hook = await this.page.evaluate(() => globalThis.__HANGMAN__ || null);
      const ready = await this.page
        .locator(byTestId('key-A'))
        .getAttribute('aria-disabled')
        .catch(() => 'true');
      if (!hook && tries > 10) throw new Error('no test hook: build with EXPO_PUBLIC_TEST_HOOKS=1');
      if (hook && hook.status === 'playing' && hook.answer !== previous && ready !== 'true') return hook.answer;
      await sleep(200);
    }
    throw new Error('no word came into play');
  }

  async press(letters) {
    for (const l of letters) {
      const key = this.page.locator(byTestId(`key-${l}`));
      if ((await key.getAttribute('aria-disabled')) === 'true') continue;
      await key.click();
    }
  }

  async solve(answer) {
    await this.press([...new Set(answer.replace(/[^A-Z]/g, ''))]);
  }

  /** Guesses wrong letters until the given screen shows. */
  async lose(answer, doneTestId) {
    const wrong = [...'ABCDEFGHIJKLMNOPQRSTUVWXYZ'].filter((l) => !answer.includes(l));
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
      const first = await this.currentAnswer();
      await this.settle();
      if (want.has('game')) await this.shot(`${theme}-game`);
      // With the test ladder the second word is the first boss round.
      await this.solve(first);
      const boss = await this.currentAnswer(first);
      await this.settle();
      if (want.has('game')) await this.shot(`${theme}-game-boss`);
      if (want.has('win')) {
        // The win screen is the milestone screen; the test ladder puts it after two words.
        await this.solve(boss);
        await this.page.waitForSelector(byTestId('milestone-screen'));
        await this.settle();
        await this.shot(`${theme}-win`);
      }
    }
    if (want.has('flop')) {
      await this.open(`/play/${theme}/easy`, 'game-screen');
      await this.lose(await this.currentAnswer(), 'flop-screen');
      await this.shot(`${theme}-flop`);
    }
    if (want.has('challenge')) await this.challenge(theme);
    if (want.has('prompt')) await this.prompts(theme);
  }

  /** Taps a share button, then screenshots the name prompt that opens over the screen. */
  async promptShot(name, shareTestId) {
    await this.page.click(byTestId(shareTestId));
    await this.page.waitForSelector(byTestId('name-prompt'));
    await this.settle();
    const fits = await this.page.evaluate(() => {
      const r = document.querySelector('[data-testid="name-prompt"]').getBoundingClientRect();
      return r.left >= 0 && r.top >= 0 && r.right <= window.innerWidth && r.bottom <= window.innerHeight;
    });
    await this.shot(name, fits ? [] : ['name prompt is clipped by the viewport']);
  }

  /** The first-share name prompt over the win, flop and challenge result screens. */
  async prompts(theme) {
    await this.attempt(`${theme}-prompt-win`, async () => {
      await this.open(`/play/${theme}/easy`, 'game-screen');
      const first = await this.currentAnswer();
      await this.solve(first);
      await this.solve(await this.currentAnswer(first));
      await this.page.waitForSelector(byTestId('milestone-screen'));
      await this.settle();
      await this.promptShot(`${theme}-prompt-win`, 'share-win');
    });
    await this.attempt(`${theme}-prompt-flop`, async () => {
      await this.open(`/play/${theme}/easy`, 'game-screen');
      await this.lose(await this.currentAnswer(), 'flop-screen');
      await this.promptShot(`${theme}-prompt-flop`, 'share-flop');
    });
    const word = this.words.find((w) => w.id.startsWith(`${theme}-`) && w.difficulty === 'easy');
    if (!word) {
      this.report('skipped', `${theme}-prompt-challenge`, `(${theme} has no words of its own, so no challenge links)`);
      return;
    }
    await this.attempt(`${theme}-prompt-challenge`, async () => {
      await this.open(`/c/${word.id}`, 'challenge-landing');
      await this.page.click(byTestId('accept-challenge'));
      await this.page.waitForSelector(byTestId('game-screen'));
      await this.currentAnswer();
      await this.solve(word.answer);
      await this.page.waitForSelector(byTestId('challenge-result'));
      await this.settle();
      await this.promptShot(`${theme}-prompt-challenge`, 'challenge-back');
    });
  }

  async challenge(theme) {
    const word = this.words.find((w) => w.id.startsWith(`${theme}-`) && w.difficulty === 'easy');
    if (!word) {
      this.report('skipped', `${theme}-challenge`, `(${theme} has no words of its own, so no challenge links)`);
      return;
    }
    const accept = async () => {
      await this.open(`/c/${word.id}`, 'challenge-landing');
      await this.page.click(byTestId('accept-challenge'));
      await this.page.waitForSelector(byTestId('game-screen'));
      await this.currentAnswer();
      await this.settle();
    };
    await this.open(`/c/${word.id}`, 'challenge-landing');
    await this.shot(`${theme}-challenge-landing`);
    await accept();
    await this.shot(`${theme}-challenge-game`);
    await this.solve(word.answer);
    await this.page.waitForSelector(byTestId('challenge-result'));
    await this.settle();
    await this.shot(`${theme}-challenge-solved`);
    await accept();
    await this.lose(word.answer, 'challenge-result');
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
  const words = allWords();
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
      page.setDefaultTimeout(WAIT_MS);
      const shooter = new Shooter(page, height, opts, origin, words);
      try {
        if (want.has('home')) {
          await shooter.attempt('home', async () => {
            await shooter.open('/', 'home-screen');
            await shooter.shot('home');
          });
        }
        for (const theme of opts.themes) await shooter.attempt(theme, () => shooter.run(theme, want));
        if (want.has('challenge')) {
          await shooter.attempt('challenge-bad-link', async () => {
            await shooter.open('/c/not-a-word', 'challenge-bad-link');
            await shooter.shot('challenge-bad-link');
          });
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
