import { useState, useEffect, useCallback } from "react";
import {
  ArrowLeft,
  Brain,
  Sparkles,
  CheckCircle2,
  AlertTriangle,
  Lightbulb,
  ClipboardList,
  ShieldCheck,
  History,
  ChevronDown,
  ChevronUp,
  Search,
  Zap,
  Save,
  Target,
  XCircle,
  Wrench,
  TrendingUp,
} from "lucide-react";
import { Layout } from "@/components/Layout";
import {
  Button,
  Card,
  SeverityBadge,
  StatusBadge,
  Spinner,
  ErrorBanner,
  WarningBanner,
  EmptyState,
} from "@/components/ui";
import { fetchIncident, analyzeIncident, resolveIncident } from "@/api";
import type { Incident, AnalysisResult, RecalledMemory, PageId } from "@/types";
import { formatDate, formatTimeAgo } from "@/types";

const ANALYSIS_STEPS = [
  "Analyzing incident evidence...",
  "Searching organizational memory...",
  "Comparing historical incidents...",
  "Generating investigation plan...",
];

export function IncidentDetailPage({
  incidentId,
  onNavigate,
  onBack,
}: {
  incidentId: string;
  onNavigate: (page: PageId) => void;
  onBack: () => void;
}) {
  const [incident, setIncident] = useState<Incident | null>(null);
  const [loading, setLoading] = useState(true);
  const [analyzing, setAnalyzing] = useState(false);
  const [analyzeStep, setAnalyzeStep] = useState(0);
  const [analyzeError, setAnalyzeError] = useState<string | null>(null);
  const [memoryWarning, setMemoryWarning] = useState<string | null>(null);
  const [showResolveForm, setShowResolveForm] = useState(false);
  const [resolveForm, setResolveForm] = useState({
    root_cause: "",
    failed_attempts: "",
    successful_fix: "",
    impact: "",
    lessons_learned: "",
  });
  const [resolving, setResolving] = useState(false);
  const [resolveResult, setResolveResult] = useState<{ stored: boolean; error?: string } | null>(null);
  const [expandedLogs, setExpandedLogs] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const loadIncident = useCallback(async () => {
    try {
      const data = await fetchIncident(incidentId);
      setIncident(data);
    } catch (err: any) {
      setError(err.message);
    } finally {
      setLoading(false);
    }
  }, [incidentId]);

  useEffect(() => {
    loadIncident();
  }, [loadIncident]);

  const handleAnalyze = async () => {
    setAnalyzing(true);
    setAnalyzeError(null);
    setMemoryWarning(null);
    setAnalyzeStep(0);

    // Animate through the analysis steps
    const stepInterval = setInterval(() => {
      setAnalyzeStep((prev) => Math.min(prev + 1, ANALYSIS_STEPS.length - 1));
    }, 1500);

    try {
      const result = await analyzeIncident(incidentId);
      clearInterval(stepInterval);
      setAnalyzeStep(ANALYSIS_STEPS.length - 1);

      if (!result.memoryAvailable && result.memoryError) {
        setMemoryWarning(result.memoryError);
      }

      await loadIncident();
    } catch (err: any) {
      clearInterval(stepInterval);
      setAnalyzeError(err.message);
    } finally {
      setAnalyzing(false);
    }
  };

  const handleResolve = async () => {
    if (!resolveForm.root_cause.trim() || !resolveForm.successful_fix.trim()) {
      return;
    }
    setResolving(true);
    setResolveResult(null);
    try {
      const result = await resolveIncident(incidentId, {
        root_cause: resolveForm.root_cause.trim(),
        failed_attempts: resolveForm.failed_attempts.trim(),
        successful_fix: resolveForm.successful_fix.trim(),
        impact: resolveForm.impact.trim(),
        lessons_learned: resolveForm.lessons_learned.trim(),
      });
      setResolveResult({ stored: result.memoryStored, error: result.memoryError });
      await loadIncident();
    } catch (err: any) {
      setResolveResult({ stored: false, error: err.message });
    } finally {
      setResolving(false);
    }
  };

  if (loading) {
    return (
      <Layout currentPage="active" onNavigate={onNavigate}>
        <div className="flex items-center justify-center py-32 text-slate-400">
          <Spinner size="lg" />
        </div>
      </Layout>
    );
  }

  if (error || !incident) {
    return (
      <Layout currentPage="active" onNavigate={onNavigate}>
        <div className="p-6">
          <ErrorBanner message={error || "Incident not found"} />
          <div className="mt-4">
            <Button variant="secondary" size="sm" onClick={onBack}>
              <ArrowLeft className="h-4 w-4" />
              Back
            </Button>
          </div>
        </div>
      </Layout>
    );
  }

  const analysis = incident.analysis as AnalysisResult | null;
  const recalledMemories = (incident.recalled_memories as RecalledMemory[] | null) || [];

  return (
    <Layout currentPage="active" onNavigate={onNavigate}>
      {/* Header */}
      <div className="border-b border-slate-200 bg-white px-6 py-4">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-3 min-w-0">
            <button onClick={onBack} className="rounded-md p-1.5 text-slate-500 hover:bg-slate-100">
              <ArrowLeft className="h-5 w-5" />
            </button>
            <div className="min-w-0">
              <div className="flex items-center gap-2 mb-0.5">
                <SeverityBadge severity={incident.severity} />
                <StatusBadge status={incident.status} />
                <span className="text-xs text-slate-400">{incident.service}</span>
              </div>
              <h1 className="text-base font-semibold text-slate-900 truncate">{incident.title}</h1>
            </div>
          </div>
          <div className="flex items-center gap-2 flex-shrink-0">
            {!analysis && !analyzing && (
              <Button size="sm" onClick={handleAnalyze}>
                <Sparkles className="h-4 w-4" />
                Analyze Incident
              </Button>
            )}
            {analysis && incident.status !== "resolved" && !showResolveForm && (
              <Button variant="success" size="sm" onClick={() => setShowResolveForm(true)}>
                <CheckCircle2 className="h-4 w-4" />
                Resolve Incident
              </Button>
            )}
          </div>
        </div>
      </div>

      <div className="space-y-4 p-6 max-w-5xl">
        {/* Overview */}
        <Card className="p-5">
          <div className="grid grid-cols-2 gap-4 sm:grid-cols-4">
            <InfoField label="Incident ID" value={incident.id.slice(0, 8)} />
            <InfoField label="Service" value={incident.service} />
            <InfoField label="Created" value={formatTimeAgo(incident.created_at)} />
            <InfoField label="Affected" value={incident.affected_component || "—"} />
          </div>
        </Card>

        {/* Evidence */}
        <Card className="overflow-hidden">
          <div className="border-b border-slate-200 bg-slate-50 px-5 py-3">
            <h2 className="text-sm font-semibold text-slate-700 flex items-center gap-2">
              <AlertTriangle className="h-4 w-4" />
              Current Evidence
            </h2>
          </div>
          <div className="space-y-4 p-5">
            {incident.description && (
              <Field label="Description" value={incident.description} />
            )}
            {incident.error_message && (
              <Field label="Error Message" value={incident.error_message} mono />
            )}
            {incident.logs && (
              <div>
                <button
                  onClick={() => setExpandedLogs(!expandedLogs)}
                  className="flex items-center gap-1.5 text-sm font-medium text-slate-700 mb-2"
                >
                  {expandedLogs ? <ChevronUp className="h-4 w-4" /> : <ChevronDown className="h-4 w-4" />}
                  Logs
                </button>
                {expandedLogs && (
                  <pre className="overflow-x-auto rounded-lg bg-slate-900 p-4 text-xs text-slate-300 font-mono whitespace-pre-wrap break-all">
                    {incident.logs}
                  </pre>
                )}
                {!expandedLogs && (
                  <pre className="overflow-hidden rounded-lg bg-slate-900 p-4 text-xs text-slate-300 font-mono max-h-24">
                    {incident.logs.split("\n").slice(0, 3).join("\n")}
                  </pre>
                )}
              </div>
            )}
            {incident.recent_changes && (
              <Field label="Recent Changes" value={incident.recent_changes} />
            )}
            {!incident.description && !incident.logs && !incident.error_message && !incident.recent_changes && (
              <p className="text-sm text-slate-400">No evidence provided.</p>
            )}
          </div>
        </Card>

        {/* Analyzing state */}
        {analyzing && (
          <Card className="p-8">
            <div className="flex flex-col items-center text-center">
              <div className="mb-4 flex h-12 w-12 items-center justify-center rounded-full bg-blue-50">
                <Brain className="h-6 w-6 text-blue-500 animate-pulse" />
              </div>
              <div className="space-y-2">
                {ANALYSIS_STEPS.map((step, idx) => (
                  <div
                    key={idx}
                    className={`flex items-center gap-2 text-sm transition-all ${
                      idx <= analyzeStep ? "text-slate-700" : "text-slate-300"
                    }`}
                  >
                    {idx < analyzeStep ? (
                      <CheckCircle2 className="h-4 w-4 text-emerald-500" />
                    ) : idx === analyzeStep ? (
                      <Spinner size="sm" />
                    ) : (
                      <div className="h-4 w-4 rounded-full border-2 border-slate-200" />
                    )}
                    {step}
                  </div>
                ))}
              </div>
            </div>
          </Card>
        )}

        {/* Analysis error */}
        {analyzeError && (
          <ErrorBanner message={analyzeError} onDismiss={() => setAnalyzeError(null)} />
        )}

        {/* Memory unavailable warning */}
        {memoryWarning && !analyzing && (
          <WarningBanner message={`Organizational memory unavailable. The current analysis uses only the evidence provided in this incident. (${memoryWarning})`} />
        )}

        {/* AI Analysis */}
        {analysis && !analyzing && (
          <>
            {/* Memory recall section */}
            {recalledMemories.length > 0 && (
              <Card className="overflow-hidden border-blue-200">
                <div className="border-b border-blue-200 bg-blue-50 px-5 py-3">
                  <h2 className="text-sm font-semibold text-blue-800 flex items-center gap-2">
                    <Brain className="h-4 w-4" />
                    Organizational Memory — Recalled from Hindsight
                  </h2>
                </div>
                <div className="p-5 space-y-3">
                  {recalledMemories.map((mem, idx) => (
                    <div key={mem.id || idx} className="rounded-lg border border-slate-200 bg-slate-50 p-4">
                      <div className="flex items-start justify-between gap-3 mb-2">
                        <div className="flex items-center gap-2">
                          <span className={`inline-flex items-center rounded-full px-2 py-0.5 text-xs font-medium ${
                            mem.type === "observation" ? "bg-purple-100 text-purple-700" :
                            mem.type === "experience" ? "bg-blue-100 text-blue-700" :
                            "bg-slate-100 text-slate-600"
                          }`}>
                            {mem.type}
                          </span>
                          {mem.entities.length > 0 && (
                            <span className="text-xs text-slate-400">
                              {mem.entities.join(", ")}
                            </span>
                          )}
                        </div>
                        <span className="text-xs text-slate-400">
                          Score: {mem.score.toFixed(4)}
                        </span>
                      </div>
                      <p className="text-sm text-slate-700">{mem.text}</p>
                    </div>
                  ))}
                </div>
              </Card>
            )}

            {/* Structured analysis */}
            <Card className="overflow-hidden">
              <div className="border-b border-slate-200 bg-slate-50 px-5 py-3">
                <h2 className="text-sm font-semibold text-slate-700 flex items-center gap-2">
                  <Sparkles className="h-4 w-4" />
                  AI Investigation Analysis
                </h2>
              </div>
              <div className="space-y-5 p-5">
                <Section title="Incident Summary" icon={<AlertTriangle className="h-4 w-4 text-amber-500" />}>
                  <p className="text-sm text-slate-700">{analysis.summary}</p>
                </Section>

                <Section title="Current Evidence" icon={<Search className="h-4 w-4 text-slate-500" />}>
                  <ul className="space-y-1">
                    {analysis.currentEvidence.map((e, i) => (
                      <li key={i} className="flex items-start gap-2 text-sm text-slate-700">
                        <span className="text-slate-300 mt-0.5">•</span>
                        {e}
                      </li>
                    ))}
                  </ul>
                </Section>

                {analysis.historicalMemory.length > 0 && (
                  <Section title="Historical Memory" icon={<History className="h-4 w-4 text-blue-500" />}>
                    <div className="space-y-3">
                      {analysis.historicalMemory.map((mem, i) => (
                        <div key={i} className="rounded-lg border border-blue-200 bg-blue-50/50 p-4">
                          <div className="flex items-center gap-2 mb-2">
                            <Brain className="h-4 w-4 text-blue-500" />
                            <span className="text-sm font-medium text-blue-900">{mem.incidentId}</span>
                            {mem.service && <span className="text-xs text-blue-600">· {mem.service}</span>}
                            {mem.date && <span className="text-xs text-slate-400">· {mem.date}</span>}
                          </div>
                          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 text-xs">
                            {mem.symptoms && <MemField label="Symptoms" value={mem.symptoms} />}
                            {mem.rootCause && <MemField label="Root Cause" value={mem.rootCause} />}
                            {mem.failedAttempts && <MemField label="Failed Attempt" value={mem.failedAttempts} />}
                            {mem.successfulFix && <MemField label="Successful Fix" value={mem.successfulFix} />}
                            {mem.lessonsLearned && <MemField label="Lesson Learned" value={mem.lessonsLearned} />}
                          </div>
                          {mem.relevance && (
                            <p className="mt-2 text-xs text-slate-500 italic">Relevance: {mem.relevance}</p>
                          )}
                        </div>
                      ))}
                    </div>
                  </Section>
                )}

                {analysis.inference.length > 0 && (
                  <Section title="Agent Inference" icon={<Lightbulb className="h-4 w-4 text-yellow-500" />}>
                    <div className="rounded-lg border border-yellow-200 bg-yellow-50/50 p-4 space-y-1">
                      {analysis.inference.map((inf, i) => (
                        <p key={i} className="text-sm text-slate-700 flex items-start gap-2">
                          <Lightbulb className="h-3.5 w-3.5 text-yellow-500 mt-0.5 flex-shrink-0" />
                          {inf}
                        </p>
                      ))}
                    </div>
                  </Section>
                )}

                <Section title="Investigation Plan" icon={<ClipboardList className="h-4 w-4 text-slate-500" />}>
                  <ol className="space-y-2">
                    {analysis.investigationPlan.map((step, i) => (
                      <li key={i} className="flex items-start gap-3 text-sm text-slate-700">
                        <span className="flex h-5 w-5 flex-shrink-0 items-center justify-center rounded-full bg-slate-900 text-xs font-medium text-white">
                          {i + 1}
                        </span>
                        {step}
                      </li>
                    ))}
                  </ol>
                </Section>

                <Section title="Recommended Actions" icon={<ShieldCheck className="h-4 w-4 text-emerald-500" />}>
                  <ul className="space-y-1.5">
                    {analysis.recommendations.map((rec, i) => (
                      <li key={i} className="flex items-start gap-2 text-sm text-slate-700">
                        <ShieldCheck className="h-4 w-4 text-emerald-500 flex-shrink-0 mt-0.5" />
                        {rec}
                      </li>
                    ))}
                  </ul>
                </Section>

                <Section title="Confidence & Reasoning" icon={<TrendingUp className="h-4 w-4 text-slate-500" />}>
                  <p className="text-sm text-slate-700">{analysis.confidence}</p>
                </Section>
              </div>
            </Card>
          </>
        )}

        {/* No analysis yet and not analyzing */}
        {!analysis && !analyzing && (
          <Card className="p-8">
            <EmptyState
              icon={<Sparkles className="h-7 w-7" />}
              title="Ready for AI Analysis"
              message="Click 'Analyze Incident' to have RecallOps search organizational memory and generate an investigation plan."
              action={
                <Button size="sm" onClick={handleAnalyze}>
                  <Sparkles className="h-4 w-4" />
                  Analyze Incident
                </Button>
              }
            />
          </Card>
        )}

        {/* Resolution form */}
        {showResolveForm && incident.status !== "resolved" && (
          <Card className="overflow-hidden border-emerald-200">
            <div className="border-b border-emerald-200 bg-emerald-50 px-5 py-3">
              <h2 className="text-sm font-semibold text-emerald-800 flex items-center gap-2">
                <CheckCircle2 className="h-4 w-4" />
                Resolve Incident
              </h2>
            </div>
            <div className="p-5 space-y-4">
              <ResolveField
                label="Root Cause"
                icon={<Target className="h-4 w-4 text-slate-400" />}
                placeholder="What was the actual root cause?"
                value={resolveForm.root_cause}
                onChange={(v) => setResolveForm((p) => ({ ...p, root_cause: v }))}
                required
              />
              <ResolveField
                label="Failed Attempts"
                icon={<XCircle className="h-4 w-4 text-slate-400" />}
                placeholder="What did you try that didn't work?"
                value={resolveForm.failed_attempts}
                onChange={(v) => setResolveForm((p) => ({ ...p, failed_attempts: v }))}
              />
              <ResolveField
                label="Successful Fix"
                icon={<Wrench className="h-4 w-4 text-slate-400" />}
                placeholder="What actually resolved the incident?"
                value={resolveForm.successful_fix}
                onChange={(v) => setResolveForm((p) => ({ ...p, successful_fix: v }))}
                required
              />
              <ResolveField
                label="Impact"
                icon={<AlertTriangle className="h-4 w-4 text-slate-400" />}
                placeholder="What was the business/user impact?"
                value={resolveForm.impact}
                onChange={(v) => setResolveForm((p) => ({ ...p, impact: v }))}
              />
              <ResolveField
                label="Lessons Learned"
                icon={<Brain className="h-4 w-4 text-slate-400" />}
                placeholder="What should the organization remember from this incident?"
                value={resolveForm.lessons_learned}
                onChange={(v) => setResolveForm((p) => ({ ...p, lessons_learned: v }))}
              />

              {resolveResult && (
                <div className={`rounded-lg px-4 py-3 ${
                  resolveResult.stored
                    ? "border border-emerald-200 bg-emerald-50"
                    : "border border-amber-200 bg-amber-50"
                }`}>
                  {resolveResult.stored ? (
                    <div className="flex items-start gap-3">
                      <Brain className="h-5 w-5 text-blue-500 mt-0.5" />
                      <div className="text-sm">
                        <p className="font-medium text-slate-900">Organizational Memory Updated</p>
                        <p className="text-slate-600 mt-0.5">
                          This incident has been stored in Hindsight and can now improve future investigations.
                        </p>
                      </div>
                    </div>
                  ) : (
                    <div className="text-sm text-amber-700">
                      <p className="font-medium">Incident resolved, but memory storage failed.</p>
                      <p className="mt-0.5">{resolveResult.error || "Hindsight may not be configured. Check Settings."}</p>
                    </div>
                  )}
                </div>
              )}

              <div className="flex items-center justify-end gap-2 border-t border-slate-200 pt-4">
                <Button variant="ghost" size="md" onClick={() => setShowResolveForm(false)}>
                  Cancel
                </Button>
                <Button
                  variant="success"
                  size="md"
                  onClick={handleResolve}
                  disabled={resolving || !resolveForm.root_cause.trim() || !resolveForm.successful_fix.trim()}
                >
                  {resolving ? <Spinner size="sm" /> : <Save className="h-4 w-4" />}
                  Save Resolution & Learn
                </Button>
              </div>
            </div>
          </Card>
        )}

        {/* Resolution details (if resolved) */}
        {incident.status === "resolved" && incident.root_cause && (
          <Card className="overflow-hidden border-emerald-200">
            <div className="border-b border-emerald-200 bg-emerald-50 px-5 py-3">
              <h2 className="text-sm font-semibold text-emerald-800 flex items-center gap-2">
                <CheckCircle2 className="h-4 w-4" />
                Resolution
              </h2>
            </div>
            <div className="p-5 space-y-4">
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                <ResolutionField label="Root Cause" value={incident.root_cause} />
                <ResolutionField label="Impact" value={incident.impact || "—"} />
                <ResolutionField label="Failed Attempts" value={incident.failed_attempts || "—"} />
                <ResolutionField label="Successful Fix" value={incident.successful_fix || "—"} />
              </div>
              {incident.lessons_learned && (
                <div className="rounded-lg border border-blue-200 bg-blue-50/50 p-4">
                  <div className="flex items-start gap-2">
                    <Brain className="h-4 w-4 text-blue-500 mt-0.5" />
                    <div>
                      <p className="text-xs font-medium text-blue-700 uppercase tracking-wide mb-1">Lessons Learned</p>
                      <p className="text-sm text-slate-700">{incident.lessons_learned}</p>
                    </div>
                  </div>
                </div>
              )}

              {/* Memory storage status */}
              <div className={`flex items-center gap-3 rounded-lg px-4 py-3 ${
                incident.memory_stored
                  ? "border border-blue-200 bg-blue-50"
                  : "border border-amber-200 bg-amber-50"
              }`}>
                <Brain className={`h-5 w-5 ${incident.memory_stored ? "text-blue-500" : "text-amber-500"}`} />
                <div className="text-sm">
                  {incident.memory_stored ? (
                    <>
                      <p className="font-medium text-slate-900">Stored in Hindsight</p>
                      <p className="text-slate-600">This incident's experience is part of organizational memory and will be recalled for future similar incidents.</p>
                    </>
                  ) : (
                    <>
                      <p className="font-medium text-amber-800">Not stored in Hindsight</p>
                      <p className="text-amber-600">This incident was resolved but the resolution was not stored in Hindsight memory. Configure Hindsight in Settings to enable memory storage.</p>
                    </>
                  )}
                </div>
              </div>

              <p className="text-xs text-slate-400">
                Resolved on {formatDate(incident.resolved_at || incident.created_at)}
              </p>
            </div>
          </Card>
        )}
      </div>
    </Layout>
  );
}

function InfoField({ label, value }: { label: string; value: string }) {
  return (
    <div>
      <p className="text-xs font-medium text-slate-400 uppercase tracking-wide">{label}</p>
      <p className="mt-0.5 text-sm text-slate-700 truncate">{value}</p>
    </div>
  );
}

function Field({ label, value, mono }: { label: string; value: string; mono?: boolean }) {
  return (
    <div>
      <p className="text-xs font-medium text-slate-400 uppercase tracking-wide mb-1">{label}</p>
      <p className={`text-sm text-slate-700 ${mono ? "font-mono text-xs" : ""}`}>{value}</p>
    </div>
  );
}

function Section({ title, icon, children }: { title: string; icon: React.ReactNode; children: React.ReactNode }) {
  return (
    <div>
      <h3 className="flex items-center gap-2 text-sm font-semibold text-slate-700 mb-2">
        {icon}
        {title}
      </h3>
      {children}
    </div>
  );
}

function MemField({ label, value }: { label: string; value: string }) {
  return (
    <div>
      <p className="text-xs font-medium text-slate-400 uppercase tracking-wide">{label}</p>
      <p className="text-sm text-slate-700 mt-0.5">{value}</p>
    </div>
  );
}

function ResolveField({
  label,
  icon,
  placeholder,
  value,
  onChange,
  required,
}: {
  label: string;
  icon: React.ReactNode;
  placeholder: string;
  value: string;
  onChange: (v: string) => void;
  required?: boolean;
}) {
  return (
    <div>
      <label className="flex items-center gap-2 text-sm font-medium text-slate-700 mb-1.5">
        {icon}
        {label} {required && <span className="text-red-500">*</span>}
      </label>
      <textarea
        className="w-full rounded-lg border border-slate-300 px-3 py-2 text-sm text-slate-900 placeholder:text-slate-400 focus:border-slate-400 focus:ring-2 focus:ring-slate-200 outline-none transition-all min-h-[60px]"
        placeholder={placeholder}
        value={value}
        onChange={(e) => onChange(e.target.value)}
      />
    </div>
  );
}

function ResolutionField({ label, value }: { label: string; value: string }) {
  return (
    <div>
      <p className="text-xs font-medium text-slate-400 uppercase tracking-wide mb-1">{label}</p>
      <p className="text-sm text-slate-700">{value}</p>
    </div>
  );
}
