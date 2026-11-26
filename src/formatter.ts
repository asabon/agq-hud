import { ModelGroupQuota, QuotaBucketInfo, QuotaSummary, SignalMode } from './types.js';

export interface StatusBadge {
  emoji: string;
  text: string;
  colorCode: string;
}

const WEEKLY_WINDOW_MS = 7 * 24 * 60 * 60 * 1000;
const SMART_WARMUP_W0 = 15;
const SMART_GREEN_HOLD_RATIO = 0.90;
const SMART_YELLOW_HOLD_RATIO = 0.60;
const THRESHOLD_GREEN_PCT = 60;
const THRESHOLD_YELLOW_PCT = 25;

export function formatTimeRemaining(ms?: number): string {
  if (ms === undefined || isNaN(ms)) return 'Unknown';
  if (ms <= 0) return 'Reset now';

  const totalMinutes = Math.floor(ms / (1000 * 60));
  const totalHours = Math.floor(totalMinutes / 60);
  const days = Math.floor(totalHours / 24);
  const hours = totalHours % 24;
  const minutes = totalMinutes % 60;

  if (days > 0) {
    return `${days}d ${hours}h`;
  }
  if (hours > 0) {
    return `${hours}h ${minutes}m`;
  }
  if (minutes > 0) {
    return `${minutes}m`;
  }
  return '< 1m';
}

export function makeProgressBar(percentage: number, width = 10): string {
  const clamped = Math.max(0, Math.min(100, percentage));
  const filledCount = Math.round((clamped / 100) * width);
  const emptyCount = width - filledCount;

  return '█'.repeat(filledCount) + '░'.repeat(emptyCount);
}

export function getThresholdBadge(percentage: number): StatusBadge {
  if (percentage <= 0) {
    return { emoji: '🔴', text: 'Empty', colorCode: '\x1b[31m' }; // Red
  }
  if (percentage < THRESHOLD_YELLOW_PCT) {
    return { emoji: '🔴', text: 'Low', colorCode: '\x1b[31m' }; // Red
  }
  if (percentage < THRESHOLD_GREEN_PCT) {
    return { emoji: '🟡', text: 'Fair', colorCode: '\x1b[33m' }; // Yellow
  }
  return { emoji: '🟢', text: 'Good', colorCode: '\x1b[32m' }; // Green
}

/**
 * Calculates the smoothed HoldRatio for a 1-week quota bucket.
 *
 * Uses a continuous warmup buffer W0 to avoid abrupt threshold jumps at reset boundaries:
 * - e = 100 - r_t (elapsed time percentage)
 * - U = 100 - R (used quota percentage)
 * - P = (U + W0) / (e + W0) (smoothed consumption pace)
 * - HoldRatio = (R / P) / r_t
 */
export function calculateWeeklyHoldRatio(remainingPercentage: number, timeUntilResetMs: number): number {
  const remaining = Math.max(0, Math.min(100, remainingPercentage));
  if (remaining <= 0) {
    return 0;
  }

  const remainingTimePct = Math.max(0, Math.min(100, (timeUntilResetMs / WEEKLY_WINDOW_MS) * 100));
  if (remainingTimePct <= 0) {
    return Number.POSITIVE_INFINITY;
  }

  const elapsedPct = 100 - remainingTimePct;
  const usedPct = 100 - remaining;
  const smoothedPace = (usedPct + SMART_WARMUP_W0) / (elapsedPct + SMART_WARMUP_W0);

  return remaining / smoothedPace / remainingTimePct;
}

export function getSmartWeeklyBadge(percentage: number, timeUntilResetMs?: number): StatusBadge {
  if (percentage <= 0) {
    return { emoji: '🔴', text: 'Empty', colorCode: '\x1b[31m' }; // Red
  }
  if (timeUntilResetMs === undefined || Number.isNaN(timeUntilResetMs)) {
    return getThresholdBadge(percentage);
  }

  const holdRatio = calculateWeeklyHoldRatio(percentage, timeUntilResetMs);
  if (holdRatio >= SMART_GREEN_HOLD_RATIO) {
    return { emoji: '🟢', text: 'Good', colorCode: '\x1b[32m' }; // Green
  }
  if (holdRatio >= SMART_YELLOW_HOLD_RATIO) {
    return { emoji: '🟡', text: 'Fair', colorCode: '\x1b[33m' }; // Yellow
  }
  return { emoji: '🔴', text: 'Low', colorCode: '\x1b[31m' }; // Red
}

export interface StatusBadgeOptions {
  signalMode?: SignalMode;
  window?: string;
  timeUntilResetMs?: number;
}

export function getStatusBadge(percentage: number, options?: StatusBadgeOptions): StatusBadge {
  const mode = options?.signalMode ?? 'smart';
  const win = (options?.window || '').toLowerCase();
  const isWeekly = win === 'weekly' || win === '1w';

  if (mode === 'smart' && isWeekly) {
    return getSmartWeeklyBadge(percentage, options?.timeUntilResetMs);
  }
  return getThresholdBadge(percentage);
}

function getBucketBadge(
  bucket: QuotaBucketInfo,
  signalMode: SignalMode,
  fallbackWindow?: string
): StatusBadge {
  return getStatusBadge(bucket.remainingPercentage, {
    signalMode,
    window: bucket.window || fallbackWindow,
    timeUntilResetMs: bucket.timeUntilResetMs,
  });
}

/**
 * Finds matching model group for a given model name/identifier
 */
export function findMatchingGroup(
  groups: ModelGroupQuota[],
  currentModelName?: string
): ModelGroupQuota | undefined {
  if (!currentModelName) return undefined;

  const raw = currentModelName.trim().toLowerCase();
  if (!raw || raw === 'inherit') return undefined;

  const normalize = (s: string) => s.toLowerCase().replace(/[-_.]/g, ' ').replace(/\s+/g, ' ').trim();
  const normalizedRaw = normalize(raw);

  // 1. Direct label or modelId match
  for (const group of groups) {
    for (const m of group.models) {
      const normLabel = normalize(m.label);
      const normId = normalize(m.modelId);
      if (
        normLabel === normalizedRaw ||
        normId === normalizedRaw ||
        normLabel.includes(normalizedRaw) ||
        normalizedRaw.includes(normLabel) ||
        normId.includes(normalizedRaw) ||
        normalizedRaw.includes(normId)
      ) {
        return group;
      }
    }
  }

  // 2. Family match
  for (const group of groups) {
    const normFamily = normalize(group.family);
    if (normFamily === normalizedRaw || normFamily.includes(normalizedRaw) || normalizedRaw.includes(normFamily)) {
      return group;
    }
  }

  // 3. Keyword/token-based fuzzy match (e.g. "flash", "opus", "sonnet", "argon")
  const tokens = normalizedRaw.split(' ').filter((t) => t.length > 2);
  for (const group of groups) {
    const normFamily = normalize(group.family);
    if (tokens.some((token) => normFamily.includes(token))) {
      return group;
    }
  }

  return undefined;
}

/**
 * Formats a single model group as a concise one-line banner HUD
 */
export function formatCompactHookMarkdown(
  group: ModelGroupQuota,
  userTierName?: string,
  signalMode: SignalMode = 'smart'
): string {
  const tier = userTierName ? ` &nbsp;·&nbsp; \`${userTierName}\`` : '';

  // If both 5h and weekly limits are available:
  if (group.limit5h && group.limitWeekly) {
    const badge5h = getBucketBadge(group.limit5h, signalMode, '5h');
    const badgeW = getBucketBadge(group.limitWeekly, signalMode, 'weekly');
    const reset5h = formatTimeRemaining(group.limit5h.timeUntilResetMs);
    const resetW = formatTimeRemaining(group.limitWeekly.timeUntilResetMs);

    return `> 📊 **${group.family}** &nbsp;·&nbsp; 5h: \`${group.limit5h.remainingPercentage.toFixed(1)}%\` ${badge5h.emoji} (${reset5h}) &nbsp;·&nbsp; 1w: \`${group.limitWeekly.remainingPercentage.toFixed(1)}%\` ${badgeW.emoji} (${resetW})${tier}`;
  }

  // If only weekly limit is available (e.g. Gemini 4 Argon):
  if (group.limitWeekly && !group.limit5h) {
    const badgeW = getBucketBadge(group.limitWeekly, signalMode, 'weekly');
    const bar = makeProgressBar(group.limitWeekly.remainingPercentage, 10);
    const resetW = formatTimeRemaining(group.limitWeekly.timeUntilResetMs);
    return `> 📊 **${group.family}** &nbsp;·&nbsp; 1w: \`${group.limitWeekly.remainingPercentage.toFixed(1)}%\` ${badgeW.emoji} \`${bar}\` &nbsp;·&nbsp; Reset: **${resetW}**${tier}`;
  }

  // Fallback to single percentage format:
  const badge = getStatusBadge(group.remainingPercentage, { signalMode });
  const bar = makeProgressBar(group.remainingPercentage, 10);
  const resetStr = formatTimeRemaining(group.timeUntilResetMs);
  const pctDisplay = `\`${group.remainingPercentage.toFixed(1)}%\``;

  return `> 📊 **${group.family}** &nbsp;·&nbsp; ${pctDisplay} ${badge.emoji} \`${bar}\` &nbsp;·&nbsp; Reset: **${resetStr}**${tier}`;
}

/**
 * Formats a concise, glanceable title for the Chat UI HUD accordion header.
 *
 * @param summary - Parsed quota summary containing model groups and tier information.
 * @param currentModelName - Optional current model name to highlight or filter.
 * @param options - Options controlling whether to show all models or a single model group and signal mode.
 * @returns Formatted title string including status badges and reset times.
 */
export function formatHookTitle(
  summary: QuotaSummary,
  currentModelName?: string,
  options?: { forceAll?: boolean; signalMode?: SignalMode }
): string {
  const forceAll = options?.forceAll ?? (process.env.AGQ_SHOW_ALL === '1');
  const signalMode = options?.signalMode ?? 'smart';
  const matchedGroup = !forceAll ? findMatchingGroup(summary.groups, currentModelName) : undefined;

  if (matchedGroup) {
    if (matchedGroup.limit5h && matchedGroup.limitWeekly) {
      const b5h = getBucketBadge(matchedGroup.limit5h, signalMode, '5h').emoji;
      const bW = getBucketBadge(matchedGroup.limitWeekly, signalMode, 'weekly').emoji;
      return `⚡ Quota: ${matchedGroup.family} · 5h: ${matchedGroup.limit5h.remainingPercentage.toFixed(1)}% ${b5h} · 1w: ${matchedGroup.limitWeekly.remainingPercentage.toFixed(1)}% ${bW}`;
    }
    if (matchedGroup.limitWeekly && !matchedGroup.limit5h) {
      const bW = getBucketBadge(matchedGroup.limitWeekly, signalMode, 'weekly').emoji;
      return `⚡ Quota: ${matchedGroup.family} · 1w: ${matchedGroup.limitWeekly.remainingPercentage.toFixed(1)}% ${bW}`;
    }
    const b = getStatusBadge(matchedGroup.remainingPercentage, { signalMode }).emoji;
    return `⚡ Quota: ${matchedGroup.family} · ${matchedGroup.remainingPercentage.toFixed(1)}% ${b}`;
  }

  const tier = summary.userTierName ? ` (${summary.userTierName})` : '';
  return `⚡ Model Quota HUD${tier}`;
}

/**
 * Formats Markdown HUD for Antigravity Chat UI (metadata.user_markdown)
 */
export function formatHookMarkdown(
  summary: QuotaSummary,
  currentModelName?: string,
  options?: { forceAll?: boolean; format?: 'compact' | 'table'; signalMode?: SignalMode }
): string {
  const forceAll = options?.forceAll ?? (process.env.AGQ_SHOW_ALL === '1');
  const preferTable = options?.format === 'table' || process.env.AGQ_HUD_FORMAT === 'table';
  const signalMode = options?.signalMode ?? 'smart';

  const matchedGroup = !forceAll ? findMatchingGroup(summary.groups, currentModelName) : undefined;

  // When a single model is selected, display concise 1-line banner (unless table format is explicitly requested)
  if (matchedGroup && !preferTable) {
    return formatCompactHookMarkdown(matchedGroup, summary.userTierName, signalMode);
  }

  // Otherwise, render table format
  const targetGroups = matchedGroup ? [matchedGroup] : summary.groups;
  const tier = summary.userTierName || 'Standard';
  const hasMultiWindow = targetGroups.some((g) => g.limit5h !== undefined || g.limitWeekly !== undefined);
  const lines: string[] = [];

  lines.push(`> 📊 **AI Model Quota** &nbsp;·&nbsp; \`${tier}\``);
  lines.push(`> `);

  if (hasMultiWindow) {
    lines.push(`> | Model | 5h Limit | 1w Limit | Reset (5h) | Reset (1w) |`);
    lines.push(`> | :--- | :--- | :--- | :--- | :--- |`);

    for (const group of targetGroups) {
      const isCurrent = matchedGroup
        ? true
        : currentModelName &&
          (group.models.some((m) => currentModelName.toLowerCase().includes(m.family.toLowerCase())) ||
            currentModelName.toLowerCase().includes(group.family.toLowerCase()));

      const nameDisplay = isCurrent && targetGroups.length > 1 ? `**${group.family}** 🎯` : `**${group.family}**`;

      const p5h = group.limit5h
        ? `\`${group.limit5h.remainingPercentage.toFixed(1)}%\` ${getBucketBadge(group.limit5h, signalMode, '5h').emoji}`
        : '-';
      const pW = group.limitWeekly
        ? `\`${group.limitWeekly.remainingPercentage.toFixed(1)}%\` ${getBucketBadge(group.limitWeekly, signalMode, 'weekly').emoji}`
        : '-';

      const reset5h = group.limit5h ? formatTimeRemaining(group.limit5h.timeUntilResetMs) : '-';
      const resetW = group.limitWeekly ? formatTimeRemaining(group.limitWeekly.timeUntilResetMs) : '-';

      lines.push(`> | ${nameDisplay} | ${p5h} | ${pW} | ${reset5h} | ${resetW} |`);
    }
  } else {
    lines.push(`> | Model | Remaining | Bar | Reset In |`);
    lines.push(`> | :--- | :--- | :--- | :--- |`);

    for (const group of targetGroups) {
      const isCurrent = matchedGroup
        ? true
        : currentModelName &&
          (group.models.some((m) => currentModelName.toLowerCase().includes(m.family.toLowerCase())) ||
            currentModelName.toLowerCase().includes(group.family.toLowerCase()));

      const badge = getStatusBadge(group.remainingPercentage, { signalMode });
      const bar = makeProgressBar(group.remainingPercentage, 10);
      const resetStr = formatTimeRemaining(group.timeUntilResetMs);

      const nameDisplay = isCurrent && targetGroups.length > 1 ? `**${group.family}** 🎯` : `**${group.family}**`;
      const pctDisplay = `\`${group.remainingPercentage.toFixed(1)}%\``;

      lines.push(`> | ${nameDisplay} | ${pctDisplay} ${badge.emoji} | \`${bar}\` | ${resetStr} |`);
    }
  }

  return lines.join('\n');
}

/**
 * Formats CLI Terminal Table
 */
export function formatCliTable(
  summary: QuotaSummary,
  verbose = false,
  isTty = true,
  filter?: string,
  signalMode: SignalMode = 'smart'
): string {
  const resetCode = isTty ? '\x1b[0m' : '';
  const boldCode = isTty ? '\x1b[1m' : '';
  const dimCode = isTty ? '\x1b[2m' : '';

  const out: string[] = [];
  out.push('');
  out.push(`${boldCode}⚡ AGQ HUD — Model Quota Monitor${resetCode}`);
  out.push(`${dimCode}Tier: ${resetCode}${boldCode}${summary.userTierName || 'Standard'}${resetCode}${
    summary.userEmail ? ` ${dimCode}(${summary.userEmail})${resetCode}` : ''
  }`);
  out.push('');

  let targetList = verbose
    ? summary.allModels.map((m) => ({
        name: m.label,
        percentage: m.remainingPercentage,
        resetMs: m.timeUntilResetMs,
        limit5h: m.limit5h,
        limitWeekly: m.limitWeekly,
      }))
    : summary.groups.map((g) => ({
        name: g.family,
        percentage: g.remainingPercentage,
        resetMs: g.timeUntilResetMs,
        limit5h: g.limit5h,
        limitWeekly: g.limitWeekly,
      }));

  if (filter) {
    const f = filter.toLowerCase().trim();
    targetList = targetList.filter((item) => item.name.toLowerCase().includes(f));
    if (targetList.length === 0) {
      out.push(`${dimCode}No models matched filter: "${filter}"${resetCode}`);
      out.push('');
      return out.join('\n');
    }
  }

  const hasMultiWindow = targetList.some((item) => item.limit5h !== undefined || item.limitWeekly !== undefined);

  if (hasMultiWindow) {
    const maxNameLen = Math.max(16, ...targetList.map((item) => item.name.length));
    const colName = maxNameLen + 2;
    const col5h = 14;
    const col1w = 14;
    const colReset5h = 14;
    const colReset1w = 14;

    const sep = '─'.repeat(colName + col5h + col1w + colReset5h + colReset1w + 5);

    out.push(sep);
    out.push(
      ` ${'Model'.padEnd(colName)}${'5h Limit'.padEnd(col5h)}${'Weekly Limit'.padEnd(col1w)}${'Reset (5h)'.padEnd(
        colReset5h
      )}${'Reset (1w)'.padEnd(colReset1w)}`
    );
    out.push(sep);

    for (const item of targetList) {
      const nameCol = item.name.padEnd(colName);

      let p5hStr = '-';
      let color5h = '';
      if (item.limit5h) {
        const badge = getBucketBadge(item.limit5h, signalMode, '5h');
        color5h = isTty ? badge.colorCode : '';
        p5hStr = `${item.limit5h.remainingPercentage.toFixed(1)}% ${badge.emoji}`;
      }
      const col5hText = `${color5h}${p5hStr.padEnd(col5h)}${resetCode}`;

      let pWStr = '-';
      let colorW = '';
      if (item.limitWeekly) {
        const badge = getBucketBadge(item.limitWeekly, signalMode, 'weekly');
        colorW = isTty ? badge.colorCode : '';
        pWStr = `${item.limitWeekly.remainingPercentage.toFixed(1)}% ${badge.emoji}`;
      }
      const col1wText = `${colorW}${pWStr.padEnd(col1w)}${resetCode}`;

      const reset5hStr = item.limit5h ? formatTimeRemaining(item.limit5h.timeUntilResetMs) : '-';
      const resetWStr = item.limitWeekly ? formatTimeRemaining(item.limitWeekly.timeUntilResetMs) : '-';

      const reset5hCol = reset5hStr.padEnd(colReset5h);
      const resetWCol = resetWStr.padEnd(colReset1w);

      out.push(` ${nameCol}${col5hText}${col1wText}${reset5hCol}${resetWCol}`);
    }

    out.push(sep);
  } else {
    // Column widths
    const maxNameLen = Math.max(16, ...targetList.map((item) => item.name.length));
    const colName = maxNameLen + 2;
    const colPct = 10;
    const colBar = 14;
    const colReset = 14;

    const sep = '─'.repeat(colName + colPct + colBar + colReset + 5);

    out.push(sep);
    out.push(
      ` ${'Model'.padEnd(colName)}${'Remaining'.padEnd(colPct)}${'Gauge'.padEnd(colBar)}${'Resets In'.padEnd(colReset)}`
    );
    out.push(sep);

    for (const item of targetList) {
      const badge = getStatusBadge(item.percentage, { signalMode });
      const color = isTty ? badge.colorCode : '';
      const bar = `[${makeProgressBar(item.percentage, 10)}]`;
      const pctStr = `${item.percentage.toFixed(1)}%`;
      const resetStr = formatTimeRemaining(item.resetMs);

      const nameCol = item.name.padEnd(colName);
      const pctCol = `${color}${pctStr.padEnd(colPct)}${resetCode}`;
      const barCol = `${color}${bar.padEnd(colBar)}${resetCode}`;
      const resetCol = resetStr.padEnd(colReset);

      out.push(` ${nameCol}${pctCol}${barCol}${resetCol}`);
    }

    out.push(sep);
  }

  if (!verbose && !filter && summary.allModels.length > summary.groups.length) {
    out.push(`${dimCode}Tip: Run with -v or --verbose to view all model sub-variants.${resetCode}`);
  }
  out.push('');

  return out.join('\n');
}
