import http from 'http';
import {
  ConnectionInfo,
  GetUserStatusResponse,
  ModelGroupQuota,
  NormalizedModelQuota,
  QuotaSummary,
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

export function parseQuotaSummary(data: GetUserStatusResponse): QuotaSummary {
  const userStatus = data.userStatus;
  const userTierName = userStatus?.userTier?.name || userStatus?.planStatus?.planInfo?.planName || 'Standard';
  const planName = userStatus?.planStatus?.planInfo?.planName;
  const userEmail = userStatus?.email;

  const rawConfigs = userStatus?.cascadeModelConfigData?.clientModelConfigs || [];
  const now = new Date();

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

      return {
        label: c.label,
        modelId: c.modelId,
        family,
        tierVariant: variant,
        remainingPercentage,
        resetTime: c.quotaInfo!.resetTime,
        resetDate,
        timeUntilResetMs,
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
    // Representative model in this family (usually all variants share the same quota)
    const rep = models[0];
    groups.push({
      family,
      remainingPercentage: rep.remainingPercentage,
      resetTime: rep.resetTime,
      timeUntilResetMs: rep.timeUntilResetMs,
      models,
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
