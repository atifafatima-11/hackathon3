// Shared types for RecallOps

export interface Incident {
  id: string;
  title: string;
  service: string;
  severity: string;
  status: string;
  description: string | null;
  logs: string | null;
  error_message: string | null;
  recent_changes: string | null;
  affected_component: string | null;
  root_cause: string | null;
  investigation_steps: string[] | null;
  failed_attempts: string | null;
  successful_fix: string | null;
  impact: string | null;
  lessons_learned: string | null;
  analysis: AnalysisResult | null;
  recalled_memories: RecalledMemory[] | null;
  memory_stored: boolean;
  created_at: string;
  resolved_at: string | null;
}

export interface AnalysisResult {
  summary: string;
  currentEvidence: string[];
  historicalMemory: HistoricalMemoryEntry[];
  inference: string[];
  investigationPlan: string[];
  recommendations: string[];
  confidence: string;
  memoryRecalled: boolean;
}

export interface HistoricalMemoryEntry {
  incidentId: string;
  service: string;
  date: string;
  symptoms: string;
  rootCause: string;
  failedAttempts: string;
  successfulFix: string;
  lessonsLearned: string;
  relevance: string;
}

export interface RecalledMemory {
  id: string;
  text: string;
  type: string;
  score: number;
  entities: string[];
  occurred_start: string | null;
}

export interface MemoryStatus {
  available: boolean;
  bankExists: boolean;
  bankId: string | null;
  error: string | null;
  resolvedIncidents: number;
  storedMemories: number;
  llmConfigured: boolean;
  llmModel: string | null;
}

export interface SettingsResponse {
  llm_base_url: string | null;
  llm_model: string | null;
  llm_api_key_configured: boolean;
  hindsight_base_url: string | null;
  hindsight_bank_id: string | null;
  hindsight_api_key_configured: boolean;
}

export interface SeedResult {
  seeded: number;
  memoryStored: number;
  memoryFailed: number;
  memoryErrors?: string[];
  message: string;
}

export interface AnalyzeResponse {
  analysis: AnalysisResult;
  recalledMemories: RecalledMemory[];
  memoryAvailable: boolean;
  memoryError?: string;
}

export interface ResolveResponse {
  incident: Incident;
  memoryStored: boolean;
  memoryError?: string;
}

export type PageId =
  | "dashboard"
  | "active"
  | "create"
  | "incident-detail"
  | "history"
  | "memory"
  | "analytics"
  | "settings";

export type Severity = "SEV-1" | "SEV-2" | "SEV-3" | "SEV-4";

export const SEVERITY_COLORS: Record<string, { bg: string; text: string; border: string; dot: string }> = {
  "SEV-1": { bg: "bg-red-50", text: "text-red-700", border: "border-red-200", dot: "bg-red-500" },
  "SEV-2": { bg: "bg-orange-50", text: "text-orange-700", border: "border-orange-200", dot: "bg-orange-500" },
  "SEV-3": { bg: "bg-amber-50", text: "text-amber-700", border: "border-amber-200", dot: "bg-amber-500" },
  "SEV-4": { bg: "bg-blue-50", text: "text-blue-700", border: "border-blue-200", dot: "bg-blue-500" },
};

export const STATUS_COLORS: Record<string, { bg: string; text: string; border: string; dot: string }> = {
  active: { bg: "bg-red-50", text: "text-red-700", border: "border-red-200", dot: "bg-red-500" },
  analyzing: { bg: "bg-yellow-50", text: "text-yellow-700", border: "border-yellow-200", dot: "bg-yellow-500" },
  resolved: { bg: "bg-emerald-50", text: "text-emerald-700", border: "border-emerald-200", dot: "bg-emerald-500" },
};

export function formatTimeAgo(dateStr: string): string {
  const date = new Date(dateStr);
  const now = new Date();
  const diff = now.getTime() - date.getTime();
  const seconds = Math.floor(diff / 1000);
  const minutes = Math.floor(seconds / 60);
  const hours = Math.floor(minutes / 60);
  const days = Math.floor(hours / 24);

  if (days > 0) return `${days}d ago`;
  if (hours > 0) return `${hours}h ago`;
  if (minutes > 0) return `${minutes}m ago`;
  return "just now";
}

export function formatDate(dateStr: string): string {
  const date = new Date(dateStr);
  return date.toLocaleDateString("en-US", {
    month: "short",
    day: "numeric",
    year: "numeric",
    hour: "2-digit",
    minute: "2-digit",
  });
}
