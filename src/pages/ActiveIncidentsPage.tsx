import { useState, useEffect, useCallback } from "react";
import { Plus, AlertTriangle, Clock, Activity, Brain, ArrowRight } from "lucide-react";
import { Layout, PageHeader } from "@/components/Layout";
import { Card, SeverityBadge, StatusBadge, Button, Spinner, EmptyState } from "@/components/ui";
import { fetchIncidents } from "@/api";
import type { Incident, PageId } from "@/types";
import { formatTimeAgo } from "@/types";

export function ActiveIncidentsPage({
  onNavigate,
  onOpenIncident,
}: {
  onNavigate: (page: PageId) => void;
  onOpenIncident: (id: string) => void;
}) {
  const [incidents, setIncidents] = useState<Incident[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const load = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const data = await fetchIncidents();
      setIncidents(data);
    } catch (err: any) {
      setError(err.message);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    load();
  }, [load]);

  const activeIncidents = incidents.filter((i) => i.status === "active" || i.status === "analyzing");

  return (
    <Layout currentPage="active" onNavigate={onNavigate}>
      <PageHeader
        title="Active Incidents"
        subtitle={`${activeIncidents.length} incident${activeIncidents.length !== 1 ? "s" : ""} requiring attention`}
        actions={
          <Button size="sm" onClick={() => onNavigate("create")}>
            <Plus className="h-4 w-4" />
            New Incident
          </Button>
        }
      />

      <div className="p-6">
        {error && <div className="mb-4 rounded-lg border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-700">{error}</div>}

        {loading ? (
          <div className="flex items-center justify-center py-32 text-slate-400">
            <Spinner size="lg" />
          </div>
        ) : activeIncidents.length === 0 ? (
          <Card className="py-12">
            <EmptyState
              icon={<AlertTriangle className="h-7 w-7" />}
              title="No active incidents"
              message="Your incident queue is clear. Create a new incident to start an investigation."
              action={
                <Button size="sm" onClick={() => onNavigate("create")}>
                  <Plus className="h-4 w-4" />
                  Create Incident
                </Button>
              }
            />
          </Card>
        ) : (
          <div className="space-y-3">
            {activeIncidents.map((incident) => (
              <Card key={incident.id} onClick={() => onOpenIncident(incident.id)} className="p-4">
                <div className="flex items-start justify-between gap-4">
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2 mb-1.5">
                      <SeverityBadge severity={incident.severity} />
                      <StatusBadge status={incident.status} />
                      <span className="text-xs text-slate-400">{incident.service}</span>
                    </div>
                    <h3 className="text-sm font-medium text-slate-900">{incident.title}</h3>
                    {incident.description && (
                      <p className="mt-1 text-xs text-slate-500 line-clamp-2">{incident.description}</p>
                    )}
                    <div className="mt-2 flex items-center gap-3">
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
                  <ArrowRight className="h-4 w-4 text-slate-300 flex-shrink-0" />
                </div>
              </Card>
            ))}
          </div>
        )}
      </div>
    </Layout>
  );
}
