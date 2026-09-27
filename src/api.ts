import { createClient } from "@supabase/supabase-js";
import type {
  Incident,
  AnalyzeResponse,
  ResolveResponse,
  SeedResult,
  MemoryStatus,
  SettingsResponse,
} from "@/types";

const supabaseUrl = import.meta.env.VITE_SUPABASE_URL;
const supabaseAnonKey = import.meta.env.VITE_SUPABASE_ANON_KEY;

export const supabase = createClient(supabaseUrl, supabaseAnonKey);

// The edge function URL — Supabase edge functions are served at /functions/v1/<slug>
const API_URL = `${supabaseUrl}/functions/v1/recallops-api`;

async function apiFetch<T>(path: string, options?: RequestInit): Promise<T> {
  const resp = await fetch(`${API_URL}${path}`, {
    ...options,
    headers: {
      "Content-Type": "application/json",
      "Authorization": `Bearer ${supabaseAnonKey}`,
      ...options?.headers,
    },
  });

  if (!resp.ok) {
    let errorMsg = `Request failed (${resp.status})`;
    try {
      const body = await resp.json();
      if (body.error) errorMsg = body.error;
    } catch {
      // ignore JSON parse errors
    }
    throw new Error(errorMsg);
  }

  return resp.json();
}

// ── Incidents ────────────────────────────────────────────────────────────────
export async function fetchIncidents(status?: string): Promise<Incident[]> {
  const query = status ? `?status=${status}` : "";
  return apiFetch<Incident[]>(`/api/incidents${query}`);
}

export async function fetchIncident(id: string): Promise<Incident> {
  return apiFetch<Incident>(`/api/incidents/${id}`);
}

export async function createIncident(data: {
  title: string;
  service: string;
  severity: string;
  description?: string;
  logs?: string;
  error_message?: string;
  recent_changes?: string;
  affected_component?: string;
}): Promise<Incident> {
  return apiFetch<Incident>("/api/incidents", {
    method: "POST",
    body: JSON.stringify(data),
  });
}

export async function analyzeIncident(id: string): Promise<AnalyzeResponse> {
  return apiFetch<AnalyzeResponse>(`/api/incidents/${id}/analyze`, {
    method: "POST",
  });
}

export async function resolveIncident(
  id: string,
  data: {
    root_cause: string;
    failed_attempts: string;
    successful_fix: string;
    impact: string;
    lessons_learned: string;
  },
): Promise<ResolveResponse> {
  return apiFetch<ResolveResponse>(`/api/incidents/${id}/resolve`, {
    method: "POST",
    body: JSON.stringify(data),
  });
}

// ── Demo ─────────────────────────────────────────────────────────────────────
export async function seedDemoData(): Promise<SeedResult> {
  return apiFetch<SeedResult>("/api/demo/seed", { method: "POST" });
}

export async function loadSimilarIncident(): Promise<Incident> {
  return apiFetch<Incident>("/api/demo/load-similar", { method: "POST" });
}

// ── Memory ───────────────────────────────────────────────────────────────────
export async function fetchMemoryStatus(): Promise<MemoryStatus> {
  return apiFetch<MemoryStatus>("/api/memory/status");
}

// ── Settings ─────────────────────────────────────────────────────────────────
export async function fetchSettings(): Promise<SettingsResponse> {
  return apiFetch<SettingsResponse>("/api/settings");
}

export async function updateSettings(data: {
  llm_api_key?: string;
  llm_base_url?: string;
  llm_model?: string;
  hindsight_base_url?: string;
  hindsight_api_key?: string;
  hindsight_bank_id?: string;
}): Promise<SettingsResponse> {
  return apiFetch<SettingsResponse>("/api/settings", {
    method: "PUT",
    body: JSON.stringify(data),
  });
}
