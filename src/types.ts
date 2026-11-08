export interface QuotaInfo {
  remainingFraction: number; // 0.0 to 1.0 (e.g. 0.7776864)
  resetTime: string; // ISO 8601 string, e.g. "2026-11-08T07:57:23Z"
}

export interface ClientModelConfig {
  label: string;
  modelId: string;
  quotaInfo?: QuotaInfo;
  tagTitle?: string;
  tagDescription?: string;
  allowedTiers?: string[];
  supportsImages?: boolean;
}

export interface UserTier {
  id: string;
  name: string;
  description: string;
  upgradeSubscriptionUri?: string;
  upgradeSubscriptionText?: string;
}

export interface PlanInfo {
  teamsTier?: string;
  planName?: string;
  monthlyPromptCredits?: number;
  monthlyFlowCredits?: number;
}

export interface PlanStatus {
  planInfo?: PlanInfo;
  availablePromptCredits?: number;
  availableFlowCredits?: number;
}

export interface UserStatus {
  name?: string;
  email?: string;
  userTier?: UserTier;
  planStatus?: PlanStatus;
  cascadeModelConfigData?: {
    clientModelConfigs?: ClientModelConfig[];
    clientModelSorts?: Array<{
      name: string;
      groups: Array<{
        modelLabels: string[];
      }>;
    }>;
  };
}

export interface GetUserStatusResponse {
  userStatus?: UserStatus;
}

export interface ServerQuotaBucket {
  bucketId?: string;
  displayName?: string;
  description?: string;
  window?: string;
  remainingFraction?: number;
  resetTime?: string;
}

export interface ServerQuotaGroup {
  displayName?: string;
  description?: string;
  buckets?: ServerQuotaBucket[];
}

export interface ServerUserQuotaSummaryResponse {
  response?: {
    groups?: ServerQuotaGroup[];
    description?: string;
  };
}

export interface ConnectionInfo {
  address: string; // "localhost:62387" or "127.0.0.1:62387"
  csrfToken: string;
  source: 'env' | 'process';
}

export interface QuotaBucketInfo {
  bucketId: string;
  displayName: string;
  description?: string;
  window: '5h' | 'weekly' | string;
  remainingFraction?: number;
  remainingPercentage: number;
  resetTime?: string;
  resetDate?: Date;
  timeUntilResetMs?: number;
}

export interface NormalizedModelQuota {
  label: string;
  modelId: string;
  family: string;
  tierVariant: string; // "Low", "Medium", "High", or ""
  remainingPercentage: number; // 0 - 100
  resetTime?: string;
  resetDate?: Date;
  timeUntilResetMs?: number;
  limit5h?: QuotaBucketInfo;
  limitWeekly?: QuotaBucketInfo;
}

export interface ModelGroupQuota {
  family: string;
  remainingPercentage: number;
  resetTime?: string;
  timeUntilResetMs?: number;
  models: NormalizedModelQuota[];
  limit5h?: QuotaBucketInfo;
  limitWeekly?: QuotaBucketInfo;
  buckets: QuotaBucketInfo[];
}

export interface QuotaSummary {
  userTierName?: string;
  planName?: string;
  userEmail?: string;
  groups: ModelGroupQuota[];
  allModels: NormalizedModelQuota[];
}

// Hook Input/Output types
export interface HookSystemMessageMetadata {
  user_markdown?: string;
  [key: string]: unknown;
}

export interface HookSystemMessage {
  systemMessage: {
    systemMessage: string;
    metadata?: HookSystemMessageMetadata;
  };
}

export interface HookPreInvocationOutput {
  injectSteps?: HookSystemMessage[];
  terminationBehavior?: string;
}

export interface HookInput {
  conversationId?: string;
  workspacePaths?: string[];
  transcriptPath?: string;
  artifactDirectoryPath?: string;
  modelName?: string;
  lastUserInput?: string;
  invocationNum?: number;
  initialNumSteps?: number;
  [key: string]: unknown;
}
