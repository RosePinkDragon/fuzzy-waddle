import { buildBrief, extractFiles, extractLinks, extractSections } from '../lib/issueBrief';
import fixture from './fixtures/issue.json';

jest.mock('child_process', () => ({ execFileSync: jest.fn() }));

// eslint-disable-next-line @typescript-eslint/no-require-imports
const { execFileSync } = require('child_process') as { execFileSync: jest.Mock };
// eslint-disable-next-line @typescript-eslint/no-require-imports
const { parseArgs, ghGet } = require('../issue-brief') as {
  parseArgs: (argv: string[]) => { number: number; json: boolean; maxLines: number; repo: string };
  ghGet: (path: string, opts?: { paginate?: boolean }) => unknown;
};

const { issue, comments } = fixture;

describe('extractSections', () => {
  it('reads the template sections and keeps their lines', () => {
    const s = extractSections(issue.body);
    expect(s.userStory).toBe('As a player, I want to pick a difficulty, so that new players aren\'t scared off.');
    expect(s.criteria).toContain('**Given** the home screen');
    expect(s.criteria).toContain('**Given** Hard');
    expect(s.priority).toBe('P2 - should have');
    expect(s.estimate).toBe('S (half a day)');
  });

  it('keeps subheadings under a ## section and stops at the next ## or a rule', () => {
    const s = extractSections('## Acceptance criteria\n### Before\n- a\n### After\n- b\n## Priority\nP1\n\n---\nfooter');
    expect(s.criteria).toBe('### Before\n- a\n### After\n- b');
    expect(s.priority).toBe('P1');
  });

  it('returns null for a missing section instead of guessing', () => {
    const s = extractSections('## User story\nAs a player...');
    expect(s.criteria).toBeNull();
    expect(s.priority).toBeNull();
    expect(s.estimate).toBeNull();
  });
});

describe('extractLinks', () => {
  it('finds #n and links to this repo, but not other repos or the issue itself', () => {
    const links = extractLinks([issue.body, 'see #12 and RosePinkDragon/fuzzy-waddle#7'], 'RosePinkDragon/fuzzy-waddle', 12);
    expect(links).toEqual([7, 10, 28]);
  });
});

describe('extractFiles', () => {
  it('finds file and folder paths, skipping URLs, versions and branch patterns', () => {
    const files = extractFiles([issue.body]);
    expect(files).toEqual(['src/data/words/', 'design/screens/home.png', 'src/game/config.ts', 'src/game/engine.ts']);
  });
});

describe('buildBrief', () => {
  const { brief, text } = buildBrief(issue, comments);

  it('has the title, labels, sections, links and files', () => {
    expect(brief.title).toBe('feat(game): add a difficulty picker');
    expect(brief.labels).toEqual(['feature', 'ready']);
    expect(brief.links.map((l: { number: number }) => l.number)).toEqual([10, 28, 99]);
    expect(brief.files).toEqual(
      expect.arrayContaining(['src/game/config.ts', 'src/hooks/useRun.ts', 'src/screens/HomeScreen.tsx', 'scripts/other.js']),
    );
    expect(text).toContain('## Acceptance criteria');
    expect(text).toContain('P2 - should have');
  });

  it('lists role and owner comments newest first, with links, and leaves out the rest', () => {
    expect(brief.comments.map((c: { role: string | null; kind: string }) => c.role || c.kind)).toEqual([
      'Game designer',
      'owner',
      'Senior developer',
    ]);
    expect(brief.comments[0]).toMatchObject({ title: 'Review', url: comments[3].html_url });
    expect(brief.comments[2].excerpt[0]).toBe('### Approach');
    expect(brief.comments[2].cutLines).toBeGreaterThan(0);
    expect(text).not.toContain('Drive-by comment');
    expect(brief.cut).toEqual(['1 comment without a role tag from people other than the owner left out']);
  });

  it('says when a section is missing', () => {
    const { text: t } = buildBrief({ ...issue, body: '## User story\nAs a player.' }, []);
    expect(t).toContain('(missing: no "Acceptance criteria" section in the issue body)');
  });

  it('stays under the line limit on a long thread and says what it cut', () => {
    const many = Array.from({ length: 60 }, (_, i) => ({
      ...comments[0],
      created_at: `2026-11-03T00:${String(i).padStart(2, '0')}:00Z`,
      html_url: `${issue.html_url}#issuecomment-${100 + i}`,
    }));
    const criteria = Array.from({ length: 200 }, (_, i) => `- criterion ${i}`).join('\n');
    const longBody = issue.body.replace('### Market impact', `${criteria}\n\n### Market impact`);
    const long = buildBrief({ ...issue, body: longBody }, many, { maxLines: 150 });
    expect(long.text.split('\n').length).toBeLessThanOrEqual(150);
    expect(long.text).toContain('## Cut to fit');
    expect(long.text).toContain('long sections shortened: Acceptance criteria');
    expect(long.text).toMatch(/older comments left out/);
    expect(long.text).toContain(`Full issue: ${issue.html_url}`);
    expect(long.brief.comments[0].url).toBe(`${issue.html_url}#issuecomment-159`);
  });
});

describe('buildBrief line limit (review on #52)', () => {
  // 180 linked issues and 120 file paths, with short sections and no long comments.
  const refs = Array.from({ length: 180 }, (_, i) => `#${1000 + i}`).join(' ');
  const paths = Array.from({ length: 120 }, (_, i) => `src/dir${i}/file${i}.ts`).join(' ');
  const body = `## User story\nAs a player.\n\n## Acceptance criteria\n- one\n\n## Details\n${refs}\n${paths}\n\n## Priority\nP3\n\n## Estimate\nS`;
  const big = { ...issue, body };
  const texts = [body, ...comments.map((c) => c.body)];
  const totalLinks = extractLinks(texts, 'RosePinkDragon/fuzzy-waddle', issue.number).length;
  const totalFiles = extractFiles(texts).length;

  const count = (text: string, re: RegExp) => Number((text.match(re) || [])[1] || 0);

  it('has more links and paths than any limit can show', () => {
    expect(totalLinks).toBe(181);
    expect(totalFiles).toBe(124);
  });

  it.each([150, 100, 60, 40])('keeps the text within --max-lines %i and reports the cuts accurately', (maxLines) => {
    const { brief, text } = buildBrief(big, comments, { maxLines });
    const lines = text.split('\n');
    expect(lines.length).toBeLessThanOrEqual(maxLines);
    expect(brief.textLines).toBe(lines.length);
    expect(text).toContain('## Cut to fit');
    expect(text).toContain(`Full issue: ${issue.html_url}`);

    // What's shown plus what the notes say was left out adds up to everything found.
    expect(brief.links.length + count(text, /- (\d+) linked issues? or PRs? left out/)).toBe(totalLinks);
    expect(brief.files.length + count(text, /- (\d+) file paths? left out/)).toBe(totalFiles);
    const shownLinks = lines.filter((l) => /^#\d+$/.test(l)).length;
    expect(shownLinks).toBe(brief.links.length);
  });

  it('keeps the newest comment link when it has room', () => {
    const { brief } = buildBrief(big, comments, { maxLines: 150 });
    expect(brief.comments[0].url).toBe(comments[3].html_url);
  });

  it('puts the same trimmed content in the JSON as in the text', () => {
    const { brief, text } = buildBrief(big, comments, { maxLines: 60 });
    for (const l of brief.links) expect(text).toContain(`#${l.number}`);
    for (const note of brief.cut) expect(text).toContain(note);
    expect(brief).not.toHaveProperty('omitted');
  });

  it('cuts the text itself as a last resort, keeping the notes and the link', () => {
    const many = Array.from({ length: 40 }, (_, i) => `- ${i}`).join('\n');
    const tall = { ...issue, body: ['User story', 'Acceptance criteria', 'Priority', 'Estimate'].map((h) => `## ${h}\n${many}`).join('\n\n') };
    const { brief, text } = buildBrief(tall, comments, { maxLines: 20 });
    expect(text.split('\n').length).toBeLessThanOrEqual(20);
    expect(text).toMatch(/more lines cut here to fit the limit/);
    expect(text.split('\n').pop()).toBe(`Full issue: ${issue.html_url}`);
    expect(brief.cut.at(-1)).toMatch(/^text cut by \d+ lines$/);
  });
});

describe('issue-brief CLI', () => {
  beforeEach(() => execFileSync.mockReset());

  it('parses the number and flags', () => {
    expect(parseArgs(['47', '--json'])).toMatchObject({ number: 47, json: true, maxLines: 150 });
    expect(() => parseArgs([])).toThrow('Usage');
    expect(() => parseArgs(['47', '--max-lines', 'x'])).toThrow('--max-lines');
  });

  it('only sends GET requests through the REST API', () => {
    execFileSync.mockReturnValue('{"number":47}');
    ghGet('repos/o/r/issues/47');
    const args = execFileSync.mock.calls[0][1] as string[];
    expect(execFileSync.mock.calls[0][0]).toBe('gh');
    expect(args.slice(0, 3)).toEqual(['api', '-X', 'GET']);
    expect(args).not.toContain('graphql');
  });

  it('fails with a clear message when gh is not signed in', () => {
    execFileSync.mockImplementation(() => {
      throw Object.assign(new Error('fail'), { stderr: 'To get started with GitHub CLI, please run:  gh auth login' });
    });
    expect(() => ghGet('repos/o/r/issues/47')).toThrow('gh is not signed in to GitHub');
  });
});
