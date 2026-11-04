#!/usr/bin/env node
/**
 * Prints a condensed brief of an issue for agent handoffs (#47): title, labels,
 * user story, acceptance criteria, priority, estimate, linked issues and PRs,
 * file paths, and role and owner comments newest first, in about 150 lines.
 *
 *   npm run issue:brief -- 47
 *   npm run issue:brief -- 47 --json
 *   npm run issue:brief -- 47 --max-lines 100 --repo owner/name
 *
 * The limit applies to the text. --json prints the same trimmed content as
 * pretty-printed JSON, which runs longer in lines; it adds `cut` (what was left
 * out) and `textLines` (the text's length) so the skills can tell.
 *
 * Nothing is lost for good: --full prints everything uncut (every comment, in
 * full), and --comment <id> prints one comment in full. The brief prints both
 * commands, and each comment's id, wherever it cuts something.
 *
 * Read only: it sends GET requests through `gh api` (REST, because GraphQL is
 * blocked in the cloud sessions) and never changes the issue.
 */
const { execFileSync } = require('child_process');
const { buildBrief, DEFAULT_MAX_LINES, MIN_MAX_LINES } = require('./lib/issueBrief');

const USAGE = [
  'Usage: npm run issue:brief -- <issue number> [--json] [--max-lines <n>] [--repo <owner/name>]',
  '       npm run issue:brief -- <issue number> --full [--json]          everything, uncut, every comment',
  '       npm run issue:brief -- <issue number> --comment <id> [--json]  one comment in full',
].join('\n');

function parseArgs(argv) {
  const opts = { json: false, full: false, comment: null, maxLines: DEFAULT_MAX_LINES, repo: 'RosePinkDragon/fuzzy-waddle', number: null };
  for (let i = 0; i < argv.length; i += 1) {
    const a = argv[i];
    if (a === '--json') opts.json = true;
    else if (a === '--max-lines') opts.maxLines = Number(argv[(i += 1)]);
    else if (a === '--repo') opts.repo = argv[(i += 1)];
    else if (a === '--full') opts.full = true;
    else if (a === '--comment') opts.comment = Number(argv[(i += 1)]);
    else if (a === '-h' || a === '--help') opts.help = true;
    else if (/^#?\d+$/.test(a)) opts.number = Number(a.replace('#', ''));
    else throw new Error(`Unknown argument: ${a}\n${USAGE}`);
  }
  if (opts.help) return opts;
  if (!opts.number) throw new Error(USAGE);
  if (!Number.isInteger(opts.maxLines) || opts.maxLines < MIN_MAX_LINES) throw new Error(`--max-lines needs a whole number of at least ${MIN_MAX_LINES}`);
  if (!/^[\w.-]+\/[\w.-]+$/.test(opts.repo || '')) throw new Error('--repo needs the form owner/name');
  if (opts.comment !== null && !(Number.isInteger(opts.comment) && opts.comment > 0)) throw new Error('--comment needs a comment id, as the brief prints it');
  if (opts.comment !== null && opts.full) throw new Error('Use --full or --comment, not both');
  return opts;
}

/** GET through `gh api`. With paginate, returns every item across pages. */
function ghGet(path, { paginate = false } = {}) {
  const args = ['api', '-X', 'GET', '-H', 'Accept: application/vnd.github+json', path];
  if (paginate) args.push('--paginate', '--jq', '.[] | @json');
  let out;
  try {
    out = execFileSync('gh', args, { encoding: 'utf8', stdio: ['ignore', 'pipe', 'pipe'], maxBuffer: 32 * 1024 * 1024 });
  } catch (err) {
    if (err.code === 'ENOENT') throw new Error('The GitHub CLI (gh) is not installed. Install it, then run `gh auth login`.');
    const detail = String(err.stderr || err.message).trim();
    if (/auth login|not logged|401|Bad credentials|authenticat/i.test(detail)) {
      throw new Error(`gh is not signed in to GitHub. Run \`gh auth login\` (or set GH_TOKEN), then try again.\n${detail}`);
    }
    if (/404|Not Found/i.test(detail)) throw new Error(`Not found: ${path}. Check the issue number and --repo.\n${detail}`);
    throw new Error(`gh api ${path} failed.\n${detail}`);
  }
  if (!paginate) return JSON.parse(out);
  return out.split('\n').filter(Boolean).map((line) => JSON.parse(line));
}

function main() {
  const opts = parseArgs(process.argv.slice(2));
  if (opts.help) {
    console.log(USAGE);
    return;
  }
  const base = `repos/${opts.repo}`;
  if (opts.comment) {
    const c = ghGet(`${base}/issues/comments/${opts.comment}`);
    if (!String(c.issue_url || '').endsWith(`/issues/${opts.number}`)) throw new Error(`Comment ${opts.comment} is not on #${opts.number}.`);
    const out = { issue: opts.number, id: c.id, author: c.user && c.user.login, createdAt: c.created_at, url: c.html_url, body: c.body };
    console.log(opts.json ? JSON.stringify(out, null, 2) : `#${opts.number} comment ${c.id} · ${out.author} · ${out.createdAt}\n${c.html_url}\n\n${c.body}`);
    return;
  }
  const issue = ghGet(`${base}/issues/${opts.number}`);
  const comments = issue.comments ? ghGet(`${base}/issues/${opts.number}/comments?per_page=100`, { paginate: true }) : [];

  // Titles for linked issues and PRs. A failed lookup just leaves the number.
  const build = (links) => buildBrief(issue, comments, { repo: opts.repo, maxLines: opts.maxLines, full: opts.full, links });
  const { brief: draft } = build();
  const links = {};
  for (const { number } of draft.links.slice(0, opts.full ? 100 : 25)) {
    try {
      const l = ghGet(`${base}/issues/${number}`);
      links[number] = { title: l.title, type: l.pull_request ? 'pr' : 'issue', state: l.pull_request && l.pull_request.merged_at ? 'merged' : l.state };
    } catch {
      links[number] = {};
    }
  }

  const { brief, text } = build(links);
  console.log(opts.json ? JSON.stringify(brief, null, 2) : text);
}

if (require.main === module) {
  try {
    main();
  } catch (err) {
    console.error(err.message);
    process.exit(1);
  }
}

module.exports = { parseArgs, ghGet };
