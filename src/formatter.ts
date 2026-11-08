import { ModelGroupQuota, NormalizedModelQuota, QuotaSummary } from './types.js';

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

function getStatusBadge(percentage: number): { emoji: string; text: string; colorCode: string } {
  if (percentage <= 0) {
    return { emoji: '🔴', text: 'Empty', colorCode: '\x1b[31m' }; // Red
  }
  if (percentage < 25) {
    return { emoji: '⚠️', text: 'Low', colorCode: '\x1b[33m' }; // Yellow
  }
  if (percentage < 60) {
    return { emoji: '🟡', text: 'Fair', colorCode: '\x1b[36m' }; // Cyan
  }
  return { emoji: '🟢', text: 'Good', colorCode: '\x1b[32m' }; // Green
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
export function formatCompactHookMarkdown(group: ModelGroupQuota, userTierName?: string): string {
  const badge = getStatusBadge(group.remainingPercentage);
  const bar = makeProgressBar(group.remainingPercentage, 10);
  const resetStr = formatTimeRemaining(group.timeUntilResetMs);
  const pctDisplay = `\`${group.remainingPercentage.toFixed(1)}%\``;
  const tier = userTierName ? ` &nbsp;·&nbsp; \`${userTierName}\`` : '';

  return `> 📊 **${group.family}** &nbsp;·&nbsp; ${pctDisplay} ${badge.emoji} \`${bar}\` &nbsp;·&nbsp; Reset: **${resetStr}**${tier}`;
}

/**
 * Formats Markdown HUD for Antigravity Chat UI (metadata.user_markdown)
 */
export function formatHookMarkdown(
  summary: QuotaSummary,
  currentModelName?: string,
  options?: { forceAll?: boolean; format?: 'compact' | 'table' }
): string {
  const forceAll = options?.forceAll ?? (process.env.AGQ_SHOW_ALL === '1');
  const preferTable = options?.format === 'table' || process.env.AGQ_HUD_FORMAT === 'table';

  const matchedGroup = !forceAll ? findMatchingGroup(summary.groups, currentModelName) : undefined;

  // When a single model is selected, display concise 1-line banner (unless table format is explicitly requested)
  if (matchedGroup && !preferTable) {
    return formatCompactHookMarkdown(matchedGroup, summary.userTierName);
  }

  // Otherwise, render table format
  const targetGroups = matchedGroup ? [matchedGroup] : summary.groups;
  const tier = summary.userTierName || 'Standard';
  const lines: string[] = [];

  lines.push(`> 📊 **AI Model Quota** &nbsp;·&nbsp; \`${tier}\``);
  lines.push(`> `);
  lines.push(`> | Model | Remaining | Bar | Reset In |`);
  lines.push(`> | :--- | :--- | :--- | :--- |`);

  for (const group of targetGroups) {
    const isCurrent = matchedGroup
      ? true
      : currentModelName &&
        (group.models.some((m) => currentModelName.toLowerCase().includes(m.family.toLowerCase())) ||
          currentModelName.toLowerCase().includes(group.family.toLowerCase()));

    const badge = getStatusBadge(group.remainingPercentage);
    const bar = makeProgressBar(group.remainingPercentage, 10);
    const resetStr = formatTimeRemaining(group.timeUntilResetMs);

    const nameDisplay = isCurrent && targetGroups.length > 1 ? `**${group.family}** 🎯` : `**${group.family}**`;
    const pctDisplay = `\`${group.remainingPercentage.toFixed(1)}%\``;

    lines.push(`> | ${nameDisplay} | ${pctDisplay} ${badge.emoji} | \`${bar}\` | ${resetStr} |`);
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
  filter?: string
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
      }))
    : summary.groups.map((g) => ({
        name: g.family,
        percentage: g.remainingPercentage,
        resetMs: g.timeUntilResetMs,
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
    const badge = getStatusBadge(item.percentage);
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
  if (!verbose && !filter && summary.allModels.length > summary.groups.length) {
    out.push(`${dimCode}Tip: Run with -v or --verbose to view all model sub-variants.${resetCode}`);
  }
  out.push('');

  return out.join('\n');
}
