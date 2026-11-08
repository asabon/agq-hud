import { describe, it } from 'node:test';
import assert from 'node:assert/strict';
import {
  formatTimeRemaining,
  makeProgressBar,
  findMatchingGroup,
  formatCompactHookMarkdown,
  formatHookTitle,
  formatHookMarkdown,
  formatCliTable,
} from '../src/formatter.js';
import { ModelGroupQuota, QuotaSummary } from '../src/types.js';

describe('formatTimeRemaining', () => {
  it('handles undefined or NaN', () => {
    assert.equal(formatTimeRemaining(undefined), 'Unknown');
    assert.equal(formatTimeRemaining(NaN), 'Unknown');
  });

  it('handles <= 0 as Reset now', () => {
    assert.equal(formatTimeRemaining(0), 'Reset now');
    assert.equal(formatTimeRemaining(-5000), 'Reset now');
  });

  it('formats days and hours', () => {
    const ms = (2 * 24 + 5) * 60 * 60 * 1000; // 2d 5h
    assert.equal(formatTimeRemaining(ms), '2d 5h');
  });

  it('formats hours and minutes', () => {
    const ms = (4 * 60 + 30) * 60 * 1000; // 4h 30m
    assert.equal(formatTimeRemaining(ms), '4h 30m');
  });

  it('formats minutes', () => {
    const ms = 45 * 60 * 1000; // 45m
    assert.equal(formatTimeRemaining(ms), '45m');
  });

  it('formats < 1m', () => {
    const ms = 30 * 1000; // 30s
    assert.equal(formatTimeRemaining(ms), '< 1m');
  });
});

describe('makeProgressBar', () => {
  it('renders empty bar at 0%', () => {
    assert.equal(makeProgressBar(0, 10), '░░░░░░░░░░');
    assert.equal(makeProgressBar(-10, 10), '░░░░░░░░░░');
  });

  it('renders half-full bar at 50%', () => {
    assert.equal(makeProgressBar(50, 10), '█████░░░░░');
  });

  it('renders full bar at 100%', () => {
    assert.equal(makeProgressBar(100, 10), '██████████');
    assert.equal(makeProgressBar(120, 10), '██████████');
  });
});

describe('findMatchingGroup', () => {
  const sampleGroups: ModelGroupQuota[] = [
    {
      family: 'Gemini 3.8 Flash',
      remainingPercentage: 80,
      timeUntilResetMs: 3600000,
      buckets: [],
      models: [
        {
          label: 'Gemini 3.8 Flash',
          modelId: 'gemini-3.8-flash',
          family: 'Gemini 3.8 Flash',
          tierVariant: '',
          remainingPercentage: 80,
          timeUntilResetMs: 3600000,
        },
      ],
    },
    {
      family: 'Claude 3.5 Sonnet',
      remainingPercentage: 50,
      timeUntilResetMs: 7200000,
      buckets: [],
      models: [
        {
          label: 'Claude 3.5 Sonnet',
          modelId: 'claude-3-5-sonnet-20241022',
          family: 'Claude 3.5 Sonnet',
          tierVariant: '',
          remainingPercentage: 50,
          timeUntilResetMs: 7200000,
        },
      ],
    },
  ];

  it('returns undefined for empty or inherit', () => {
    assert.equal(findMatchingGroup(sampleGroups, undefined), undefined);
    assert.equal(findMatchingGroup(sampleGroups, ''), undefined);
    assert.equal(findMatchingGroup(sampleGroups, 'inherit'), undefined);
  });

  it('matches exact modelId or label', () => {
    const match = findMatchingGroup(sampleGroups, 'gemini-3.8-flash');
    assert.equal(match?.family, 'Gemini 3.8 Flash');
  });

  it('matches family name case-insensitively', () => {
    const match = findMatchingGroup(sampleGroups, 'claude 3.5 sonnet');
    assert.equal(match?.family, 'Claude 3.5 Sonnet');
  });

  it('matches fuzzy keyword tokens', () => {
    const match = findMatchingGroup(sampleGroups, 'flash');
    assert.equal(match?.family, 'Gemini 3.8 Flash');
  });
});

describe('formatHookTitle and formatHookMarkdown', () => {
  const sampleSummary: QuotaSummary = {
    userTierName: 'Google AI Pro',
    allModels: [],
    groups: [
      {
        family: 'Gemini 3.8 Flash',
        remainingPercentage: 80.5,
        timeUntilResetMs: 3600000,
        buckets: [],
        limit5h: {
          bucketId: '5h',
          displayName: '5h',
          window: '5h',
          remainingPercentage: 80.5,
          timeUntilResetMs: 3600000,
        },
        limitWeekly: {
          bucketId: 'weekly',
          displayName: 'weekly',
          window: 'weekly',
          remainingPercentage: 70.0,
          timeUntilResetMs: 86400000,
        },
        models: [
          {
            label: 'Gemini 3.8 Flash',
            modelId: 'gemini-3.8-flash',
            family: 'Gemini 3.8 Flash',
            tierVariant: '',
            remainingPercentage: 80.5,
            timeUntilResetMs: 3600000,
          },
        ],
      },
    ],
  };

  it('formats title with 5h and 1w percentages when available', () => {
    const title = formatHookTitle(sampleSummary, 'Gemini 3.8 Flash');
    assert.match(title, /⚡ Quota: Gemini 3.8 Flash/);
    assert.match(title, /5h: 80\.5%/);
    assert.match(title, /1w: 70\.0%/);
  });

  it('formats fallback title when no model matches', () => {
    const title = formatHookTitle(sampleSummary, 'unknown-model');
    assert.equal(title, '⚡ Model Quota HUD (Google AI Pro)');
  });

  it('formats compact hook markdown with status badges and reset info', () => {
    const md = formatCompactHookMarkdown(sampleSummary.groups[0], 'Google AI Pro');
    assert.match(md, /> 📊 \*\*Gemini 3.8 Flash\*\*/);
    assert.match(md, /5h: `80\.5%`/);
    assert.match(md, /1w: `70\.0%`/);
    assert.match(md, /Google AI Pro/);
  });

  it('formats hook markdown in table mode when requested', () => {
    const md = formatHookMarkdown(sampleSummary, 'Gemini 3.8 Flash', { format: 'table' });
    assert.match(md, /\| Model \| 5h Limit \| 1w Limit \|/);
    assert.match(md, /Gemini 3.8 Flash/);
  });

  it('formats CLI table output', () => {
    const cli = formatCliTable(sampleSummary, false, false);
    assert.match(cli, /AGQ HUD/);
    assert.match(cli, /Google AI Pro/);
    assert.match(cli, /Gemini 3.8 Flash/);
  });
});
