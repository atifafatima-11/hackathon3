import { useState } from "react";
import { ArrowLeft, Send, FlaskConical, Zap } from "lucide-react";
import { Layout, PageHeader } from "@/components/Layout";
import { Button, Card, Spinner, ErrorBanner } from "@/components/ui";
import { createIncident, loadSimilarIncident } from "@/api";
import type { PageId } from "@/types";

export function CreateIncidentPage({
  onNavigate,
  onOpenIncident,
}: {
  onNavigate: (page: PageId) => void;
  onOpenIncident: (id: string) => void;
}) {
  const [form, setForm] = useState({
    title: "",
    service: "",
    severity: "SEV-2",
    description: "",
    logs: "",
    error_message: "",
    recent_changes: "",
    affected_component: "",
  });
  const [submitting, setSubmitting] = useState(false);
  const [loadingDemo, setLoadingDemo] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const update = (field: string, value: string) => {
    setForm((prev) => ({ ...prev, [field]: value }));
  };

  const handleSubmit = async () => {
    if (!form.title.trim() || !form.service.trim()) {
      setError("Title and service are required.");
      return;
    }
    setSubmitting(true);
    setError(null);
    try {
      const incident = await createIncident({
        title: form.title.trim(),
        service: form.service.trim(),
        severity: form.severity,
        description: form.description.trim() || undefined,
        logs: form.logs.trim() || undefined,
        error_message: form.error_message.trim() || undefined,
        recent_changes: form.recent_changes.trim() || undefined,
        affected_component: form.affected_component.trim() || undefined,
      });
      onOpenIncident(incident.id);
    } catch (err: any) {
      setError(err.message);
    } finally {
      setSubmitting(false);
    }
  };

  const handleLoadDemo = async () => {
    setLoadingDemo(true);
    setError(null);
    try {
      const incident = await loadSimilarIncident();
      onOpenIncident(incident.id);
    } catch (err: any) {
      setError(err.message);
    } finally {
      setLoadingDemo(false);
    }
  };

  const inputClass = "w-full rounded-lg border border-slate-300 px-3 py-2 text-sm text-slate-900 placeholder:text-slate-400 focus:border-slate-400 focus:ring-2 focus:ring-slate-200 outline-none transition-all";
  const labelClass = "block text-sm font-medium text-slate-700 mb-1.5";

  return (
    <Layout currentPage="active" onNavigate={onNavigate}>
      <PageHeader
        title="Create Incident"
        subtitle="Document a production incident for AI analysis"
        actions={
          <Button variant="ghost" size="sm" onClick={() => onNavigate("active")}>
            <ArrowLeft className="h-4 w-4" />
            Back
          </Button>
        }
      />

      <div className="max-w-3xl p-6">
        {error && <div className="mb-4"><ErrorBanner message={error} onDismiss={() => setError(null)} /></div>}

        <Card className="p-6">
          <div className="grid grid-cols-1 gap-5 sm:grid-cols-2">
            <div className="sm:col-span-2">
              <label className={labelClass}>Title <span className="text-red-500">*</span></label>
              <input
                className={inputClass}
                placeholder="e.g., Payment API returning HTTP 500 errors"
                value={form.title}
                onChange={(e) => update("title", e.target.value)}
              />
            </div>

            <div>
              <label className={labelClass}>Service <span className="text-red-500">*</span></label>
              <input
                className={inputClass}
                placeholder="e.g., payment-service"
                value={form.service}
                onChange={(e) => update("service", e.target.value)}
              />
            </div>

            <div>
              <label className={labelClass}>Severity</label>
              <select
                className={inputClass}
                value={form.severity}
                onChange={(e) => update("severity", e.target.value)}
              >
                <option value="SEV-1">SEV-1 — Critical</option>
                <option value="SEV-2">SEV-2 — High</option>
                <option value="SEV-3">SEV-3 — Medium</option>
                <option value="SEV-4">SEV-4 — Low</option>
              </select>
            </div>

            <div className="sm:col-span-2">
              <label className={labelClass}>Description</label>
              <textarea
                className={`${inputClass} min-h-[80px]`}
                placeholder="What is happening? What's the user-visible impact?"
                value={form.description}
                onChange={(e) => update("description", e.target.value)}
              />
            </div>

            <div className="sm:col-span-2">
              <label className={labelClass}>Error Message</label>
              <textarea
                className={`${inputClass} min-h-[60px] font-mono text-xs`}
                placeholder="e.g., Unable to acquire database connection. Connection pool exhausted."
                value={form.error_message}
                onChange={(e) => update("error_message", e.target.value)}
              />
            </div>

            <div className="sm:col-span-2">
              <label className={labelClass}>Logs</label>
              <textarea
                className={`${inputClass} min-h-[120px] font-mono text-xs`}
                placeholder={"Paste relevant log lines here...\ne.g., ERROR [payment-service] pool: Connection pool exhausted"}
                value={form.logs}
                onChange={(e) => update("logs", e.target.value)}
              />
            </div>

            <div className="sm:col-span-2">
              <label className={labelClass}>Recent Changes</label>
              <textarea
                className={`${inputClass} min-h-[60px]`}
                placeholder="Any deployments, config changes, or infrastructure events around the time of the incident?"
                value={form.recent_changes}
                onChange={(e) => update("recent_changes", e.target.value)}
              />
            </div>

            <div className="sm:col-span-2">
              <label className={labelClass}>Affected Component</label>
              <input
                className={inputClass}
                placeholder="e.g., database-connection-pool, payment-gateway"
                value={form.affected_component}
                onChange={(e) => update("affected_component", e.target.value)}
              />
            </div>
          </div>

          <div className="mt-6 flex items-center justify-between border-t border-slate-200 pt-5">
            <Button variant="ghost" size="md" onClick={handleLoadDemo} disabled={loadingDemo || submitting}>
              {loadingDemo ? <Spinner size="sm" /> : <Zap className="h-4 w-4" />}
              Load Demo Incident
            </Button>
            <Button size="md" onClick={handleSubmit} disabled={submitting || loadingDemo}>
              {submitting ? <Spinner size="sm" /> : <Send className="h-4 w-4" />}
              Create Incident
            </Button>
          </div>
        </Card>

        <div className="mt-4 flex items-start gap-3 rounded-lg border border-slate-200 bg-slate-50 px-4 py-3">
          <FlaskConical className="h-4 w-4 text-slate-400 mt-0.5 flex-shrink-0" />
          <p className="text-xs text-slate-500">
            After creating the incident, click "Analyze Incident" to have RecallOps search organizational memory
            via Hindsight and generate an AI-powered investigation plan.
          </p>
        </div>
      </div>
    </Layout>
  );
}
