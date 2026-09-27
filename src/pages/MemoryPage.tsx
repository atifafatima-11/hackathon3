import { useState, useEffect, useCallback } from "react";
import { Brain, CheckCircle2, AlertCircle, RefreshCw, Database } from "lucide-react";
import { Layout, PageHeader } from "@/components/Layout";
import { Card, SeverityBadge, Button, Spinner, EmptyState, Badge } from "@/components/ui";
import { fetchIncidents, fetchMemoryStatus } from "@/api";
import type { Incident, MemoryStatus, PageId } from "@/types";
import { formatDate } from "@/types";

export function MemoryPage({
  onNavigate,
  onOpenIncident,
}: {
  onNavigate: (page: PageId) => void;
  onOpenIncident: (id: string) => void;
}) {
  const [incidents, setIncidents] = useState<Incident[]>([]);
  const [memStatus, setMemStatus] = useState<MemoryStatus | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const load = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const [incData, status] = await Promise.all([
        fetchIncidents(),
        fetchMemoryStatus().catch(() => null),
      ]);
      setIncidents(incData);
      setMemStatus(status);
    } catch (err: any) {
      setError(err.message);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    load();
  }, [load]);

  const storedIncidents = incidents.filter((i) => i.memory_stored && i.status === "resolved");

  return (
    <Layout currentPage="memory" onNavigate={onNavigate}>
      <PageHeader
        title="Organizational Memory"
        subtitle="Knowledge learned from resolved incidents, stored in Hindsight"
        actions={
          <Button variant="secondary" size="sm" onClick={load}>
            <RefreshCw className="h-4 w-4" />
            Refresh
          </Button>
        }
      />

      <div className="p-6 space-y-5">
        {error && <div className="rounded-lg border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-700">{error}</div>}

        {/* Memory status */}
        <Card className="overflow-hidden">
          <div className="border-b border-slate-200 bg-slate-50 px-5 py-3">
            <h2 className="text-sm font-semibold text-slate-700 flex items-center gap-2">
              <Database className="h-4 w-4" />
              Hindsight Memory Status
            </h2>
          </div>
          <div className="p-5">
            {loading ? (
              <div className="flex items-center gap-2 text-slate-400"><Spinner size="sm" /> Checking status...</div>
            ) : memStatus ? (
              <div className="grid grid-cols-2 gap-4 sm:grid-cols-4">
                <StatBox
                  label="Connection"
                  value={memStatus.available ? "Connected" : "Unavailable"}
                  icon={memStatus.available ? <CheckCircle2 className="h-4 w-4 text-emerald-500" /> : <AlertCircle className="h-4 w-4 text-red-500" />}
                  positive={memStatus.available}
                />
                <StatBox
                  label="Bank ID"
                  value={memStatus.bankId || "—"}
                  icon={<Database className="h-4 w-4 text-slate-400" />}
                />
                <StatBox
                  label="Stored Memories"
                  value={String(memStatus.storedMemories)}
                  icon={<Brain className="h-4 w-4 text-blue-500" />}
                />
                <StatBox
                  label="LLM Configured"
                  value={memStatus.llmConfigured ? memStatus.llmModel || "Yes" : "No"}
                  icon={memStatus.llmConfigured ? <CheckCircle2 className="h-4 w-4 text-emerald-500" /> : <AlertCircle className="h-4 w-4 text-red-500" />}
                  positive={memStatus.llmConfigured}
                />
              </div>
            ) : (
              <p className="text-sm text-slate-400">Unable to check memory status.</p>
            )}
            {memStatus && !memStatus.available && (
              <div className="mt-4 flex items-start gap-3 rounded-lg border border-amber-200 bg-amber-50 px-4 py-3">
                <AlertCircle className="h-5 w-5 text-amber-500 mt-0.5 flex-shrink-0" />
                <div className="text-sm text-amber-700">
                  <p className="font-medium">Organizational memory unavailable.</p>
                  <p className="mt-0.5">{memStatus.error || "Configure Hindsight in Settings to enable memory storage and recall."}</p>
                  <button onClick={() => onNavigate("settings")} className="mt-2 text-xs font-medium text-amber-800 underline">
                    Go to Settings →
                  </button>
                </div>
              </div>
            )}
          </div>
        </Card>

        {/* Stored memories list */}
        <div>
          <h2 className="mb-3 text-sm font-semibold text-slate-700 uppercase tracking-wide">
            Learned Incidents ({storedIncidents.length})
          </h2>
          {loading ? (
            <div className="flex items-center justify-center py-16 text-slate-400"><Spinner size="lg" /></div>
          ) : storedIncidents.length === 0 ? (
            <Card className="py-12">
              <EmptyState
                icon={<Brain className="h-7 w-7" />}
                title="No organizational memory yet"
                message="Resolve your first incident to start teaching RecallOps. Resolved incidents with stored lessons will appear here."
              />
            </Card>
          ) : (
            <div className="space-y-3">
              {storedIncidents.map((incident) => (
                <Card key={incident.id} onClick={() => onOpenIncident(incident.id)} className="p-5">
                  <div className="flex items-start justify-between gap-4">
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center gap-2 mb-2">
                        <Badge className="bg-blue-50 text-blue-700 border border-blue-200">
                          <Brain className="h-3 w-3" />
                          Stored in Hindsight
                        </Badge>
                        <SeverityBadge severity={incident.severity} />
                        <span className="text-xs text-slate-400">{incident.service}</span>
                      </div>
                      <h3 className="text-sm font-medium text-slate-900">{incident.title}</h3>
                      <div className="mt-3 grid grid-cols-1 sm:grid-cols-2 gap-3 text-xs">
                        {incident.root_cause && (
                          <div>
                            <p className="font-medium text-slate-400 uppercase tracking-wide mb-0.5">Root Cause</p>
                            <p className="text-slate-700">{incident.root_cause}</p>
                          </div>
                        )}
                        {incident.successful_fix && (
                          <div>
                            <p className="font-medium text-slate-400 uppercase tracking-wide mb-0.5">Successful Fix</p>
                            <p className="text-slate-700">{incident.successful_fix}</p>
                          </div>
                        )}
                      </div>
                      {incident.lessons_learned && (
                        <div className="mt-3 rounded-lg border border-blue-200 bg-blue-50/50 p-3">
                          <p className="text-xs font-medium text-blue-700 uppercase tracking-wide mb-1">Lesson Learned</p>
                          <p className="text-sm text-slate-700">{incident.lessons_learned}</p>
                        </div>
                      )}
                      <p className="mt-2 text-xs text-slate-400">{formatDate(incident.resolved_at || incident.created_at)}</p>
                    </div>
                  </div>
                </Card>
              ))}
            </div>
          )}
        </div>
      </div>
    </Layout>
  );
}

function StatBox({ label, value, icon, positive }: { label: string; value: string; icon: React.ReactNode; positive?: boolean }) {
  return (
    <div>
      <div className="flex items-center gap-1.5 mb-1">
        {icon}
        <p className="text-xs font-medium text-slate-400 uppercase tracking-wide">{label}</p>
      </div>
      <p className={`text-sm font-medium truncate ${positive === true ? "text-emerald-700" : positive === false ? "text-red-700" : "text-slate-700"}`}>
        {value}
      </p>
    </div>
  );
}
