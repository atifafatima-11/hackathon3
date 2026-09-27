import { useState, useEffect, useCallback } from "react";
import { History, CheckCircle2, Brain, ArrowRight, Clock, Search } from "lucide-react";
import { Layout, PageHeader } from "@/components/Layout";
import { Card, SeverityBadge, StatusBadge, Spinner, EmptyState, Badge } from "@/components/ui";
import { fetchIncidents } from "@/api";
import type { Incident, PageId } from "@/types";
import { formatDate, formatTimeAgo } from "@/types";

export function HistoryPage({
  onNavigate,
  onOpenIncident,
}: {
  onNavigate: (page: PageId) => void;
  onOpenIncident: (id: string) => void;
}) {
  const [incidents, setIncidents] = useState<Incident[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [search, setSearch] = useState("");
  const [serviceFilter, setServiceFilter] = useState("");

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

  const resolved = incidents.filter((i) => i.status === "resolved");
  const services = [...new Set(resolved.map((i) => i.service))].sort();

  const filtered = resolved.filter((i) => {
    if (serviceFilter && i.service !== serviceFilter) return false;
    if (search) {
      const q = search.toLowerCase();
      return (
        i.title.toLowerCase().includes(q) ||
        i.service.toLowerCase().includes(q) ||
        (i.root_cause || "").toLowerCase().includes(q)
      );
    }
    return true;
  });

  return (
    <Layout currentPage="history" onNavigate={onNavigate}>
      <PageHeader
        title="Incident History"
        subtitle={`${resolved.length} resolved incident${resolved.length !== 1 ? "s" : ""}`}
      />

      <div className="p-6">
        {error && <div className="mb-4 rounded-lg border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-700">{error}</div>}

        {loading ? (
          <div className="flex items-center justify-center py-32 text-slate-400">
            <Spinner size="lg" />
          </div>
        ) : resolved.length === 0 ? (
          <Card className="py-12">
            <EmptyState
              icon={<History className="h-7 w-7" />}
              title="No resolved incidents yet"
              message="Resolved incidents will appear here with their root cause, resolution, and lessons learned."
            />
          </Card>
        ) : (
          <>
            {/* Filters */}
            <div className="mb-4 flex flex-col sm:flex-row gap-3">
              <div className="relative flex-1">
                <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-slate-400" />
                <input
                  className="w-full rounded-lg border border-slate-300 pl-9 pr-3 py-2 text-sm text-slate-900 placeholder:text-slate-400 focus:border-slate-400 focus:ring-2 focus:ring-slate-200 outline-none"
                  placeholder="Search by title, service, or root cause..."
                  value={search}
                  onChange={(e) => setSearch(e.target.value)}
                />
              </div>
              <select
                className="rounded-lg border border-slate-300 px-3 py-2 text-sm text-slate-900 focus:border-slate-400 focus:ring-2 focus:ring-slate-200 outline-none"
                value={serviceFilter}
                onChange={(e) => setServiceFilter(e.target.value)}
              >
                <option value="">All services</option>
                {services.map((s) => (
                  <option key={s} value={s}>{s}</option>
                ))}
              </select>
            </div>

            {/* Table */}
            <Card className="overflow-hidden">
              <table className="w-full text-sm">
                <thead>
                  <tr className="border-b border-slate-200 bg-slate-50 text-left">
                    <th className="px-4 py-3 font-medium text-slate-600 text-xs uppercase tracking-wide">Incident</th>
                    <th className="px-4 py-3 font-medium text-slate-600 text-xs uppercase tracking-wide hidden sm:table-cell">Service</th>
                    <th className="px-4 py-3 font-medium text-slate-600 text-xs uppercase tracking-wide hidden md:table-cell">Severity</th>
                    <th className="px-4 py-3 font-medium text-slate-600 text-xs uppercase tracking-wide hidden lg:table-cell">Root Cause</th>
                    <th className="px-4 py-3 font-medium text-slate-600 text-xs uppercase tracking-wide hidden lg:table-cell">Date</th>
                    <th className="px-4 py-3"></th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100">
                  {filtered.map((incident) => (
                    <tr
                      key={incident.id}
                      onClick={() => onOpenIncident(incident.id)}
                      className="cursor-pointer hover:bg-slate-50 transition-colors"
                    >
                      <td className="px-4 py-3">
                        <div className="flex items-center gap-2">
                          <CheckCircle2 className="h-4 w-4 text-emerald-500 flex-shrink-0" />
                          <div className="min-w-0">
                            <p className="font-medium text-slate-900 truncate">{incident.title}</p>
                            <div className="flex items-center gap-2 mt-0.5">
                              <span className="text-xs text-slate-400 sm:hidden">{incident.service}</span>
                              {incident.memory_stored && (
                                <Badge className="bg-blue-50 text-blue-600 border border-blue-200">
                                  <Brain className="h-2.5 w-2.5" />
                                  Memory
                                </Badge>
                              )}
                            </div>
                          </div>
                        </div>
                      </td>
                      <td className="px-4 py-3 text-slate-600 hidden sm:table-cell">{incident.service}</td>
                      <td className="px-4 py-3 hidden md:table-cell">
                        <SeverityBadge severity={incident.severity} />
                      </td>
                      <td className="px-4 py-3 text-slate-600 hidden lg:table-cell max-w-xs truncate">
                        {incident.root_cause || "—"}
                      </td>
                      <td className="px-4 py-3 text-slate-400 text-xs hidden lg:table-cell">
                        {formatTimeAgo(incident.resolved_at || incident.created_at)}
                      </td>
                      <td className="px-4 py-3 text-right">
                        <ArrowRight className="h-4 w-4 text-slate-300" />
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
              {filtered.length === 0 && (
                <div className="py-8 text-center text-sm text-slate-400">No incidents match your filters.</div>
              )}
            </Card>
          </>
        )}
      </div>
    </Layout>
  );
}
