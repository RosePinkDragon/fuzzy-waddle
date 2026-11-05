import { readFileSync } from 'fs';
import { join } from 'path';

import game from '../game.json';

type VercelConfig = {
  buildCommand?: string;
  outputDirectory?: string;
  rewrites?: { source: string; destination: string }[];
};

const vercel: VercelConfig = JSON.parse(
  readFileSync(join(__dirname, '..', '..', '..', 'vercel.json'), 'utf8'),
);

describe('vercel.json', () => {
  it('serves the web export from dist', () => {
    expect(vercel.outputDirectory).toBe('dist');
  });

  it('exports the web build in release mode so the test-hook guard applies', () => {
    expect(vercel.buildCommand).toContain('RELEASE_BUILD=1');
    expect(vercel.buildCommand).toContain('expo export');
    expect(vercel.buildCommand).toMatch(/-p web|--platform web/);
  });

  it('rewrites every path to the single-page app so /c/<wordId> loads and refreshes', () => {
    const catchAll = vercel.rewrites?.find((r) => r.source === '/:path*');
    expect(catchAll).toBeDefined();
    expect(['/', '/index.html']).toContain(catchAll?.destination);
  });
});

describe('webOrigin', () => {
  it('is the live https address, with no trailing slash and not the example placeholder', () => {
    expect(game.webOrigin).toMatch(/^https:\/\/[^/\s]+$/);
    expect(game.webOrigin).not.toMatch(/example\.com/);
    expect(game.webOrigin.endsWith('/')).toBe(false);
  });
});
