import http from 'http';
import {
  ConnectionInfo,
  GetUserStatusResponse,
  ModelGroupQuota,
  NormalizedModelQuota,
  QuotaBucketInfo,
  QuotaSummary,
  ServerUserQuotaSummaryResponse,
} from './types.js';

export function fetchUserStatus(conn: ConnectionInfo, timeoutMs = 3000): Promise<GetUserStatusResponse> {
  return new Promise((resolve, reject) => {
    let host = 'localhost';
    let port = 80;

    if (conn.address.includes(':')) {
      const parts = conn.address.split(':');
      host = parts[0] || 'localhost';
      port = Number(parts[1]) || 80;
    } else {
      host = conn.address;
    }

    const postData = '{}';

    const req = http.request(
      {
        hostname: host,
        port,
        path: '/exa.language_server_pb.LanguageServerService/GetUserStatus',
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'x-codeium-csrf-token': conn.csrfToken,
          'Content-Length': Buffer.byteLength(postData),
        },
        timeout: timeoutMs,
      },
      (res) => {
        let body = '';
        res.setEncoding('utf8');
        res.on('data', (chunk) => {
          body += chunk;
        });
        res.on('end', () => {
          if (res.statusCode && res.statusCode >= 200 && res.statusCode < 300) {
            try {
              const data = JSON.parse(body) as GetUserStatusResponse;
              resolve(data);
            } catch (err) {
              reject(new Error(`Failed to parse response JSON: ${(err as Error).message}`));
            }
          } else {
            reject(new Error(`RPC returned status code ${res.statusCode}: ${body.slice(0, 100)}`));
          }
        });
      }
    );

    req.on('error', (err) => reject(err));
    req.on('timeout', () => {
      req.destroy();
      reject(new Error(`Request timed out after ${timeoutMs}ms`));
    });

    req.write(postData);
    req.end();
  });
}

export function fetchUserQuotaSummary(
  conn: ConnectionInfo,
  timeoutMs = 3000
): Promise<ServerUserQuotaSummaryResponse | undefined> {
  return new Promise((resolve) => {
    let host = 'localhost';
    let port = 80;

    if (conn.address.includes(':')) {
      const parts = conn.address.split(':');
      host = parts[0] || 'localhost';
      port = Number(parts[1]) || 80;
    } else {
      host = conn.address;
    }

    const postData = JSON.stringify({
      metadata: {
        ideName: 'antigravity',
        extensionName: 'antigravity',
        locale: 'en',
      },
    });

    const req = http.request(
      {
        hostname: host,
        port,
        path: '/exa.language_server_pb.LanguageServerService/RetrieveUserQuotaSummary',
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Connect-Protocol-Version': '1',
          'x-codeium-csrf-token': conn.csrfToken,
          'Content-Length': Buffer.byteLength(postData),
        },
        timeout: timeoutMs,
      },
      (res) => {
        let body = '';
        res.setEncoding('utf8');
        res.on('data', (chunk) => {
          body += chunk;
        });
        res.on('end', () => {
          if (res.statusCode && res.statusCode >= 200 && res.statusCode < 300) {
            try {
              const data = JSON.parse(body) as ServerUserQuotaSummaryResponse;
              resolve(data);
            } catch {
              resolve(undefined);
            }
          } else {
            resolve(undefined);
          }
        });
      }
    );

    req.on('error', () => resolve(undefined));
    req.on('timeout', () => {
      req.destroy();
      resolve(undefined);
    });

    req.write(postData);
    req.end();
  });
}

export async function fetchFullQuota(
  conn: ConnectionInfo,
  timeoutMs = 3000
): Promise<{ statusData: GetUserStatusResponse; quotaSummaryData?: ServerUserQuotaSummaryResponse }> {
  const [statusResult, summaryResult] = await Promise.allSettled([
    fetchUserStatus(conn, timeoutMs),
    fetchUserQuotaSummary(conn, timeoutMs),
  ]);

  if (statusResult.status === 'rejected') {
    throw statusResult.reason;
  }

  const statusData = statusResult.value;
  const quotaSummaryData = summaryResult.status === 'fulfilled' ? summaryResult.value : undefined;

  return { statusData, quotaSummaryData };
}

function parseModelFamily(label: string): { family: string; variant: string } {
  // Label example: "Gemini 4 Argon (Medium)", "Claude Opus 5.5 (Low)", "Claude Sonnet 5.5 (High)"
  const match = label.match(/^(.*?)(?:\s*\((Low|Medium|High)\))?$/i);
  if (match) {
    return {
      family: match[1].trim(),
      variant: match[2] || '',
    };
  }
  return { family: label, variant: '' };
}

interface ParsedGroupBucket {
  displayName: string;
  buckets: QuotaBucketInfo[];
  limit5h?: QuotaBucketInfo;
  limitWeekly?: QuotaBucketInfo;
}

function parseServerQuotaGroups(
  quotaSummary?: ServerUserQuotaSummaryResponse,
  now: Date = new Date()
): ParsedGroupBucket[] {
  const rawGroups = quotaSummary?.response?.groups || [];
  const result: ParsedGroupBucket[] = [];

  for (const g of rawGroups) {
    const displayName = g.displayName || 'Unknown Group';
    const buckets: QuotaBucketInfo[] = [];
    let limit5h: QuotaBucketInfo | undefined;
    let limitWeekly: QuotaBucketInfo | undefined;

    for (const b of g.buckets || []) {
      const bucketId = b.bucketId || 'unknown';
      const bDisplayName = b.displayName || bucketId;
      const window = (b.window || '').toLowerCase();
      const fraction = b.remainingFraction ?? 1.0;
      const remainingPercentage = Math.round(fraction * 1000) / 10;

      let resetDate: Date | undefined;
      let timeUntilResetMs: number | undefined;
      if (b.resetTime) {
        resetDate = new Date(b.resetTime);
        timeUntilResetMs = Math.max(0, resetDate.getTime() - now.getTime());
      }

      const bucketInfo: QuotaBucketInfo = {
        bucketId,
        displayName: bDisplayName,
        description: b.description,
        window: window === 'weekly' ? 'weekly' : window === '5h' ? '5h' : window,
        remainingFraction: fraction,
        remainingPercentage,
        resetTime: b.resetTime,
        resetDate,
        timeUntilResetMs,
      };

      buckets.push(bucketInfo);

      if (window === '5h' || bucketId.includes('5h')) {
        limit5h = bucketInfo;
      } else if (window === 'weekly' || bucketId.includes('weekly')) {
        limitWeekly = bucketInfo;
      }
    }

    result.push({
      displayName,
      buckets,
      limit5h,
      limitWeekly,
    });
  }

  return result;
}

function findServerGroupForFamily(family: string, groups: ParsedGroupBucket[]): ParsedGroupBucket | undefined {
  const f = family.toLowerCase().trim();
  if (f.includes('argon')) {
    return groups.find((g) => g.displayName.toLowerCase().includes('argon'));
  }
  if (f.includes('gemini')) {
    return groups.find(
      (g) => g.displayName.toLowerCase().includes('gemini') && !g.displayName.toLowerCase().includes('argon')
    );
  }
  if (f.includes('claude') || f.includes('gpt')) {
    return groups.find(
      (g) => g.displayName.toLowerCase().includes('claude') || g.displayName.toLowerCase().includes('gpt')
    );
  }
  return groups.find((g) => {
    const d = g.displayName.toLowerCase();
    return d.includes(f) || f.includes(d);
  });
}

export function parseQuotaSummary(
  data: GetUserStatusResponse,
  quotaSummaryData?: ServerUserQuotaSummaryResponse
): QuotaSummary {
  const userStatus = data.userStatus;
  const userTierName = userStatus?.userTier?.name || userStatus?.planStatus?.planInfo?.planName || 'Standard';
  const planName = userStatus?.planStatus?.planInfo?.planName;
  const userEmail = userStatus?.email;

  const rawConfigs = userStatus?.cascadeModelConfigData?.clientModelConfigs || [];
  const now = new Date();
  const parsedServerGroups = parseServerQuotaGroups(quotaSummaryData, now);

  const allModels: NormalizedModelQuota[] = rawConfigs
    .filter((c) => c.quotaInfo !== undefined)
    .map((c) => {
      const { family, variant } = parseModelFamily(c.label);
      const remainingFraction = c.quotaInfo!.remainingFraction;
      const remainingPercentage = Math.round(remainingFraction * 1000) / 10; // 1 decimal place

      let resetDate: Date | undefined;
      let timeUntilResetMs: number | undefined;

      if (c.quotaInfo!.resetTime) {
        resetDate = new Date(c.quotaInfo!.resetTime);
        timeUntilResetMs = Math.max(0, resetDate.getTime() - now.getTime());
      }

      const serverGroup = findServerGroupForFamily(family, parsedServerGroups);

      return {
        label: c.label,
        modelId: c.modelId,
        family,
        tierVariant: variant,
        remainingPercentage,
        resetTime: c.quotaInfo!.resetTime,
        resetDate,
        timeUntilResetMs,
        limit5h: serverGroup?.limit5h,
        limitWeekly: serverGroup?.limitWeekly,
      };
    });

  // Group models by family or shared quota
  const groupMap = new Map<string, NormalizedModelQuota[]>();
  for (const m of allModels) {
    if (!groupMap.has(m.family)) {
      groupMap.set(m.family, []);
    }
    groupMap.get(m.family)!.push(m);
  }

  const groups: ModelGroupQuota[] = [];
  for (const [family, models] of groupMap.entries()) {
    const rep = models[0];
    const serverGroup = findServerGroupForFamily(family, parsedServerGroups);

    // If 5h limit exists from server group, use it as primary percentage/reset for the group, or fallback to rep
    const primaryPercentage = serverGroup?.limit5h?.remainingPercentage ?? rep.remainingPercentage;
    const primaryResetTime = serverGroup?.limit5h?.resetTime ?? rep.resetTime;
    const primaryResetMs = serverGroup?.limit5h?.timeUntilResetMs ?? rep.timeUntilResetMs;

    groups.push({
      family,
      remainingPercentage: primaryPercentage,
      resetTime: primaryResetTime,
      timeUntilResetMs: primaryResetMs,
      models,
      limit5h: serverGroup?.limit5h,
      limitWeekly: serverGroup?.limitWeekly,
      buckets: serverGroup?.buckets || [],
    });
  }

  return {
    userTierName,
    planName,
    userEmail,
    groups,
    allModels,
  };
}
