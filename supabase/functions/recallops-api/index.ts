import { createClient } from "npm:@supabase/supabase-js@2.57.4";

// ─── CORS ────────────────────────────────────────────────────────────────────
const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Methods": "GET, POST, PUT, DELETE, OPTIONS",
  "Access-Control-Allow-Headers": "Content-Type, Authorization, X-Client-Info, Apikey",
};

// ─── Types ────────────────────────────────────────────────────────────────────
interface Incident {
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

interface AppSettings {
  llm_api_key: string | null;
  llm_base_url: string | null;
  llm_model: string | null;
  hindsight_base_url: string | null;
  hindsight_api_key: string | null;
  hindsight_bank_id: string | null;
}

interface AnalysisResult {
  summary: string;
  currentEvidence: string[];
  historicalMemory: HistoricalMemoryEntry[];
  inference: string[];
  investigationPlan: string[];
  recommendations: string[];
  confidence: string;
  memoryRecalled: boolean;
}

interface HistoricalMemoryEntry {
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

interface RecalledMemory {
  id: string;
  text: string;
  type: string;
  score: number;
  entities: string[];
  occurred_start: string | null;
}

interface NormalizedIncident {
  service: string;
  severity: string;
  symptoms: string[];
  errors: string[];
  recentChanges: string[];
  affectedComponents: string[];
}

// ─── Supabase Client ──────────────────────────────────────────────────────────
function getSupabase() {
  const url = Deno.env.get("SUPABASE_URL") ?? "";
  const key = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY") ?? "";
  return createClient(url, key);
}

// ─── Settings ─────────────────────────────────────────────────────────────────
async function getSettings(): Promise<AppSettings | null> {
  const sb = getSupabase();
  const { data, error } = await sb.from("app_settings").select("*").eq("id", 1).maybeSingle();
  if (error) throw new Error(`Settings load failed: ${error.message}`);
  return data as AppSettings;
}

// ─── Hindsight Memory Service ─────────────────────────────────────────────────
async function hindsightRecall(
  settings: AppSettings,
  query: string,
): Promise<{ results: RecalledMemory[]; available: boolean; error?: string }> {
  const baseUrl = settings.hindsight_base_url;
  const apiKey = settings.hindsight_api_key;
  const bankId = settings.hindsight_bank_id || "recallops-incident-memory";

  if (!baseUrl) {
    return { results: [], available: false, error: "Hindsight base URL not configured" };
  }

  try {
    const headers: Record<string, string> = { "Content-Type": "application/json" };
    if (apiKey) headers["authorization"] = apiKey;

    const url = `${baseUrl.replace(/\/$/, "")}/v1/default/banks/${bankId}/memories/recall`;
    const controller = new AbortController();
    const timeout = setTimeout(() => controller.abort(), 15000);

    const resp = await fetch(url, {
      method: "POST",
      headers,
      signal: controller.signal,
      body: JSON.stringify({ query, budget: "high", max_tokens: 4096 }),
    });
    clearTimeout(timeout);

    if (!resp.ok) {
      const body = await resp.text().catch(() => "");
      return { results: [], available: false, error: `Hindsight recall failed (${resp.status}): ${body.slice(0, 200)}` };
    }

    const data = await resp.json();
    const results: RecalledMemory[] = (data.results || []).map((r: any) => ({
      id: r.id || "",
      text: r.text || "",
      type: r.type || "world",
      score: r.score ?? 0,
      entities: r.entities || [],
      occurred_start: r.occurred_start || null,
    }));
    return { results, available: true };
  } catch (err: any) {
    if (err.name === "AbortError") {
      return { results: [], available: false, error: "Hindsight request timed out" };
    }
    return { results: [], available: false, error: `Hindsight connection error: ${err.message}` };
  }
}

async function hindsightRetain(
  settings: AppSettings,
  content: string,
  documentId: string,
  tags: string[] = [],
): Promise<{ success: boolean; error?: string }> {
  const baseUrl = settings.hindsight_base_url;
  const apiKey = settings.hindsight_api_key;
  const bankId = settings.hindsight_bank_id || "recallops-incident-memory";

  if (!baseUrl) {
    return { success: false, error: "Hindsight base URL not configured" };
  }

  try {
    const headers: Record<string, string> = { "Content-Type": "application/json" };
    if (apiKey) headers["authorization"] = apiKey;

    const url = `${baseUrl.replace(/\/$/, "")}/v1/default/banks/${bankId}/memories`;
    const controller = new AbortController();
    const timeout = setTimeout(() => controller.abort(), 30000);

    const resp = await fetch(url, {
      method: "POST",
      headers,
      signal: controller.signal,
      body: JSON.stringify({
        items: [{ content, document_id: documentId, tags }],
        async: false,
      }),
    });
    clearTimeout(timeout);

    if (!resp.ok) {
      const body = await resp.text().catch(() => "");
      return { success: false, error: `Hindsight retain failed (${resp.status}): ${body.slice(0, 200)}` };
    }
    return { success: true };
  } catch (err: any) {
    if (err.name === "AbortError") {
      return { success: false, error: "Hindsight retain timed out" };
    }
    return { success: false, error: `Hindsight connection error: ${err.message}` };
  }
}

async function hindsightHealthCheck(settings: AppSettings): Promise<{ available: boolean; bankExists: boolean; error?: string }> {
  const baseUrl = settings.hindsight_base_url;
  const apiKey = settings.hindsight_api_key;
  const bankId = settings.hindsight_bank_id || "recallops-incident-memory";

  if (!baseUrl) return { available: false, bankExists: false, error: "Not configured" };

  try {
    const headers: Record<string, string> = {};
    if (apiKey) headers["authorization"] = apiKey;

    const healthUrl = `${baseUrl.replace(/\/$/, "")}/health`;
    const resp = await fetch(healthUrl, { method: "GET", headers, signal: AbortSignal.timeout(8000) }).catch(() => null);
    if (!resp || !resp.ok) {
      return { available: false, bankExists: false, error: "Hindsight health check failed" };
    }

    const bankUrl = `${baseUrl.replace(/\/$/, "")}/v1/default/banks/${bankId}/stats`;
    const bankResp = await fetch(bankUrl, { method: "GET", headers, signal: AbortSignal.timeout(8000) }).catch(() => null);
    const bankExists = bankResp !== null && bankResp.ok;
    return { available: true, bankExists, error: bankExists ? undefined : "Bank not found — will be auto-created on first retain" };
  } catch (err: any) {
    return { available: false, bankExists: false, error: err.message };
  }
}

// ─── Incident Normalization ───────────────────────────────────────────────────
function normalizeIncident(incident: Partial<Incident>): NormalizedIncident {
  const symptoms: string[] = [];
  const errors: string[] = [];
  const recentChanges: string[] = [];
  const affectedComponents: string[] = [];

  if (incident.description) symptoms.push(incident.description);
  if (incident.title) symptoms.push(incident.title);

  if (incident.error_message) {
    for (const line of incident.error_message.split("\n")) {
      const trimmed = line.trim();
      if (trimmed) errors.push(trimmed);
    }
  }

  if (incident.logs) {
    for (const line of incident.logs.split("\n")) {
      const trimmed = line.trim();
      if (trimmed && /(error|fail|exhaust|timeout|crash|exception|refus|denied|panic|fatal|unavailable|OOM|kill)/i.test(trimmed)) {
        errors.push(trimmed);
      }
    }
  }

  if (incident.recent_changes) {
    for (const line of incident.recent_changes.split("\n")) {
      const trimmed = line.trim();
      if (trimmed) recentChanges.push(trimmed);
    }
  }

  if (incident.affected_component) {
    for (const part of incident.affected_component.split(/[,;]/)) {
      const trimmed = part.trim();
      if (trimmed) affectedComponents.push(trimmed);
    }
  }

  return {
    service: incident.service || "unknown",
    severity: incident.severity || "SEV-2",
    symptoms: [...new Set(symptoms)],
    errors: [...new Set(errors)],
    recentChanges: [...new Set(recentChanges)],
    affectedComponents: [...new Set(affectedComponents)],
  };
}

function buildRecallQuery(incident: Partial<Incident>, normalized: NormalizedIncident): string {
  const parts: string[] = [];
  parts.push(`Service: ${normalized.service}`);
  parts.push(`Severity: ${normalized.severity}`);
  if (normalized.errors.length) parts.push(`Errors: ${normalized.errors.slice(0, 5).join("; ")}`);
  if (normalized.symptoms.length) parts.push(`Symptoms: ${normalized.symptoms.slice(0, 3).join("; ")}`);
  if (normalized.recentChanges.length) parts.push(`Recent changes: ${normalized.recentChanges.slice(0, 3).join("; ")}`);
  if (normalized.affectedComponents.length) parts.push(`Affected components: ${normalized.affectedComponents.join(", ")}`);
  parts.push(`Failure pattern: production incident with ${normalized.errors.length ? normalized.errors[0] : "service degradation"}`);
  return parts.join("\n");
}

// ─── LLM Service ──────────────────────────────────────────────────────────────
function buildAnalysisPrompt(
  incident: Partial<Incident>,
  normalized: NormalizedIncident,
  recalledMemories: RecalledMemory[],
  memoryAvailable: boolean,
): string {
  const memorySection = memoryAvailable && recalledMemories.length > 0
    ? recalledMemories.map((m, i) => {
        const entities = m.entities.length ? ` [Entities: ${m.entities.join(", ")}]` : "";
        return `Memory ${i + 1} (type: ${m.type}, score: ${m.score.toFixed(4)}):${entities}\n${m.text}`;
      }).join("\n\n")
    : memoryAvailable
      ? "No relevant historical memories were found in organizational memory."
      : "Organizational memory is unavailable. Analyze using only current evidence.";

  return `You are RecallOps, an AI Incident Response Engineer for DevOps/SRE teams.

You analyze production incidents and produce structured investigation plans.

IMPORTANT RULES:
- Historical facts must come ONLY from the provided "HISTORICAL MEMORY" section.
- NEVER fabricate or hallucinate incident IDs, root causes, or resolutions.
- If no historical memory is provided, say so explicitly.
- Clearly separate facts from inference.
- Do NOT recommend destructive actions (restarts, deletes, etc.) without human approval.
- All recommendations are advisory — the engineer decides what to execute.

## CURRENT INCIDENT
Title: ${incident.title || "N/A"}
Service: ${normalized.service}
Severity: ${normalized.severity}
Description: ${incident.description || "N/A"}
Error Messages:
${normalized.errors.length ? normalized.errors.map((e) => `- ${e}`).join("\n") : "- None provided"}

Recent Changes:
${normalized.recentChanges.length ? normalized.recentChanges.map((c) => `- ${c}`).join("\n") : "- None reported"}

Affected Components:
${normalized.affectedComponents.length ? normalized.affectedComponents.map((c) => `- ${c}`).join("\n") : "- Not specified"}

## HISTORICAL MEMORY (from Hindsight)
${memorySection}

## TASK
Analyze this incident and produce a structured response as JSON with exactly these fields:

{
  "summary": "Brief description of what appears to be happening",
  "currentEvidence": ["Fact 1 from evidence", "Fact 2 from evidence"],
  "historicalMemory": [
    {
      "incidentId": "ID if known from memory, otherwise 'Hindsight Memory'",
      "service": "service if known",
      "date": "date if known",
      "symptoms": "symptoms from memory",
      "rootCause": "root cause from memory",
      "failedAttempts": "failed attempts from memory",
      "successfulFix": "successful fix from memory",
      "lessonsLearned": "lessons learned from memory",
      "relevance": "why this memory is relevant to the current incident"
    }
  ],
  "inference": ["Inference 1 — clearly labeled as inference, not fact"],
  "investigationPlan": ["Step 1", "Step 2", "Step 3"],
  "recommendations": ["Safe recommendation 1", "Safe recommendation 2"],
  "confidence": "High/Medium/Low — explain reasoning"
}

If historical memory contains relevant incidents, USE THEM to make the investigation plan more specific.
If no historical memory is available, provide generic but still useful troubleshooting steps.

Return ONLY valid JSON. No markdown, no code fences.`;
}

function parseLLMResponse(text: string): AnalysisResult {
  let cleaned = text.trim();
  // Strip markdown code fences
  cleaned = cleaned.replace(/^```(?:json)?\s*/i, "").replace(/\s*```$/i, "");

  // Find the first { and last } to extract JSON
  const firstBrace = cleaned.indexOf("{");
  const lastBrace = cleaned.lastIndexOf("}");
  if (firstBrace >= 0 && lastBrace > firstBrace) {
    cleaned = cleaned.slice(firstBrace, lastBrace + 1);
  }

  let parsed: any;
  try {
    parsed = JSON.parse(cleaned);
  } catch {
    throw new Error("LLM returned malformed JSON that could not be parsed");
  }

  // Validate and coerce fields
  const result: AnalysisResult = {
    summary: typeof parsed.summary === "string" ? parsed.summary : "Analysis incomplete",
    currentEvidence: Array.isArray(parsed.currentEvidence) ? parsed.currentEvidence.filter((e: any) => typeof e === "string") : [],
    historicalMemory: Array.isArray(parsed.historicalMemory) ? parsed.historicalMemory.filter((e: any) => e && typeof e === "object").map((e: any) => ({
      incidentId: String(e.incidentId || "Hindsight Memory"),
      service: String(e.service || ""),
      date: String(e.date || ""),
      symptoms: String(e.symptoms || ""),
      rootCause: String(e.rootCause || ""),
      failedAttempts: String(e.failedAttempts || ""),
      successfulFix: String(e.successfulFix || ""),
      lessonsLearned: String(e.lessonsLearned || ""),
      relevance: String(e.relevance || ""),
    })) : [],
    inference: Array.isArray(parsed.inference) ? parsed.inference.filter((e: any) => typeof e === "string") : [],
    investigationPlan: Array.isArray(parsed.investigationPlan) ? parsed.investigationPlan.filter((e: any) => typeof e === "string") : [],
    recommendations: Array.isArray(parsed.recommendations) ? parsed.recommendations.filter((e: any) => typeof e === "string") : [],
    confidence: typeof parsed.confidence === "string" ? parsed.confidence : "Medium",
    memoryRecalled: false,
  };

  return result;
}

async function callLLM(settings: AppSettings, prompt: string): Promise<AnalysisResult> {
  if (!settings.llm_api_key) {
    throw new Error("LLM API key not configured. Set it in Settings.");
  }

  const baseUrl = settings.llm_base_url || "https://api.groq.com/openai/v1";
  const model = settings.llm_model || "llama-3.3-70b-versatile";

  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), 60000);

  try {
    const resp = await fetch(`${baseUrl.replace(/\/$/, "")}/chat/completions`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "Authorization": `Bearer ${settings.llm_api_key}`,
      },
      signal: controller.signal,
      body: JSON.stringify({
        model,
        messages: [
          { role: "system", content: "You are RecallOps, an AI Incident Response Engineer. You always respond with valid JSON only." },
          { role: "user", content: prompt },
        ],
        temperature: 0.3,
        max_tokens: 4096,
        response_format: { type: "json_object" },
      }),
    });
    clearTimeout(timeout);

    if (!resp.ok) {
      const body = await resp.text().catch(() => "");
      if (resp.status === 401) throw new Error("LLM API key is invalid. Check your Settings.");
      if (resp.status === 429) throw new Error("LLM rate limit reached. Try again in a moment.");
      throw new Error(`LLM request failed (${resp.status}): ${body.slice(0, 200)}`);
    }

    const data = await resp.json();
    const content = data.choices?.[0]?.message?.content;
    if (!content) throw new Error("LLM returned empty response");

    return parseLLMResponse(content);
  } catch (err: any) {
    clearTimeout(timeout);
    if (err.name === "AbortError") throw new Error("LLM request timed out");
    throw err;
  }
}

// ─── Incident Agent (orchestrates normalization → recall → LLM) ────────────────
async function analyzeIncident(incident: Incident, settings: AppSettings): Promise<{
  analysis: AnalysisResult;
  recalledMemories: RecalledMemory[];
  memoryAvailable: boolean;
  memoryError?: string;
}> {
  const normalized = normalizeIncident(incident);
  const recallQuery = buildRecallQuery(incident, normalized);

  const recallResult = await hindsightRecall(settings, recallQuery);
  const recalledMemories = recallResult.results;
  const memoryAvailable = recallResult.available;

  const prompt = buildAnalysisPrompt(incident, normalized, recalledMemories, memoryAvailable);
  const analysis = await callLLM(settings, prompt);
  analysis.memoryRecalled = memoryAvailable && recalledMemories.length > 0;

  return {
    analysis,
    recalledMemories,
    memoryAvailable,
    memoryError: recallResult.error,
  };
}

// ─── Resolution → Hindsight Retain ────────────────────────────────────────────
function buildMemoryContent(incident: Incident): string {
  const parts: string[] = [];
  parts.push(`INCIDENT: ${incident.title}`);
  parts.push(`Service: ${incident.service}`);
  parts.push(`Severity: ${incident.severity}`);
  parts.push(`Date: ${incident.created_at}`);
  if (incident.description) parts.push(`Description: ${incident.description}`);
  if (incident.error_message) parts.push(`Error: ${incident.error_message}`);
  if (incident.recent_changes) parts.push(`Recent change: ${incident.recent_changes}`);
  if (incident.root_cause) parts.push(`ROOT CAUSE: ${incident.root_cause}`);
  if (incident.failed_attempts) parts.push(`Failed attempt: ${incident.failed_attempts}`);
  if (incident.successful_fix) parts.push(`SUCCESSFUL FIX: ${incident.successful_fix}`);
  if (incident.impact) parts.push(`Impact: ${incident.impact}`);
  if (incident.lessons_learned) parts.push(`LESSON LEARNED: ${incident.lessons_learned}`);
  return parts.join("\n");
}

// ─── Demo Data ────────────────────────────────────────────────────────────────
interface DemoIncident {
  title: string;
  service: string;
  severity: string;
  description: string;
  logs: string;
  error_message: string;
  recent_changes: string;
  affected_component: string;
  root_cause: string;
  failed_attempts: string;
  successful_fix: string;
  impact: string;
  lessons_learned: string;
}

const DEMO_INCIDENTS: DemoIncident[] = [
  {
    title: "Payment API returning HTTP 500 errors",
    service: "payment-service",
    severity: "SEV-1",
    description: "Payment requests are intermittently failing with 500 errors. Customer transactions are being rejected during checkout.",
    logs: `2026-09-20T14:23:01Z ERROR [payment-service] pool: Unable to acquire database connection
2026-09-20T14:23:02Z ERROR [payment-service] pool: Connection pool exhausted (max=10, active=10, queued=47)
2026-09-20T14:23:05Z WARN  [payment-service] handler: Request timeout after 5000ms waiting for DB connection
2026-09-20T14:23:08Z ERROR [payment-service] pool: Unable to acquire database connection
2026-09-20T14:23:10Z FATAL [payment-service] circuit-breaker: Payment gateway circuit open`,
    error_message: "Unable to acquire database connection. Connection pool exhausted.",
    recent_changes: "Database connection pool configuration changed 15 minutes ago — max pool size reduced from 50 to 10.",
    affected_component: "database-connection-pool, payment-gateway",
    root_cause: "Incorrect connection pool configuration — max pool size was reduced from 50 to 10 during deployment, causing connection exhaustion under load.",
    failed_attempts: "Restarting the payment-service pods temporarily reduced error rate for ~5 minutes, but errors returned as traffic resumed. Scaling replicas did not help.",
    successful_fix: "Corrected the connection pool max size back to 50 in the service configuration and rolled the deployment. Verified connection pool utilization returned to normal levels.",
    impact: "~12% of payment transactions failed over 45 minutes. Estimated revenue impact $23K. 8 customer complaints filed.",
    lessons_learned: "Always verify connection pool configuration changes against expected peak traffic before deploying. Connection pool size changes should be load-tested in staging first.",
  },
  {
    title: "Third-party payment API timeout causing checkout failures",
    service: "payment-service",
    severity: "SEV-2",
    description: "Stripe payment API calls timing out intermittently, causing checkout to hang and eventually fail for customers.",
    logs: `2026-09-18T09:15:00Z WARN  [payment-service] stripe-client: API call took 28s (timeout: 30s)
2026-09-18T09:15:03Z ERROR [payment-service] stripe-client: Request timed out after 30000ms
2026-09-18T09:15:04Z WARN  [payment-service] retry: Attempt 1/3 for charge_create
2026-09-18T09:15:20Z ERROR [payment-service] stripe-client: Request timed out after 30000ms
2026-09-18T09:15:21Z ERROR [payment-service] handler: All retries exhausted for payment intent`,
    error_message: "Stripe API request timed out after 30000ms. All retries exhausted.",
    recent_changes: "No recent changes to payment-service. Stripe API status page showing intermittent issues.",
    affected_component: "stripe-client, checkout-flow",
    root_cause: "Stripe API was experiencing degraded performance. The 30s timeout with 3 retries caused cascading delays, exhausting the request handler thread pool.",
    failed_attempts: "Increasing Stripe timeout to 60s made things worse — thread pool exhaustion spread to other endpoints. Restarting the service had no effect.",
    successful_fix: "Implemented circuit breaker pattern for Stripe API calls with 50% failure threshold. Added degraded-mode checkout that queues payments for retry instead of blocking. Reduced timeout to 10s with 1 retry.",
    impact: "~8% of checkouts failed over 90 minutes. 15 customer support tickets opened.",
    lessons_learned: "Third-party API timeouts should use circuit breakers, not longer timeouts. Always have a degraded-mode fallback for payment processing. Monitor third-party API latency, not just error rates.",
  },
  {
    title: "Redis cache failure causing auth service degradation",
    service: "auth-service",
    severity: "SEV-1",
    description: "Redis primary node became unresponsive, causing authentication requests to fall through to database and spike latency.",
    logs: `2026-09-15T03:42:00Z ERROR [auth-service] redis: Connection refused to redis-primary:6379
2026-09-15T03:42:01Z WARN  [auth-service] cache: Cache miss fallback to DB for session lookup
2026-09-15T03:42:05Z ERROR [auth-service] db: Active queries exceeding 500, connection pool at capacity
2026-09-15T03:42:10Z WARN  [auth-service] latency: Average auth latency 4200ms (SLA: 200ms)
2026-09-15T03:42:15Z FATAL [auth-service] health: Liveness probe failing`,
    error_message: "Connection refused to redis-primary:6379. Cache miss fallback causing DB connection pool exhaustion.",
    recent_changes: "Redis cluster failover triggered by automatic failover system after primary node health check failures.",
    affected_component: "redis-cluster, session-cache, database",
    root_cause: "Redis primary node crashed due to OOM. Failover to replica took 90 seconds. During failover, all cache lookups fell through to the database, causing connection pool exhaustion and cascading latency.",
    failed_attempts: "Restarting auth-service instances did not help — cache misses continued to overwhelm the database. Manually pointing to the replica caused stale session data.",
    successful_fix: "Implemented graceful Redis degradation: when Redis is unavailable, serve stale cached sessions for 5 minutes instead of hitting the database. Added Redis memory alerting at 80% usage. Configured Sentinel-based failover with 15s timeout.",
    impact: "All authentication was degraded for 90 seconds, fully down for 45 seconds. ~3400 users affected. Login success rate dropped to 23%.",
    lessons_learned: "Cache failures must degrade gracefully, not fall through to the database. Monitor Redis memory usage proactively. Session caching needs a stale-serve strategy, not a DB fallback.",
  },
  {
    title: "Token validation latency spike after JWT key rotation",
    service: "auth-service",
    severity: "SEV-2",
    description: "Token validation latency increased from 5ms to 800ms after JWT signing key rotation, causing API gateway timeouts.",
    logs: `2026-09-12T16:30:00Z WARN  [auth-service] jwt: Validation took 780ms (expected: <10ms)
2026-09-12T16:30:02Z WARN  [auth-service] jwt: JWKS cache miss, fetching from key server
2026-09-12T16:30:05Z ERROR [auth-service] gateway: Upstream timeout after 2000ms
2026-09-12T16:30:08Z WARN  [auth-service] jwt: Validation took 820ms
2026-09-12T16:30:10Z ERROR [auth-service] rate: Token validation QPS dropped from 2000 to 150`,
    error_message: "JWT validation took 780ms (expected: <10ms). JWKS cache miss causing key fetch on every request.",
    recent_changes: "JWT signing key rotated as part of quarterly security update. New JWKS endpoint URL configured.",
    affected_component: "jwt-validator, jwks-cache, api-gateway",
    root_cause: "JWKS cache TTL was set to 0 after key rotation configuration change, causing every token validation to fetch the public key set from the key server over the network.",
    failed_attempts: "Scaling auth-service horizontally did not reduce latency — the bottleneck was the JWKS fetch, not CPU. Restarting the key server had no effect.",
    successful_fix: "Set JWKS cache TTL to 300 seconds (5 minutes) with background refresh at 240 seconds. Pre-warmed the cache after deployment. Latency returned to <5ms within 30 seconds.",
    impact: "API latency above SLA for 25 minutes. ~5% of requests timed out at the gateway. No auth failures, but significant user experience degradation.",
    lessons_learned: "JWT key rotation must verify JWKS cache configuration. Never set JWKS cache TTL to 0 in production. Add latency alarms for token validation.",
  },
  {
    title: "Database replication lag causing stale order reads",
    service: "order-service",
    severity: "SEV-2",
    description: "Order service reads from read-replica returning stale data, causing customers to see incomplete order histories.",
    logs: `2026-09-10T11:20:00Z WARN  [order-service] replica: Replication lag 45s (threshold: 1s)
2026-09-10T11:20:03Z WARN  [order-service] replica: Replication lag 120s and increasing
2026-09-10T11:20:05Z ERROR [order-service] consistency: Stale read detected — order #83920 not found on replica
2026-09-10T11:20:08Z WARN  [order-service] replica: Replication lag 340s
2026-09-10T11:20:12Z ERROR [order-service] consistency: Stale read detected — order #83921 not found on replica`,
    error_message: "Replication lag 340s (threshold: 1s). Stale reads causing order lookup failures on read replica.",
    recent_changes: "Large bulk order import job ran (50K orders) which saturated the replication channel.",
    affected_component: "read-replica, order-database, replication",
    root_cause: "Bulk import of 50K orders in a single transaction saturated the WAL replication stream. The read replica fell behind by 5+ minutes, and the read-after-write consistency guarantee was violated.",
    failed_attempts: "Restarting the replica did not help — it had to replay the entire WAL backlog. Redirecting reads to primary caused primary CPU to spike to 95%.",
    successful_fix: "Implemented read-after-write consistency: for 60 seconds after a user creates an order, their reads go to the primary. Batched the bulk import into 1000-order chunks with 2-second pauses. Added replication lag monitoring with alerting at 5s.",
    impact: "~3% of order lookups returned stale/missing results for 12 minutes. 47 customer reports of missing orders.",
    lessons_learned: "Bulk imports must be chunked to avoid replication saturation. Read-after-write consistency is needed for user-facing order flows. Monitor replication lag separately from general DB health.",
  },
  {
    title: "API latency spike after deployment — N+1 query regression",
    service: "order-service",
    severity: "SEV-2",
    description: "Order listing API latency increased from 50ms to 3s after a deployment that refactored the order serialization layer.",
    logs: `2026-09-08T14:05:00Z WARN  [order-service] latency: GET /orders took 3200ms (SLA: 200ms)
2026-09-08T14:05:02Z WARN  [order-service] db: 47 queries executed for single /orders request
2026-09-08T14:05:05Z ERROR [order-service] pool: DB connection pool exhausted (max=20, active=20)
2026-09-08T14:05:08Z WARN  [order-service] latency: GET /orders took 2800ms
2026-09-08T14:05:10Z FATAL [order-service] timeout: Request aborted after 5000ms`,
    error_message: "47 queries executed for single /orders request. DB connection pool exhausted.",
    recent_changes: "Order serialization refactored to use individual item fetch instead of batch query. Deployed 20 minutes ago.",
    affected_component: "order-api, database-queries, serializer",
    root_cause: "The serializer refactor introduced an N+1 query pattern — each order item was fetched individually instead of batch-loading items for all orders in a single query. A 20-order list page triggered 47 DB queries instead of 2.",
    failed_attempts: "Scaling the database did not help — the issue was query count, not query speed. Scaling the service temporarily reduced pool exhaustion but latency remained high.",
    successful_fix: "Reverted the serializer to use batch query for order items (single IN clause query). Added integration test that asserts query count per request. Deployed fix and latency returned to 50ms.",
    impact: "Order listing API above SLA for 40 minutes. ~15% of requests timed out. Checkout unaffected.",
    lessons_learned: "Serializer refactors must be reviewed for N+1 query patterns. Add query count assertions to integration tests. Monitor queries-per-request, not just response latency.",
  },
  {
    title: "Third-party email provider rate limiting causing notification backlog",
    service: "notification-service",
    severity: "SEV-3",
    description: "SendGrid API returning 429 rate limit errors, causing notification queue backlog and delayed emails.",
    logs: `2026-09-05T08:00:00Z WARN  [notification-service] sendgrid: API returned 429 Too Many Requests
2026-09-05T08:00:02Z WARN  [notification-service] queue: Backlog size 1500 and growing
2026-09-05T08:00:05Z ERROR [notification-service] sendgrid: Rate limit exceeded — retry after 60s
2026-09-05T08:00:08Z WARN  [notification-service] queue: Backlog size 3200
2026-09-05T08:00:10Z ERROR [notification-service] sendgrid: Rate limit exceeded — retry after 60s`,
    error_message: "SendGrid API returned 429 Too Many Requests. Rate limit exceeded.",
    recent_changes: "Marketing campaign launched at 8:00 AM sending 50K promotional emails through the same SendGrid account as transactional emails.",
    affected_component: "sendgrid-client, notification-queue",
    root_cause: "Marketing campaign and transactional emails shared the same SendGrid account and IP. The marketing burst consumed the entire rate limit, starving transactional notifications.",
    failed_attempts: "Increasing queue worker count did not help — the bottleneck was SendGrid's rate limit, not processing capacity. Pausing the queue caused transactional emails to be delayed further.",
    successful_fix: "Separated SendGrid accounts: one for transactional emails, one for marketing. Added per-account rate limit headers monitoring. Implemented priority queue so transactional emails are sent first. Marketing campaigns now scheduled during off-peak hours.",
    impact: "Transactional emails delayed by up to 2 hours for 45 minutes. Password reset emails affected. ~1800 users experienced delayed notifications.",
    lessons_learned: "Transactional and marketing emails must use separate provider accounts. Monitor third-party rate limit headers. Transactional notifications need priority queuing over bulk sends.",
  },
  {
    title: "Kubernetes CrashLoopBackOff on user-service pods",
    service: "infrastructure",
    severity: "SEV-1",
    description: "user-service pods entering CrashLoopBackOff after deployment, causing all user API calls to fail.",
    logs: `2026-09-03T22:15:00Z ERROR [kubernetes] pod user-service-7d4f: container terminated with exit code 137 (OOMKilled)
2026-09-03T22:15:02Z WARN  [kubernetes] pod user-service-7d4f: Back-off restarting failed container
2026-09-03T22:15:05Z ERROR [kubernetes] pod user-service-7d5a: container terminated with exit code 137 (OOMKilled)
2026-09-03T22:15:08Z WARN  [kubernetes] deployment user-service: 0/3 replicas ready
2026-09-03T22:15:10Z FATAL [kubernetes] hpa: min replicas not met, scaling halted`,
    error_message: "Container terminated with exit code 137 (OOMKilled). CrashLoopBackOff — 0/3 replicas ready.",
    recent_changes: "New user-service deployment with updated memory profiling library. Container memory limit set to 256Mi.",
    affected_component: "user-service-pods, kubernetes-cluster, memory-limits",
    root_cause: "New memory profiling library loaded all user profiles into memory at startup. Container memory limit was 256Mi but the service needed ~512Mi with the profiling library enabled. Kubernetes OOM-killed the pods on startup.",
    failed_attempts: "Rolling back to previous version worked but lost the profiling feature. Increasing replicas did not help — all pods hit the same OOM. Setting memory limit to 512Mi without requests caused scheduling failures.",
    successful_fix: "Set container memory request to 256Mi and limit to 768Mi. Disabled eager loading in the profiling library — profiles now loaded on-demand. Added memory usage metrics to the health check endpoint. Pods started successfully.",
    impact: "User API fully down for 18 minutes. All user-dependent services degraded. ~12K users affected during peak evening traffic.",
    lessons_learned: "Always test container memory limits with realistic data loads in staging. Memory profiling libraries should use lazy loading, not eager loading. Set Kubernetes memory requests and limits based on measured usage, not estimates.",
  },
  {
    title: "Container memory exhaustion on analytics-service",
    service: "infrastructure",
    severity: "SEV-2",
    description: "analytics-service containers being OOM-killed during large report generation, causing report failures.",
    logs: `2026-09-01T10:30:00Z WARN  [analytics-service] memory: Heap usage 1.2GB (limit: 1GB)
2026-09-01T10:30:05Z WARN  [analytics-service] report: Loading 2.3M records into memory for report generation
2026-09-01T10:30:08Z ERROR [analytics-service] memory: Out of memory — heap allocation failed
2026-09-01T10:30:10Z ERROR [kubernetes] pod analytics-service-3f2a: OOMKilled
2026-09-01T10:30:12Z WARN  [analytics-service] report: Report generation failed for tenant #482`,
    error_message: "Out of memory — heap allocation failed. Loading 2.3M records into memory for report generation.",
    recent_changes: "Report generator updated to include 12 months of data instead of 3 months. No memory limit change.",
    affected_component: "analytics-service, report-generator, kubernetes-memory",
    root_cause: "Report generator loaded all records into memory before processing. Expanding from 3 to 12 months of data increased memory usage 4x, exceeding the 1GB container limit. No streaming or pagination was used.",
    failed_attempts: "Increasing container memory to 4GB was rejected by platform team due to cluster capacity. Restarting the service allowed small reports but large reports still failed. Splitting reports by month reduced but did not eliminate the issue.",
    successful_fix: "Refactored report generator to use streaming processing — records are processed in 10K batches and written to the report incrementally. Peak memory usage dropped from 1.2GB to 80MB. Added memory pressure detection that aborts report generation gracefully at 70% memory usage.",
    impact: "Large report generation failed for 6 hours. ~25 reports failed. No impact on real-time analytics queries.",
    lessons_learned: "Report generators must use streaming, not bulk loading. Memory usage scales with data volume — test with production data sizes. Add graceful degradation when memory pressure is detected.",
  },
];

// ─── Demo Incident Templates (for "Load Similar Incident") ────────────────────
const DEMO_SIMILAR_INCIDENT: Partial<Incident> = {
  title: "Payment API returning HTTP 500 errors",
  service: "payment-service",
  severity: "SEV-1",
  description: "Payment requests are intermittently failing with HTTP 500 errors. Customers unable to complete checkout.",
  logs: `2026-09-27T14:23:01Z ERROR [payment-service] pool: Unable to acquire database connection
2026-09-27T14:23:02Z ERROR [payment-service] pool: Connection pool exhausted (max=10, active=10, queued=52)
2026-09-27T14:23:05Z WARN  [payment-service] handler: Request timeout after 5000ms waiting for DB connection
2026-09-27T14:23:08Z ERROR [payment-service] pool: Unable to acquire database connection
2026-09-27T14:23:10Z FATAL [payment-service] circuit-breaker: Payment gateway circuit open`,
  error_message: "Unable to acquire database connection. Connection pool exhausted.",
  recent_changes: "New deployment occurred 12 minutes ago. Database connection pool configuration updated.",
  affected_component: "database-connection-pool, payment-gateway",
};

// ─── Router ────────────────────────────────────────────────────────────────────
Deno.serve(async (req: Request) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { status: 200, headers: corsHeaders });
  }

  const url = new URL(req.url);
  const path = url.pathname.replace(/^\/recallops-api/, "");
  const method = req.method;

  try {
    // ── Health ──────────────────────────────────────────────────────────────
    if (path === "/health" && method === "GET") {
      return json({ status: "ok", version: "1.0.0", time: new Date().toISOString() });
    }

    // ── Memory Status ───────────────────────────────────────────────────────
    if (path === "/api/memory/status" && method === "GET") {
      const settings = await getSettings();
      if (!settings) return json({ available: false, error: "Settings not configured" }, 400);

      const health = await hindsightHealthCheck(settings);
      const sb = getSupabase();
      const { count: resolvedCount } = await sb.from("incidents").select("*", { count: "exact", head: true }).eq("status", "resolved");
      const { count: storedCount } = await sb.from("incidents").select("*", { count: "exact", head: true }).eq("memory_stored", true);

      return json({
        available: health.available,
        bankExists: health.bankExists,
        bankId: settings.hindsight_bank_id,
        error: health.error,
        resolvedIncidents: resolvedCount || 0,
        storedMemories: storedCount || 0,
        llmConfigured: !!settings.llm_api_key,
        llmModel: settings.llm_model,
      });
    }

    // ── Settings ─────────────────────────────────────────────────────────────
    if (path === "/api/settings" && method === "GET") {
      const settings = await getSettings();
      if (!settings) return json({ error: "Settings not found" }, 404);
      return json({
        llm_base_url: settings.llm_base_url,
        llm_model: settings.llm_model,
        llm_api_key_configured: !!settings.llm_api_key,
        hindsight_base_url: settings.hindsight_base_url,
        hindsight_bank_id: settings.hindsight_bank_id,
        hindsight_api_key_configured: !!settings.hindsight_api_key,
      });
    }

    if (path === "/api/settings" && method === "PUT") {
      const body = await req.json();
      const sb = getSupabase();
      const update: Record<string, any> = { updated_at: new Date().toISOString() };
      if (body.llm_api_key !== undefined) update.llm_api_key = body.llm_api_key;
      if (body.llm_base_url !== undefined) update.llm_base_url = body.llm_base_url;
      if (body.llm_model !== undefined) update.llm_model = body.llm_model;
      if (body.hindsight_base_url !== undefined) update.hindsight_base_url = body.hindsight_base_url;
      if (body.hindsight_api_key !== undefined) update.hindsight_api_key = body.hindsight_api_key;
      if (body.hindsight_bank_id !== undefined) update.hindsight_bank_id = body.hindsight_bank_id;

      const { data, error } = await sb.from("app_settings").update(update).eq("id", 1).select("*").maybeSingle();
      if (error) return json({ error: error.message }, 500);
      return json({
        llm_base_url: data?.llm_base_url,
        llm_model: data?.llm_model,
        llm_api_key_configured: !!data?.llm_api_key,
        hindsight_base_url: data?.hindsight_base_url,
        hindsight_bank_id: data?.hindsight_bank_id,
        hindsight_api_key_configured: !!data?.hindsight_api_key,
      });
    }

    // ── Incidents List ───────────────────────────────────────────────────────
    if (path === "/api/incidents" && method === "GET") {
      const sb = getSupabase();
      const statusFilter = url.searchParams.get("status");
      let query = sb.from("incidents").select("*").order("created_at", { ascending: false });
      if (statusFilter) query = query.eq("status", statusFilter);
      const { data, error } = await query;
      if (error) return json({ error: error.message }, 500);
      return json(data);
    }

    // ── Get Incident ─────────────────────────────────────────────────────────
    const incidentMatch = path.match(/^\/api\/incidents\/([^/]+)$/);
    if (incidentMatch && method === "GET") {
      const sb = getSupabase();
      const { data, error } = await sb.from("incidents").select("*").eq("id", incidentMatch[1]).maybeSingle();
      if (error) return json({ error: error.message }, 500);
      if (!data) return json({ error: "Incident not found" }, 404);
      return json(data);
    }

    // ── Create Incident ──────────────────────────────────────────────────────
    if (path === "/api/incidents" && method === "POST") {
      const body = await req.json();
      if (!body.title || !body.service) {
        return json({ error: "Title and service are required" }, 400);
      }
      const sb = getSupabase();
      const { data, error } = await sb.from("incidents").insert({
        title: body.title,
        service: body.service,
        severity: body.severity || "SEV-2",
        status: "active",
        description: body.description || null,
        logs: body.logs || null,
        error_message: body.error_message || null,
        recent_changes: body.recent_changes || null,
        affected_component: body.affected_component || null,
      }).select("*").single();
      if (error) return json({ error: error.message }, 500);
      return json(data, 201);
    }

    // ── Analyze Incident ─────────────────────────────────────────────────────
    const analyzeMatch = path.match(/^\/api\/incidents\/([^/]+)\/analyze$/);
    if (analyzeMatch && method === "POST") {
      const sb = getSupabase();
      const { data: incident, error } = await sb.from("incidents").select("*").eq("id", analyzeMatch[1]).maybeSingle();
      if (error) return json({ error: error.message }, 500);
      if (!incident) return json({ error: "Incident not found" }, 404);

      const settings = await getSettings();
      if (!settings) return json({ error: "Settings not configured" }, 500);

      // Update status to analyzing
      await sb.from("incidents").update({ status: "analyzing" }).eq("id", incident.id);

      let result;
      try {
        result = await analyzeIncident(incident as Incident, settings);
      } catch (err: any) {
        // Revert status on failure
        await sb.from("incidents").update({ status: "active" }).eq("id", incident.id);
        return json({ error: err.message }, 500);
      }

      // Save analysis results
      const { error: updateError } = await sb.from("incidents").update({
        analysis: result.analysis,
        recalled_memories: result.recalledMemories,
        status: "active",
      }).eq("id", incident.id);

      if (updateError) return json({ error: updateError.message }, 500);

      return json({
        analysis: result.analysis,
        recalledMemories: result.recalledMemories,
        memoryAvailable: result.memoryAvailable,
        memoryError: result.memoryError,
      });
    }

    // ── Resolve Incident ─────────────────────────────────────────────────────
    const resolveMatch = path.match(/^\/api\/incidents\/([^/]+)\/resolve$/);
    if (resolveMatch && method === "POST") {
      const body = await req.json();
      const sb = getSupabase();
      const { data: incident, error } = await sb.from("incidents").select("*").eq("id", resolveMatch[1]).maybeSingle();
      if (error) return json({ error: error.message }, 500);
      if (!incident) return json({ error: "Incident not found" }, 404);

      const settings = await getSettings();

      // Update incident with resolution
      const { data: updated, error: updateError } = await sb.from("incidents").update({
        root_cause: body.root_cause || null,
        failed_attempts: body.failed_attempts || null,
        successful_fix: body.successful_fix || null,
        impact: body.impact || null,
        lessons_learned: body.lessons_learned || null,
        status: "resolved",
        resolved_at: new Date().toISOString(),
      }).eq("id", incident.id).select("*").single();

      if (updateError) return json({ error: updateError.message }, 500);

      // Store in Hindsight
      let memoryStored = false;
      let memoryError: string | undefined;
      if (settings) {
        const memoryContent = buildMemoryContent(updated as Incident);
        const tags = [updated.service, updated.severity];
        const retainResult = await hindsightRetain(settings, memoryContent, `incident-${updated.id}`, tags);
        memoryStored = retainResult.success;
        memoryError = retainResult.error;

        if (memoryStored) {
          await sb.from("incidents").update({ memory_stored: true }).eq("id", updated.id);
        }
      }

      return json({
        incident: updated,
        memoryStored,
        memoryError,
      });
    }

    // ── Demo: Seed Data ──────────────────────────────────────────────────────
    if (path === "/api/demo/seed" && method === "POST") {
      const settings = await getSettings();
      if (!settings) return json({ error: "Settings not configured" }, 500);

      const sb = getSupabase();

      // Create resolved incidents with full resolution data
      const createdIncidents: any[] = [];
      let memorySuccessCount = 0;
      let memoryFailCount = 0;
      const memoryErrors: string[] = [];

      for (const demo of DEMO_INCIDENTS) {
        // Create incident
        const { data: incident, error: createError } = await sb.from("incidents").insert({
          title: demo.title,
          service: demo.service,
          severity: demo.severity,
          status: "resolved",
          description: demo.description,
          logs: demo.logs,
          error_message: demo.error_message,
          recent_changes: demo.recent_changes,
          affected_component: demo.affected_component,
          root_cause: demo.root_cause,
          failed_attempts: demo.failed_attempts,
          successful_fix: demo.successful_fix,
          impact: demo.impact,
          lessons_learned: demo.lessons_learned,
          memory_stored: false,
          resolved_at: new Date().toISOString(),
          created_at: new Date(Date.now() - Math.random() * 7 * 24 * 60 * 60 * 1000).toISOString(),
        }).select("*").single();

        if (createError) {
          memoryErrors.push(`Failed to create ${demo.title}: ${createError.message}`);
          continue;
        }
        createdIncidents.push(incident);

        // Store in Hindsight
        const memoryContent = buildMemoryContent(incident as Incident);
        const tags = [incident.service, incident.severity];
        const retainResult = await hindsightRetain(settings, memoryContent, `incident-${incident.id}`, tags);
        if (retainResult.success) {
          memorySuccessCount++;
          await sb.from("incidents").update({ memory_stored: true }).eq("id", incident.id);
        } else {
          memoryFailCount++;
          if (retainResult.error) memoryErrors.push(`${demo.title}: ${retainResult.error}`);
        }
      }

      return json({
        seeded: createdIncidents.length,
        memoryStored: memorySuccessCount,
        memoryFailed: memoryFailCount,
        memoryErrors: memoryErrors.length ? memoryErrors : undefined,
        message: memoryFailCount === 0
          ? `Seeded ${createdIncidents.length} incidents and stored all in Hindsight memory.`
          : `Seeded ${createdIncidents.length} incidents. ${memorySuccessCount} stored in Hindsight, ${memoryFailCount} failed. Configure Hindsight in Settings to enable memory storage.`,
      });
    }

    // ── Demo: Load Similar Incident ──────────────────────────────────────────
    if (path === "/api/demo/load-similar" && method === "POST") {
      const sb = getSupabase();
      const { data, error } = await sb.from("incidents").insert({
        title: DEMO_SIMILAR_INCIDENT.title!,
        service: DEMO_SIMILAR_INCIDENT.service!,
        severity: DEMO_SIMILAR_INCIDENT.severity!,
        status: "active",
        description: DEMO_SIMILAR_INCIDENT.description!,
        logs: DEMO_SIMILAR_INCIDENT.logs!,
        error_message: DEMO_SIMILAR_INCIDENT.error_message!,
        recent_changes: DEMO_SIMILAR_INCIDENT.recent_changes!,
        affected_component: DEMO_SIMILAR_INCIDENT.affected_component!,
      }).select("*").single();
      if (error) return json({ error: error.message }, 500);
      return json(data, 201);
    }

    // ── 404 ──────────────────────────────────────────────────────────────────
    return json({ error: `Not found: ${method} ${path}` }, 404);
  } catch (err: any) {
    return json({ error: err.message || "Internal server error" }, 500);
  }
});

function json(data: any, status = 200) {
  return new Response(JSON.stringify(data), {
    status,
    headers: { ...corsHeaders, "Content-Type": "application/json" },
  });
}
