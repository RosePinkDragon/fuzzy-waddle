// Commit messages and PR titles must follow Conventional Commits:
//   type(optional-scope): lowercase subject
// e.g. feat(game): add boss rounds
export default {
  extends: ['@commitlint/config-conventional'],
  rules: {
    'type-enum': [
      2,
      'always',
      ['feat', 'fix', 'chore', 'docs', 'test', 'refactor', 'ci', 'style', 'perf', 'build', 'revert'],
    ],
  },
};
