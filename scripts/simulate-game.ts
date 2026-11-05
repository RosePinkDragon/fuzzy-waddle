/// <reference types="node" />
/**
 * Entry point for `npm run simulate:game`. This is the only simulator file that
 * touches Node I/O: everything else is in `scripts/simulate/` and takes an `Io`.
 */
import { execFileSync } from 'node:child_process';
import { readFileSync } from 'node:fs';

import { runCli, type Io } from './simulate/cli';

function git(...args: string[]): string {
  return execFileSync('git', args, { encoding: 'utf8', stdio: ['ignore', 'pipe', 'ignore'] }).trim();
}

const io: Io = {
  readFile: (path) => readFileSync(path, 'utf8'),
  gitInfo() {
    try {
      return { sha: git('rev-parse', '--short', 'HEAD'), dirty: git('status', '--porcelain') !== '' };
    } catch {
      return null;
    }
  },
  out: (text) => process.stdout.write(text),
  err: (text) => process.stderr.write(text),
};

process.exitCode = runCli(process.argv.slice(2), io);
