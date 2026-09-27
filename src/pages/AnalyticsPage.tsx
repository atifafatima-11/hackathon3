import { useState, useEffect, useCallback } from "react";
import { BarChart3, TrendingUp, AlertTriangle, Brain } from "lucide-react";
import { Layout, PageHeader } from "@/components/Layout";
import { Card, Spinner, EmptyState } from "@/components/ui";
import { fetchIncidents } from "@/api";
import type { Incident, PageId } from "@/types";

export function AnalyticsPage({ onNavigate }: { onNavigate: (page: PageId) => void }) {
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

  const byService = groupBy(incidents, "service");
  const bySeverity = groupBy(incidents, "severity");
  const resolved = incidents.filter((i) => i.status === "resolved");
  const active = incidents.filter((i) => i.status !== "resolved");
  const storedMemories = incidents.filter((i) => i.memory_stored).length;

  // Root causes
  const rootCauses: { cause: string; count: number }[] = [];
  const causeMap = new Map<string, number>();
  resolved.forEach((i) => {
    if (i.root_cause) {
      const key = i.root_cause.slice(0, 80);
      causeMap.set(key, (causeMap.get(key) || 0) + 1);
    }
  });
  causeMap.forEach((count, cause) => rootCauses.push({ cause, count }));
  rootCauses.sort((a, b) => b.count - a.count);

  const maxServiceCount = Math.max(...Object.values(byService).map((v) => v.length), 1);
  const maxSeverityCount = Math.max(...Object.values(bySeverity).map((v) => v.length), 1);

  if (loading) {
    return (
      <Layout currentPage="analytics" onNavigate={onNavigate}>
        <div className="flex items-center justify-center py-32 text-slate-400"><Spinner size="lg" /></div>
      </Layout>
    );
  }

  if (incidents.length === 0) {
    return (
      <Layout currentPage="analytics" onNavigate={onNavigate}>
        <PageHeader title="Analytics" subtitle="Insights from your incident history" />
        <div className="p-6">
          <Card className="py-12">
            <EmptyState
              icon={<BarChart3 className="h-7 w-7" />}
              title="No data to analyze yet"
              message="Create and resolve incidents to see analytics here. Seed demo data to get started quickly."
            />
          </Card>
        </div>
      </Layout>
    );
  }

  return (
    <Layout currentPage="analytics" onNavigate={onNavigate}>
      <PageHeader title="Analytics" subtitle="Insights from your incident history" />

      <div className="p-6 space-y-5">
        {error && <div className="rounded-lg border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-700">{error}</div>}

        {/* Summary stats */}
        <div className="grid grid-cols-2 gap-4 lg:grid-cols-4">
          <SummaryCard label="Total Incidents" value={incidents.length} icon={<AlertTriangle className="h-5 w-5" />} color="slate" />
          <SummaryCard label="Active" value={active.length} icon={<TrendingUp className="h-5 w-5" />} color="red" />
          <SummaryCard label="Resolved" value={resolved.length} icon={<TrendingUp className="h-5 w-5" />} color="emerald" />
          <SummaryCard label="Org Memories" value={storedMemories} icon={<Brain className="h-5 w-5" />} color="blue" />
        </div>

        {/* Charts row */}
        <div className="grid grid-cols-1 gap-4 lg:grid-cols-2">
          {/* Incidents by service */}
          <Card className="p-5">
            <h2 className="text-sm font-semibold text-slate-700 mb-4">Incidents by Service</h2>
            <div className="space-y-3">
              {Object.entries(byService)
                .sort(([, a], [, b]) => b.length - a.length)
                .map(([service, items]) => (
                  <div key={service}>
                    <div className="flex items-center justify-between mb-1">
                      <span className="text-sm text-slate-700">{service}</span>
                      <span className="text-xs text-slate-400">{items.length}</span>
                    </div>
                    <div className="h-2 rounded-full bg-slate-100 overflow-hidden">
                      <div
                        className="h-full rounded-full bg-slate-700 transition-all"
                        style={{ width: `${(items.length / maxServiceCount) * 100}%` }}
                      />
                    </div>
                  </div>
                ))}
            </div>
          </Card>

          {/* Incidents by severity */}
          <Card className="p-5">
            <h2 className="text-sm font-semibold text-slate-700 mb-4">Incidents by Severity</h2>
            <div className="space-y-3">
              {["SEV-1", "SEV-2", "SEV-3", "SEV-4"].map((sev) => {
                const items = bySeverity[sev] || [];
                const colors: Record<string, string> = {
                  "SEV-1": "bg-red-500",
                  "SEV-2": "bg-orange-500",
                  "SEV-3": "bg-amber-500",
                  "SEV-4": "bg-blue-500",
                };
                return (
                  <div key={sev}>
                    <div className="flex items-center justify-between mb-1">
                      <span className="text-sm text-slate-700">{sev}</span>
                      <span className="text-xs text-slate-400">{items.length}</span>
                    </div>
                    <div className="h-2 rounded-full bg-slate-100 overflow-hidden">
                      <div
                        className={`h-full rounded-full ${colors[sev]} transition-all`}
                        style={{ width: `${(items.length / maxSeverityCount) * 100}%` }}
                      />
                    </div>
                  </div>
                );
              })}
            </div>
          </Card>
        </div>

        {/* Resolved vs Active */}
        <Card className="p-5">
          <h2 className="text-sm font-semibold text-slate-700 mb-4">Resolved vs Active</h2>
          <div className="flex items-center gap-4">
            <div className="flex-1">
              <div className="flex h-6 rounded-full overflow-hidden">
                <div className="bg-emerald-500 transition-all" style={{ width: `${(resolved.length / incidents.length) * 100}%` }} />
                <div className="bg-red-500 transition-all" style={{ width: `${(active.length / incidents.length) * 100}%` }} />
              </div>
            </div>
            <div className="flex items-center gap-4 text-sm">
              <span className="flex items-center gap-1.5">
                <span className="h-2.5 w-2.5 rounded-full bg-emerald-500" />
                <span className="text-slate-700">Resolved {resolved.length}</span>
              </span>
              <span className="flex items-center gap-1.5">
                <span className="h-2.5 w-2.5 rounded-full bg-red-500" />
                <span className="text-slate-700">Active {active.length}</span>
              </span>
            </div>
          </div>
        </Card>

        {/* Common root causes */}
        {rootCauses.length > 0 && (
          <Card className="p-5">
            <h2 className="text-sm font-semibold text-slate-700 mb-4">Common Root Causes</h2>
            <div className="space-y-2">
              {rootCauses.slice(0, 8).map((rc, i) => (
                <div key={i} className="flex items-start gap-3 rounded-lg border border-slate-200 bg-slate-50 p-3">
                  <span className="flex h-6 w-6 flex-shrink-0 items-center justify-center rounded-full bg-slate-200 text-xs font-medium text-slate-600">
                    {i + 1}
                  </span>
                  <div className="flex-1 min-w-0">
                    <p className="text-sm text-slate-700">{rc.cause}</p>
                    <p className="text-xs text-slate-400 mt-0.5">
                      {rc.count} incident{rc.count !== 1 ? "s" : ""}
                    </p>
                  </div>
                </div>
              ))}
            </div>
          </Card>
        )}

        {/* Frequently affected services */}
        <Card className="p-5">
          <h2 className="text-sm font-semibold text-slate-700 mb-4">Frequently Affected Services</h2>
          <div className="overflow-hidden rounded-lg border border-slate-200">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b border-slate-200 bg-slate-50 text-left">
                  <th className="px-4 py-2.5 font-medium text-slate-600 text-xs uppercase tracking-wide">Service</th>
                  <th className="px-4 py-2.5 font-medium text-slate-600 text-xs uppercase tracking-wide">Total</th>
                  <th className="px-4 py-2.5 font-medium text-slate-600 text-xs uppercase tracking-wide">Resolved</th>
                  <th className="px-4 py-2.5 font-medium text-slate-600 text-xs uppercase tracking-wide">Memories</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100">
                {Object.entries(byService)
                  .sort(([, a], [, b]) => b.length - a.length)
                  .map(([service, items]) => {
                    const res = items.filter((i) => i.status === "resolved").length;
                    const mem = items.filter((i) => i.memory_stored).length;
                    return (
                      <tr key={service}>
                        <td className="px-4 py-2.5 font-medium text-slate-900">{service}</td>
                        <td className="px-4 py-2.5 text-slate-600">{items.length}</td>
                        <td className="px-4 py-2.5 text-slate-600">{res}</td>
                        <td className="px-4 py-2.5">
                          <span className="inline-flex items-center gap-1 text-blue-600">
                            <Brain className="h-3 w-3" />
                            {mem}
                          </span>
                        </td>
                      </tr>
                    );
                  })}
              </tbody>
            </table>
          </div>
        </Card>

        <p className="text-xs text-slate-400 text-center">
          Analytics are based on {incidents.length} recorded incident{incidents.length !== 1 ? "s" : ""}. No predictive accuracy is claimed.
        </p>
      </div>
    </Layout>
  );
}

function groupBy(items: Incident[], key: keyof Incident): Record<string, Incident[]> {
  const groups: Record<string, Incident[]> = {};
  items.forEach((item) => {
    const val = String(item[key] || "unknown");
    if (!groups[val]) groups[val] = [];
    groups[val].push(item);
  });
  return groups;
}

function SummaryCard({ label, value, icon, color }: { label: string; value: number; icon: React.ReactNode; color: string }) {
  const colors: Record<string, string> = {
    slate: "bg-slate-100 text-slate-600",
    red: "bg-red-50 text-red-600",
    emerald: "bg-emerald-50 text-emerald-600",
    blue: "bg-blue-50 text-blue-600",
  };
  return (
    <Card className="p-4">
      <div className="flex items-center justify-between">
        <div>
          <p className="text-xs font-medium text-slate-400 uppercase tracking-wide">{label}</p>
          <p className="mt-1.5 text-2xl font-bold text-slate-900">{value}</p>
        </div>
        <div className={`flex h-9 w-9 items-center justify-center rounded-lg ${colors[color]}`}>{icon}</div>
      </div>
    </Card>
  );
}
