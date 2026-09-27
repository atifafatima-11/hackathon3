import { useState, useEffect, useCallback } from "react";
import { Save, Brain, Cpu, Server, CheckCircle2, AlertCircle, ExternalLink } from "lucide-react";
import { Layout, PageHeader } from "@/components/Layout";
import { Card, Button, Spinner, ErrorBanner } from "@/components/ui";
import { fetchSettings, updateSettings } from "@/api";
import type { PageId, SettingsResponse } from "@/types";

export function SettingsPage({ onNavigate }: { onNavigate: (page: PageId) => void }) {
  const [settings, setSettings] = useState<SettingsResponse | null>(null);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState(false);

  const [form, setForm] = useState({
    llm_api_key: "",
    llm_base_url: "",
    llm_model: "",
    hindsight_base_url: "",
    hindsight_api_key: "",
    hindsight_bank_id: "",
  });

  const load = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const data = await fetchSettings();
      setSettings(data);
      setForm({
        llm_api_key: "",
        llm_base_url: data.llm_base_url || "",
        llm_model: data.llm_model || "",
        hindsight_base_url: data.hindsight_base_url || "",
        hindsight_api_key: "",
        hindsight_bank_id: data.hindsight_bank_id || "",
      });
    } catch (err: any) {
      setError(err.message);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    load();
  }, [load]);

  const handleSave = async () => {
    setSaving(true);
    setError(null);
    setSuccess(false);
    try {
      const update: Record<string, string> = {};
      if (form.llm_api_key.trim()) update.llm_api_key = form.llm_api_key.trim();
      if (form.llm_base_url.trim()) update.llm_base_url = form.llm_base_url.trim();
      if (form.llm_model.trim()) update.llm_model = form.llm_model.trim();
      if (form.hindsight_base_url.trim()) update.hindsight_base_url = form.hindsight_base_url.trim();
      if (form.hindsight_api_key.trim()) update.hindsight_api_key = form.hindsight_api_key.trim();
      if (form.hindsight_bank_id.trim()) update.hindsight_bank_id = form.hindsight_bank_id.trim();

      const data = await updateSettings(update);
      setSettings(data);
      setForm((prev) => ({ ...prev, llm_api_key: "", hindsight_api_key: "" }));
      setSuccess(true);
      setTimeout(() => setSuccess(false), 5000);
    } catch (err: any) {
      setError(err.message);
    } finally {
      setSaving(false);
    }
  };

  const inputClass = "w-full rounded-lg border border-slate-300 px-3 py-2 text-sm text-slate-900 placeholder:text-slate-400 focus:border-slate-400 focus:ring-2 focus:ring-slate-200 outline-none transition-all";
  const labelClass = "block text-sm font-medium text-slate-700 mb-1.5";

  if (loading) {
    return (
      <Layout currentPage="settings" onNavigate={onNavigate}>
        <div className="flex items-center justify-center py-32 text-slate-400"><Spinner size="lg" /></div>
      </Layout>
    );
  }

  return (
    <Layout currentPage="settings" onNavigate={onNavigate}>
      <PageHeader title="Settings" subtitle="Configure LLM and Hindsight memory integration" />

      <div className="max-w-2xl p-6 space-y-5">
        {error && <ErrorBanner message={error} onDismiss={() => setError(null)} />}

        {success && (
          <div className="flex items-center gap-3 rounded-lg border border-emerald-200 bg-emerald-50 px-4 py-3">
            <CheckCircle2 className="h-5 w-5 text-emerald-500" />
            <p className="text-sm text-emerald-700">Settings saved successfully.</p>
          </div>
        )}

        {/* LLM Configuration */}
        <Card className="overflow-hidden">
          <div className="border-b border-slate-200 bg-slate-50 px-5 py-3">
            <h2 className="text-sm font-semibold text-slate-700 flex items-center gap-2">
              <Cpu className="h-4 w-4" />
              LLM Configuration
            </h2>
          </div>
          <div className="p-5 space-y-4">
            <div>
              <label className={labelClass}>API Key</label>
              <input
                type="password"
                className={inputClass}
                placeholder={settings?.llm_api_key_configured ? "•••••••••••• (configured — enter new to replace)" : "Enter your LLM API key"}
                value={form.llm_api_key}
                onChange={(e) => setForm((p) => ({ ...p, llm_api_key: e.target.value }))}
              />
              <p className="mt-1.5 text-xs text-slate-400">
                Used for OpenAI-compatible chat completions. Supported: Groq, OpenAI, etc.
              </p>
            </div>
            <div>
              <label className={labelClass}>Base URL</label>
              <input
                className={inputClass}
                placeholder="https://api.groq.com/openai/v1"
                value={form.llm_base_url}
                onChange={(e) => setForm((p) => ({ ...p, llm_base_url: e.target.value }))}
              />
            </div>
            <div>
              <label className={labelClass}>Model</label>
              <input
                className={inputClass}
                placeholder="llama-3.3-70b-versatile"
                value={form.llm_model}
                onChange={(e) => setForm((p) => ({ ...p, llm_model: e.target.value }))}
              />
            </div>
          </div>
        </Card>

        {/* Hindsight Configuration */}
        <Card className="overflow-hidden">
          <div className="border-b border-slate-200 bg-slate-50 px-5 py-3">
            <h2 className="text-sm font-semibold text-slate-700 flex items-center gap-2">
              <Brain className="h-4 w-4" />
              Hindsight Memory Configuration
            </h2>
          </div>
          <div className="p-5 space-y-4">
            <div>
              <label className={labelClass}>Hindsight Base URL</label>
              <input
                className={inputClass}
                placeholder="https://your-hindsight-instance.vectorize.io"
                value={form.hindsight_base_url}
                onChange={(e) => setForm((p) => ({ ...p, hindsight_base_url: e.target.value }))}
              />
              <p className="mt-1.5 text-xs text-slate-400">
                The URL of your Hindsight instance (self-hosted or Hindsight Cloud).
              </p>
            </div>
            <div>
              <label className={labelClass}>API Key / Authorization</label>
              <input
                type="password"
                className={inputClass}
                placeholder={settings?.hindsight_api_key_configured ? "•••••••• (configured — enter new to replace)" : "Optional — only if your Hindsight instance requires auth"}
                value={form.hindsight_api_key}
                onChange={(e) => setForm((p) => ({ ...p, hindsight_api_key: e.target.value }))}
              />
              <p className="mt-1.5 text-xs text-slate-400">
                Sent as the <code className="text-xs bg-slate-100 px-1 rounded">authorization</code> header. Leave empty if your instance doesn't require it.
              </p>
            </div>
            <div>
              <label className={labelClass}>Memory Bank ID</label>
              <input
                className={inputClass}
                placeholder="recallops-incident-memory"
                value={form.hindsight_bank_id}
                onChange={(e) => setForm((p) => ({ ...p, hindsight_bank_id: e.target.value }))}
              />
              <p className="mt-1.5 text-xs text-slate-400">
                The Hindsight memory bank where incident memories are stored and recalled from.
              </p>
            </div>
            <div className="flex items-start gap-2 rounded-lg bg-slate-50 px-3 py-2.5 text-xs text-slate-500">
              <Server className="h-3.5 w-3.5 mt-0.5 flex-shrink-0" />
              <p>
                Hindsight is the persistent memory layer for AI agents. RecallOps uses it to store resolved incident
                experience and recall similar past incidents for new investigations.{" "}
                <a href="https://hindsight.vectorize.io/" target="_blank" rel="noreferrer" className="text-blue-600 hover:underline inline-flex items-center gap-0.5">
                  Learn more <ExternalLink className="h-3 w-3" />
                </a>
              </p>
            </div>
          </div>
        </Card>

        {/* Connection status */}
        <Card className="p-5">
          <h2 className="text-sm font-semibold text-slate-700 mb-3">Connection Status</h2>
          <div className="space-y-2">
            <StatusRow
              label="LLM API Key"
              configured={settings?.llm_api_key_configured ?? false}
            />
            <StatusRow
              label="Hindsight API Key"
              configured={settings?.hindsight_api_key_configured ?? false}
              optional
            />
            <StatusRow
              label="Hindsight Base URL"
              configured={!!settings?.hindsight_base_url}
            />
          </div>
        </Card>

        {/* Save button */}
        <div className="flex justify-end">
          <Button size="md" onClick={handleSave} disabled={saving}>
            {saving ? <Spinner size="sm" /> : <Save className="h-4 w-4" />}
            Save Settings
          </Button>
        </div>
      </div>
    </Layout>
  );
}

function StatusRow({ label, configured, optional }: { label: string; configured: boolean; optional?: boolean }) {
  return (
    <div className="flex items-center justify-between text-sm">
      <span className="text-slate-600">{label}</span>
      {configured ? (
        <span className="inline-flex items-center gap-1.5 text-emerald-600">
          <CheckCircle2 className="h-4 w-4" />
          Configured
        </span>
      ) : optional ? (
        <span className="inline-flex items-center gap-1.5 text-slate-400">
          <AlertCircle className="h-4 w-4" />
          Not set (optional)
        </span>
      ) : (
        <span className="inline-flex items-center gap-1.5 text-red-500">
          <AlertCircle className="h-4 w-4" />
          Not configured
        </span>
      )}
    </div>
  );
}
