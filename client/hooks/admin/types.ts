/** Shared response types for the admin dashboard API (/api/admin/*). */

export interface Pagination {
  page: number;
  limit: number;
  total: number;
  totalPages: number;
}

export interface KindCount {
  kind: string;
  count: number;
}

export interface StatusCount {
  status: string;
  count: number;
}

export interface DayPoint {
  date: string;
  count: number;
}

export interface OverviewData {
  days: number;
  kpis: {
    totalUsers: number;
    activeUsers: number;
    paidUsers: number;
    newUsers7d: number;
    newUsers30d: number;
    connectedAccounts: number;
    totalTasks: number;
    tasks24h: number;
    completedTasks: number;
    failedTasks: number;
    processingTasks: number;
    creditsConsumed: number;
    totalAssets: number;
  };
  taskStatus: StatusCount[];
  kindCounts: KindCount[];
  providers: { provider: string; count: number }[];
  assetTypes: { type: string; count: number }[];
  series: {
    newUsers: DayPoint[];
    tasks: DayPoint[];
    credits: DayPoint[];
  };
}

export interface AdminUserRow {
  id: string;
  clerkId: string;
  email: string;
  role: string;
  plan: string | null;
  isActive: boolean;
  isCancelled: boolean;
  status: string | null;
  stripeCurrentPeriodEnd: string | null;
  createdAt: string;
  credits: number;
  connectedAccounts: number;
  taskCount: number;
}

export interface AdminUsersResponse {
  users: AdminUserRow[];
  pagination: Pagination;
}

export interface AdminUserDetail {
  user: {
    id: string;
    clerkId: string;
    email: string;
    role: string;
    plan: string | null;
    isActive: boolean;
    isCancelled: boolean;
    status: string | null;
    stripeCustomerId: string | null;
    stripeSubscriptionId: string | null;
    stripePriceId: string | null;
    stripeCurrentPeriodEnd: string | null;
    createdAt: string;
    updatedAt: string;
  };
  credits: number;
  socialAccounts: {
    id: string;
    provider: string;
    accountName: string | null;
    accountUsername: string | null;
    profilePicture: string | null;
    expiresAt: string | null;
    createdAt: string;
  }[];
  creditGrants: {
    id: string;
    amount: number;
    used: number;
    source: string;
    reason: string | null;
    expiresAt: string | null;
    createdAt: string;
  }[];
  creditTransactions: {
    id: string;
    type: string;
    amount: number;
    reason: string;
    createdAt: string;
  }[];
  counts: { posts: number; assets: number; tasks: number };
  kindCounts: KindCount[];
  recentTasks: AdminTask[];
}

export interface AdminTask {
  id: string;
  kind: string;
  userId: string;
  userEmail?: string | null;
  status: string;
  credits: number;
  model: string | null;
  label: string | null;
  error: string | null;
  createdAt: string;
}

export interface AdminTasksResponse {
  tasks: AdminTask[];
  pagination: Pagination;
}

export interface AdminAsset {
  id: string;
  name: string;
  url: string;
  mimeType: string;
  type: string;
  source: string;
  width: number | null;
  height: number | null;
  duration: number | null;
  createdAt: string;
  user: { id: string; email: string } | null;
}

export interface AdminContentResponse {
  assets: AdminAsset[];
  typeCounts: { type: string; count: number }[];
  pagination: Pagination;
}

export interface TaskMedia {
  label: string;
  url: string;
  type: string; // IMAGE | VIDEO | AUDIO | DOCUMENT
  mimeType: string;
  name: string;
  thumbnailUrl?: string;
}

export interface AdminTaskDetail {
  id: string;
  kind: string;
  status: string;
  createdAt: string;
  updatedAt?: string;
  model: string | null;
  credits: number;
  error: string | null;
  text: string | null;
  params: unknown;
  outputs: TaskMedia[];
  inputs: TaskMedia[];
  meta: { label: string; value: string }[];
}

export interface AdminAnalyticsData {
  days: number;
  byKind: {
    kind: string;
    total: number;
    completed: number;
    failed: number;
    processing: number;
    credits: number;
    successRate: number;
  }[];
  statusTotals: StatusCount[];
  topModels: { model: string; count: number }[];
  seriesByKind: (Record<string, number> & { date: string })[];
}
