import { useState, useEffect, useCallback } from "react";
import {
  AlertTriangle,
  CheckCircle2,
  Brain,
  Zap,
  TrendingUp,
  Plus,
  FlaskConical,
  ArrowRight,
  Clock,
  Activity,
} from "lucide-react";
import { Layout, PageHeader } from "@/components/Layout";
import { Card, SeverityBadge, StatusBadge, Button, Spinner, EmptyState } from "@/components/ui";
import { fetchIncidents, fetchMemoryStatus, seedDemoData, loadSimilarIncident } from "@/api";
import type { Incident, MemoryStatus, PageId } from "@/types";
import { formatTimeAgo } from "@/types";

export function DashboardPage({
  onNavigate,
  onOpenIncident,
}: {
  onNavigate: (page: PageId) => void;
  onOpenIncident: (id: string) => void;
}) {
  const [incidents, setIncidents] = useState<Incident[]>([]);
  const [memoryStatus, setMemoryStatus] = useState<MemoryStatus | null>(null);
  const [loading, setLoading] = useState(true);
  const [seeding, setSeeding] = useState(false);
  const [loadingSimilar, setLoadingSimilar] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [seedResult, setSeedResult] = useState<string | null>(null);

  const loadData = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const [incData, memStatus] = await Promise.all([
        fetchIncidents(),
        fetchMemoryStatus().catch(() => null),
      ]);
      setIncidents(incData);
      setMemoryStatus(memStatus);
    } catch (err: any) {
      setError(err.message);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    loadData();
  }, [loadData]);

  const activeIncidents = incidents.filter((i) => i.status === "active" || i.status === "analyzing");
  const criticalIncidents = incidents.filter((i) => i.severity === "SEV-1" && i.status !== "resolved");
  const resolvedIncidents = incidents.filter((i) => i.status === "resolved");
  const memoryCount = memoryStatus?.storedMemories ?? incidents.filter((i) => i.memory_stored).length;

  const handleSeed = async () => {
    setSeeding(true);
    setError(null);
    setSeedResult(null);
    try {
      const result = await seedDemoData();
      setSeedResult(result.message);
      await loadData();
    } catch (err: any) {
      setError(err.message);
    } finally {
      setSeeding(false);
    }
  };

  const handleLoadSimilar = async () => {
    setLoadingSimilar(true);
    setError(null);
    try {
      const incident = await loadSimilarIncident();
      onOpenIncident(incident.id);
    } catch (err: any) {
      setError(err.message);
    } finally {
      setLoadingSimilar(false);
    }
  };

  if (loading) {
    return (
      <Layout currentPage="dashboard" onNavigate={onNavigate}>
        <div className="flex items-center justify-center py-32 text-slate-400">
          <Spinner size="lg" />
        </div>
      </Layout>
    );
  }

  const hasNoIncidents = incidents.length === 0;

  return (
    <Layout currentPage="dashboard" onNavigate={onNavigate}>
      <PageHeader
        title="Dashboard"
        subtitle="Your AI Incident Response Engineer with organizational memory"
        actions={
          <div className="flex items-center gap-2">
            <Button variant="secondary" size="sm" onClick={handleSeed} disabled={seeding || loadingSimilar}>
              {seeding ? <Spinner size="sm" /> : <FlaskConical className="h-4 w-4" />}
              Seed Demo Data
            </Button>
            <Button variant="secondary" size="sm" onClick={handleLoadSimilar} disabled={seeding || loadingSimilar}>
              {loadingSimilar ? <Spinner size="sm" /> : <Zap className="h-4 w-4" />}
              Load Similar Incident
            </Button>
            <Button size="sm" onClick={() => onNavigate("active")}>
              <Plus className="h-4 w-4" />
              New Incident
            </Button>
          </div>
        }
      />

      <div className="space-y-6 p-6">
        {error && (
          <div className="rounded-lg border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-700">
            {error}
          </div>
        )}
        {seedResult && (
          <div className="rounded-lg border border-emerald-200 bg-emerald-50 px-4 py-3 text-sm text-emerald-700">
            {seedResult}
          </div>
        )}

        {/* Hero section for first-time users */}
        {hasNoIncidents && (
          <Card className="overflow-hidden">
            <div className="relative bg-gradient-to-br from-slate-900 to-slate-800 px-8 py-10 text-white">
              <div className="relative z-10 max-w-2xl">
                <div className="mb-3 inline-flex items-center gap-2 rounded-full bg-white/10 px-3 py-1 text-xs font-medium text-slate-200">
                  <Brain className="h-3.5 w-3.5" />
                  Powered by Hindsight Memory
                </div>
                <h2 className="text-2xl font-bold tracking-tight">RecallOps</h2>
                <p className="mt-2 text-base text-slate-300">
                  Your AI Incident Response Engineer. Investigate incidents using the experience
                  your organization has already accumulated.
                </p>
                <p className="mt-4 text-sm text-slate-400">
                  Start by seeding historical incident data, then create a new incident to see how
                  RecallOps recalls past experience to produce better investigations.
                </p>
                <div className="mt-6 flex flex-wrap gap-3">
                  <Button variant="primary" size="md" onClick={handleSeed} disabled={seeding}>
                    {seeding ? <Spinner size="sm" /> : <FlaskConical className="h-4 w-4" />}
                    Seed Organizational Memory
                  </Button>
                </div>
              </div>
            </div>
          </Card>
        )}

        {/* Stats cards */}
        <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-4">
          <StatCard
            label="Active Incidents"
            value={activeIncidents.length}
            icon={<AlertTriangle className="h-5 w-5" />}
            color="red"
            onClick={() => onNavigate("active")}
          />
          <StatCard
            label="Critical (SEV-1)"
            value={criticalIncidents.length}
            icon={<Zap className="h-5 w-5" />}
            color="orange"
            onClick={() => onNavigate("active")}
          />
          <StatCard
            label="Resolved"
            value={resolvedIncidents.length}
            icon={<CheckCircle2 className="h-5 w-5" />}
            color="emerald"
            onClick={() => onNavigate("history")}
          />
          <StatCard
            label="Org Memories"
            value={memoryCount}
            icon={<Brain className="h-5 w-5" />}
            color="blue"
            onClick={() => onNavigate("memory")}
          />
        </div>

        {/* Memory status banner */}
        {memoryStatus && !memoryStatus.available && (
          <div className="flex items-center gap-3 rounded-lg border border-amber-200 bg-amber-50 px-4 py-3">
            <Brain className="h-5 w-5 flex-shrink-0 text-amber-500" />
            <div className="flex-1 text-sm text-amber-700">
              <span className="font-medium">Organizational memory unavailable.</span>{" "}
              {!memoryStatus.llmConfigured
                ? "Configure your LLM and Hindsight credentials in Settings to enable AI analysis with memory recall."
                : (memoryStatus.error || "Hindsight is not connected. Configure it in Settings.")}
            </div>
            <Button variant="secondary" size="sm" onClick={() => onNavigate("settings")}>
              Configure
            </Button>
          </div>
        )}

        {/* Active incidents */}
        <div>
          <div className="mb-3 flex items-center justify-between">
            <h2 className="text-sm font-semibold text-slate-700 uppercase tracking-wide">Active Incidents</h2>
            {activeIncidents.length > 0 && (
              <button
                onClick={() => onNavigate("active")}
                className="text-xs font-medium text-slate-500 hover:text-slate-700 flex items-center gap-1"
              >
                View all <ArrowRight className="h-3 w-3" />
              </button>
            )}
          </div>
          {activeIncidents.length === 0 ? (
            <Card className="py-8">
              <EmptyState
                icon={<CheckCircle2 className="h-7 w-7" />}
                title="No active incidents"
                message="Your incident queue is clear. Create a new incident or load a demo incident to get started."
                action={
                  <div className="flex gap-2">
                    <Button variant="secondary" size="sm" onClick={handleLoadSimilar} disabled={loadingSimilar}>
                      {loadingSimilar ? <Spinner size="sm" /> : <Zap className="h-4 w-4" />}
                      Load Demo Incident
                    </Button>
                    <Button size="sm" onClick={() => onNavigate("active")}>
                      <Plus className="h-4 w-4" />
                      Create Incident
                    </Button>
                  </div>
                }
              />
            </Card>
          ) : (
            <div className="space-y-3">
              {activeIncidents.slice(0, 5).map((incident) => (
                <Card key={incident.id} onClick={() => onOpenIncident(incident.id)} className="p-4">
                  <div className="flex items-start justify-between gap-4">
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center gap-2 mb-1.5">
                        <SeverityBadge severity={incident.severity} />
                        <StatusBadge status={incident.status} />
                        <span className="text-xs text-slate-400">{incident.service}</span>
                      </div>
                      <h3 className="text-sm font-medium text-slate-900 truncate">{incident.title}</h3>
                      {incident.description && (
                        <p className="mt-1 text-xs text-slate-500 line-clamp-2">{incident.description}</p>
                      )}
                    </div>
                    <div className="flex flex-col items-end gap-1 flex-shrink-0">
                      <span className="text-xs text-slate-400 flex items-center gap-1">
                        <Clock className="h-3 w-3" />
                        {formatTimeAgo(incident.created_at)}
                      </span>
                      {incident.analysis && (
                        <span className="inline-flex items-center gap-1 text-xs text-emerald-600">
                          <Activity className="h-3 w-3" />
                          Analyzed
                        </span>
                      )}
                      {incident.memory_stored && (
                        <span className="inline-flex items-center gap-1 text-xs text-blue-600">
                          <Brain className="h-3 w-3" />
                          In Memory
                        </span>
                      )}
                    </div>
                  </div>
                </Card>
              ))}
            </div>
          )}
        </div>

        {/* Recent resolved */}
        {resolvedIncidents.length > 0 && (
          <div>
            <div className="mb-3 flex items-center justify-between">
              <h2 className="text-sm font-semibold text-slate-700 uppercase tracking-wide">Recently Resolved</h2>
              <button
                onClick={() => onNavigate("history")}
                className="text-xs font-medium text-slate-500 hover:text-slate-700 flex items-center gap-1"
              >
                View all <ArrowRight className="h-3 w-3" />
              </button>
            </div>
            <div className="space-y-2">
              {resolvedIncidents.slice(0, 4).map((incident) => (
                <Card key={incident.id} onClick={() => onOpenIncident(incident.id)} className="p-3">
                  <div className="flex items-center justify-between gap-4">
                    <div className="flex items-center gap-3 flex-1 min-w-0">
                      <CheckCircle2 className="h-4 w-4 text-emerald-500 flex-shrink-0" />
                      <div className="min-w-0">
                        <p className="text-sm font-medium text-slate-900 truncate">{incident.title}</p>
                        <p className="text-xs text-slate-400">{incident.service} · {incident.root_cause?.slice(0, 60) || "No root cause"}</p>
                      </div>
                    </div>
                    <div className="flex items-center gap-2 flex-shrink-0">
                      {incident.memory_stored && <Brain className="h-3.5 w-3.5 text-blue-500" />}
                      <span className="text-xs text-slate-400">{formatTimeAgo(incident.resolved_at || incident.created_at)}</span>
                    </div>
                  </div>
                </Card>
              ))}
            </div>
          </div>
        )}

        {/* Memory Impact demo */}
        <Card className="overflow-hidden">
          <div className="border-b border-slate-200 bg-slate-50 px-5 py-3">
            <h2 className="text-sm font-semibold text-slate-700 flex items-center gap-2">
              <TrendingUp className="h-4 w-4" />
              Memory Impact — Before vs After Hindsight
            </h2>
          </div>
          <div className="grid grid-cols-1 md:grid-cols-2 divide-y md:divide-y-0 md:divide-x divide-slate-200">
            <div className="p-5">
              <div className="mb-3">
                <span className="inline-flex items-center rounded-full bg-slate-100 px-2.5 py-0.5 text-xs font-medium text-slate-600">
                  Without Memory
                </span>
              </div>
              <p className="text-sm text-slate-500 mb-3">Generic troubleshooting from a stateless AI:</p>
              <ul className="space-y-1.5 text-sm text-slate-600">
                <li className="flex items-start gap-2"><span className="text-slate-300">•</span> Check the logs for errors</li>
                <li className="flex items-start gap-2"><span className="text-slate-300">•</span> Verify database connectivity</li>
                <li className="flex items-start gap-2"><span className="text-slate-300">•</span> Review the latest deployment</li>
                <li className="flex items-start gap-2"><span className="text-slate-300">•</span> Check network connectivity</li>
                <li className="flex items-start gap-2"><span className="text-slate-300">•</span> Restart the affected service</li>
              </ul>
            </div>
            <div className="p-5 bg-blue-50/30">
              <div className="mb-3">
                <span className="inline-flex items-center gap-1.5 rounded-full bg-blue-100 px-2.5 py-0.5 text-xs font-medium text-blue-700">
                  <Brain className="h-3 w-3" />
                  With Hindsight Memory
                </span>
              </div>
              <p className="text-sm text-slate-500 mb-3">Specific investigation informed by past incidents:</p>
              <ul className="space-y-1.5 text-sm text-slate-700">
                <li className="flex items-start gap-2"><Brain className="h-3.5 w-3.5 mt-0.5 text-blue-500 flex-shrink-0" /> INC-1001: Same payment-service DB pool exhaustion</li>
                <li className="flex items-start gap-2"><Brain className="h-3.5 w-3.5 mt-0.5 text-blue-500 flex-shrink-0" /> Previous root cause: connection pool configuration</li>
                <li className="flex items-start gap-2"><Brain className="h-3.5 w-3.5 mt-0.5 text-blue-500 flex-shrink-0" /> Previous failed attempt: service restart</li>
                <li className="flex items-start gap-2"><Brain className="h-3.5 w-3.5 mt-0.5 text-blue-500 flex-shrink-0" /> Previous fix: corrected pool configuration</li>
                <li className="flex items-start gap-2"><Brain className="h-3.5 w-3.5 mt-0.5 text-blue-500 flex-shrink-0" /> Investigation targets the exact configuration drift</li>
              </ul>
            </div>
          </div>
        </Card>
      </div>
    </Layout>
  );
}

function StatCard({
  label,
  value,
  icon,
  color,
  onClick,
}: {
  label: string;
  value: number;
  icon: React.ReactNode;
  color: "red" | "orange" | "emerald" | "blue";
  onClick: () => void;
}) {
  const colors = {
    red: "bg-red-50 text-red-600",
    orange: "bg-orange-50 text-orange-600",
    emerald: "bg-emerald-50 text-emerald-600",
    blue: "bg-blue-50 text-blue-600",
  };
  return (
    <Card onClick={onClick} className="p-5">
      <div className="flex items-center justify-between">
        <div>
          <p className="text-xs font-medium text-slate-500 uppercase tracking-wide">{label}</p>
          <p className="mt-2 text-3xl font-bold text-slate-900">{value}</p>
        </div>
        <div className={`flex h-10 w-10 items-center justify-center rounded-lg ${colors[color]}`}>
          {icon}
        </div>
      </div>
    </Card>
  );
}
