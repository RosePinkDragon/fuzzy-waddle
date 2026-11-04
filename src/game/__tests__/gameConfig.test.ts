import { defaultGameConfig, ladderFor, mergeGameConfig, validateGameConfig } from '../gameConfig';

function errorsFor(input: unknown): string[] {
  const result = validateGameConfig(input);
  if (result.ok) throw new Error(`expected rejection, got ${JSON.stringify(result.config)}`);
  return result.errors;
}

describe('validateGameConfig: accepts', () => {
  it('an empty object, as exactly the default', () => {
    const result = validateGameConfig({});
    expect(result).toEqual({ ok: true, config: defaultGameConfig });
    if (result.ok) expect(result.config).not.toBe(defaultGameConfig);
  });

  it('a full valid override', () => {
    const full = {
      lives: { easy: 5, medium: 4, hard: 3 },
      ladder: [
        { crore: 10, hits: 3 },
        { crore: 20, hits: 8 },
        { crore: 30, hits: 20 },
      ],
      ladderExtension: { gapGrowth: 2, croreSteps: [40, 60], croreEvery: 100 },
      startPowerUps: [3, 0, 2, 1],
      milestoneReward: { slot: 3, amount: 2 },
      removeWrongCount: 4,
      bossCandidates: 5,
    };
    expect(validateGameConfig(full)).toEqual({ ok: true, config: full });
  });

  it('a partial lives override, keeping the other difficulties', () => {
    const result = validateGameConfig({ lives: { hard: 4 } });
    expect(result).toMatchObject({ ok: true, config: { lives: { easy: 9, medium: 7, hard: 4 } } });
  });

  it('a partial extension, keeping the default crore steps', () => {
    const result = validateGameConfig({ ladderExtension: { gapGrowth: 0 } });
    expect(result).toMatchObject({
      ok: true,
      config: { ladderExtension: { gapGrowth: 0, croreSteps: [1500, 2000], croreEvery: 1000 } },
    });
  });

  it('a reward of zero, the top life count and an empty croreSteps list', () => {
    expect(validateGameConfig({ milestoneReward: { amount: 0 } }).ok).toBe(true);
    expect(validateGameConfig({ lives: { easy: 9 } }).ok).toBe(true);
    expect(validateGameConfig({ ladderExtension: { croreSteps: [] } }).ok).toBe(true);
  });

  it('values that give a ladder which can be built and walked', () => {
    const result = validateGameConfig({ ladder: [{ crore: 1, hits: 1 }, { crore: 2, hits: 2 }], ladderExtension: { gapGrowth: 0 } });
    expect(result.ok).toBe(true);
    if (result.ok) expect(ladderFor(result.config).reached(50)?.hits).toBe(50);
  });

  it('does not change the default, nor the input', () => {
    const input = { lives: { easy: 2 }, startPowerUps: [1, 1, 1, 1] };
    const copy = JSON.parse(JSON.stringify(input));
    const result = validateGameConfig(input);
    expect(input).toEqual(copy);
    if (result.ok) (result.config.startPowerUps as number[])[0] = 99;
    expect(defaultGameConfig.startPowerUps[0]).toBe(2);
    expect(input.startPowerUps[0]).toBe(1);
  });
});

describe('validateGameConfig: rejects', () => {
  const rungs = (...hits: number[]) => hits.map((h, i) => ({ crore: (i + 1) * 10, hits: h }));

  it.each<[string, unknown, string]>([
    ['null', null, 'config: must be an object (got null)'],
    ['an array', [], 'config: must be an object (got [])'],
    ['a string', 'lives', 'config: must be an object (got "lives")'],
    ['a number', 3, 'config: must be an object (got 3)'],
    ['an unknown top-level key', { foo: 1 }, 'foo: unknown setting'],
    ['an unknown difficulty', { lives: { extreme: 3 } }, 'lives.extreme: unknown setting'],
    ['an unknown reward key', { milestoneReward: { bonus: 1 } }, 'milestoneReward.bonus: unknown setting'],
    ['an unknown extension key', { ladderExtension: { x: 1 } }, 'ladderExtension.x: unknown setting'],
    ['an unknown rung key', { ladder: [{ crore: 1, hits: 1, extra: 1 }, { crore: 2, hits: 2 }] }, 'ladder[0].extra: unknown setting'],
    ['a __proto__ key', JSON.parse('{"__proto__": {"lives": 1}}'), '__proto__: unknown setting'],
    ['lives that is not an object', { lives: 5 }, 'lives: must be an object (got 5)'],
    ['a negative power-up count', { startPowerUps: [-1, 1, 1, 1] }, 'startPowerUps[0]: must be an integer of at least 0 (got -1)'],
    ['a negative remove count', { removeWrongCount: -1 }, 'removeWrongCount: must be an integer of at least 1 (got -1)'],
    ['a negative reward amount', { milestoneReward: { amount: -1 } }, 'milestoneReward.amount: must be an integer of at least 0 (got -1)'],
    ['zero boss candidates', { bossCandidates: 0 }, 'bossCandidates: must be an integer of at least 1 (got 0)'],
    ['a remove count of zero', { removeWrongCount: 0 }, 'removeWrongCount: must be an integer of at least 1 (got 0)'],
    ['croreEvery of zero', { ladderExtension: { croreEvery: 0 } }, 'ladderExtension.croreEvery: must be an integer of at least 1 (got 0)'],
    ['a fractional remove count', { removeWrongCount: 1.5 }, 'removeWrongCount: must be an integer of at least 1 (got 1.5)'],
    ['lives as a string', { lives: { easy: '9' } }, 'lives.easy: must be an integer from 1 to 9 (got "9")'],
    ['NaN', { bossCandidates: NaN }, 'bossCandidates: must be an integer of at least 1 (got NaN)'],
    ['Infinity', { bossCandidates: Infinity }, 'bossCandidates: must be an integer of at least 1 (got Infinity)'],
    ['null for a count', { removeWrongCount: null }, 'removeWrongCount: must be an integer of at least 1 (got null)'],
    ['lives above the sign', { lives: { easy: 10 } }, 'lives.easy: must be an integer from 1 to 9 (got 10)'],
    ['zero lives', { lives: { easy: 0 } }, 'lives.easy: must be an integer from 1 to 9 (got 0)'],
    ['equal hits', { ladder: rungs(5, 5) }, 'ladder.hits[1]: must be greater than ladder.hits[0] (5) (got 5)'],
    ['decreasing hits', { ladder: rungs(5, 9, 7) }, 'ladder.hits[2]: must be greater than ladder.hits[1] (9) (got 7)'],
    [
      'decreasing crore',
      { ladder: [{ crore: 50, hits: 1 }, { crore: 20, hits: 2 }] },
      'ladder.crore[1]: must be greater than ladder.crore[0] (50) (got 20)',
    ],
    ['a one-rung ladder', { ladder: rungs(5) }, 'ladder: needs at least 2 rungs (got 1)'],
    ['an empty ladder', { ladder: [] }, 'ladder: needs at least 2 rungs (got 0)'],
    ['a ladder that is not a list', { ladder: {} }, 'ladder: must be a list (got {})'],
    ['a rung with zero hits', { ladder: rungs(0, 5) }, 'ladder.hits[0]: must be an integer of at least 1 (got 0)'],
    ['a rung with a missing key', { ladder: [{ hits: 1 }, { crore: 2, hits: 2 }] }, 'ladder.crore[0]: must be an integer of at least 1 (got undefined)'],
    ['a rung that is not an object', { ladder: [1, 2] }, 'ladder[0]: must be an object (got 1)'],
    ['three start power-ups', { startPowerUps: [1, 1, 1] }, 'startPowerUps: must have exactly 4 counts (got 3)'],
    ['five start power-ups', { startPowerUps: [1, 1, 1, 1, 1] }, 'startPowerUps: must have exactly 4 counts (got 5)'],
    ['a reward slot past the last', { milestoneReward: { slot: 4 } }, 'milestoneReward.slot: must be an integer from 0 to 3 (got 4)'],
    ['a negative reward slot', { milestoneReward: { slot: -1 } }, 'milestoneReward.slot: must be an integer from 0 to 3 (got -1)'],
    [
      'croreSteps not increasing',
      { ladderExtension: { croreSteps: [2000, 1500] } },
      'ladderExtension.croreSteps[1]: must be greater than ladderExtension.croreSteps[0] (2000) (got 1500)',
    ],
    ['repeated croreSteps', { ladderExtension: { croreSteps: [5, 5] } }, 'ladderExtension.croreSteps[1]: must be greater than'],
    ['a negative gapGrowth', { ladderExtension: { gapGrowth: -1 } }, 'ladderExtension.gapGrowth: must be an integer of at least 0 (got -1)'],
    ['a fractional gapGrowth', { ladderExtension: { gapGrowth: 0.5 } }, 'ladderExtension.gapGrowth: must be an integer of at least 0 (got 0.5)'],
    ['croreSteps that is not a list', { ladderExtension: { croreSteps: 5 } }, 'ladderExtension.croreSteps: must be a list (got 5)'],
  ])('%s', (_name, input, message) => {
    const errors = errorsFor(input);
    expect(errors.some((e) => e.startsWith(message) || e === message)).toBe(true);
  });

  it('returns every problem, not just the first', () => {
    const errors = errorsFor({
      foo: 1,
      lives: { easy: 10, hard: 0 },
      startPowerUps: [-1, 1, 1],
      removeWrongCount: 1.5,
      milestoneReward: { slot: 9 },
    });
    expect(errors).toEqual([
      'foo: unknown setting',
      'lives.easy: must be an integer from 1 to 9 (got 10)',
      'lives.hard: must be an integer from 1 to 9 (got 0)',
      'startPowerUps: must have exactly 4 counts (got 3)',
      'startPowerUps[0]: must be an integer of at least 0 (got -1)',
      'milestoneReward.slot: must be an integer from 0 to 3 (got 9)',
      'removeWrongCount: must be an integer of at least 1 (got 1.5)',
    ]);
  });

  it('never hands back a config for a ladder that could loop for ever', () => {
    for (const ladder of [rungs(5, 5), rungs(9, 3), rungs(1), [{ crore: 1, hits: 1 }, { crore: 2, hits: 1 }]]) {
      expect(validateGameConfig({ ladder }).ok).toBe(false);
    }
    expect(validateGameConfig({ ladderExtension: { gapGrowth: -5 } }).ok).toBe(false);
  });
});

describe('mergeGameConfig', () => {
  it('merges objects one level deep and replaces arrays whole', () => {
    const merged = mergeGameConfig(defaultGameConfig, {
      lives: { hard: 4 },
      ladderExtension: { croreSteps: [7] },
      startPowerUps: [0, 0, 0, 0],
    });
    expect(merged.lives).toEqual({ easy: 9, medium: 7, hard: 4 });
    expect(merged.ladderExtension).toEqual({ gapGrowth: 5, croreSteps: [7], croreEvery: 1000 });
    expect(merged.startPowerUps).toEqual([0, 0, 0, 0]);
    expect(merged.ladder).toEqual(defaultGameConfig.ladder);
  });

  it('copies instead of sharing, and ignores keys it does not know', () => {
    const override = { lives: { easy: 3 }, polluted: true } as never;
    const merged = mergeGameConfig(defaultGameConfig, override);
    expect(merged).not.toHaveProperty('polluted');
    expect(merged.ladder).not.toBe(defaultGameConfig.ladder);
    expect(merged.ladder[0]).not.toBe(defaultGameConfig.ladder[0]);
    expect(merged.lives).not.toBe(defaultGameConfig.lives);
  });

  it('returns the base values for an empty override', () => {
    expect(mergeGameConfig(defaultGameConfig)).toEqual(defaultGameConfig);
    expect(mergeGameConfig(defaultGameConfig, {})).toEqual(defaultGameConfig);
  });
});
