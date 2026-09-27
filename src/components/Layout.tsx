import { useState, type ReactNode } from "react";
import {
  LayoutDashboard,
  AlertTriangle,
  History,
  Brain,
  BarChart3,
  Settings as SettingsIcon,
  Shield,
  Menu,
  X,
} from "lucide-react";
import type { PageId } from "@/types";

const NAV_ITEMS: { id: PageId; label: string; icon: ReactNode }[] = [
  { id: "dashboard", label: "Dashboard", icon: <LayoutDashboard className="h-4.5 w-4.5" /> },
  { id: "active", label: "Active Incidents", icon: <AlertTriangle className="h-4.5 w-4.5" /> },
  { id: "history", label: "Incident History", icon: <History className="h-4.5 w-4.5" /> },
  { id: "memory", label: "Organizational Memory", icon: <Brain className="h-4.5 w-4.5" /> },
  { id: "analytics", label: "Analytics", icon: <BarChart3 className="h-4.5 w-4.5" /> },
  { id: "settings", label: "Settings", icon: <SettingsIcon className="h-4.5 w-4.5" /> },
];

export function Layout({
  currentPage,
  onNavigate,
  children,
}: {
  currentPage: PageId;
  onNavigate: (page: PageId) => void;
  children: ReactNode;
}) {
  const [mobileOpen, setMobileOpen] = useState(false);

  const handleNav = (page: PageId) => {
    onNavigate(page);
    setMobileOpen(false);
  };

  return (
    <div className="min-h-screen bg-slate-50">
      {/* Mobile header */}
      <div className="lg:hidden sticky top-0 z-30 flex items-center justify-between border-b border-slate-200 bg-white px-4 py-3">
        <div className="flex items-center gap-2">
          <Shield className="h-6 w-6 text-slate-900" />
          <span className="font-semibold text-slate-900">RecallOps</span>
        </div>
        <button
          onClick={() => setMobileOpen(!mobileOpen)}
          className="rounded-md p-1.5 text-slate-600 hover:bg-slate-100"
        >
          {mobileOpen ? <X className="h-5 w-5" /> : <Menu className="h-5 w-5" />}
        </button>
      </div>

      {/* Mobile nav overlay */}
      {mobileOpen && (
        <div className="lg:hidden fixed inset-0 z-20 bg-black/30" onClick={() => setMobileOpen(false)} />
      )}

      {/* Sidebar */}
      <aside
        className={`fixed top-0 left-0 z-30 h-full w-60 transform border-r border-slate-200 bg-white transition-transform lg:translate-x-0 ${
          mobileOpen ? "translate-x-0" : "-translate-x-full"
        }`}
      >
        <div className="flex h-16 items-center gap-2.5 border-b border-slate-200 px-5">
          <div className="flex h-8 w-8 items-center justify-center rounded-lg bg-slate-900">
            <Shield className="h-5 w-5 text-white" />
          </div>
          <div>
            <div className="text-sm font-bold text-slate-900">RecallOps</div>
            <div className="text-[10px] text-slate-400 tracking-wide uppercase">Incident Response</div>
          </div>
        </div>

        <nav className="flex flex-col gap-0.5 p-3">
          {NAV_ITEMS.map((item) => {
            const active = currentPage === item.id;
            return (
              <button
                key={item.id}
                onClick={() => handleNav(item.id)}
                className={`flex items-center gap-3 rounded-lg px-3 py-2 text-sm font-medium transition-all ${
                  active
                    ? "bg-slate-900 text-white"
                    : "text-slate-600 hover:bg-slate-100"
                }`}
              >
                {item.icon}
                {item.label}
              </button>
            );
          })}
        </nav>

        <div className="absolute bottom-0 left-0 right-0 border-t border-slate-200 p-4">
          <div className="flex items-center gap-2 text-xs text-slate-400">
            <Brain className="h-3.5 w-3.5" />
            <span>Powered by Hindsight Memory</span>
          </div>
        </div>
      </aside>

      {/* Main content */}
      <div className="lg:pl-60">
        <main className="min-h-screen">{children}</main>
      </div>
    </div>
  );
}

export function PageHeader({
  title,
  subtitle,
  actions,
}: {
  title: string;
  subtitle?: string;
  actions?: ReactNode;
}) {
  return (
    <div className="flex flex-col gap-3 border-b border-slate-200 bg-white px-6 py-5 sm:flex-row sm:items-center sm:justify-between">
      <div>
        <h1 className="text-lg font-semibold text-slate-900">{title}</h1>
        {subtitle && <p className="mt-0.5 text-sm text-slate-500">{subtitle}</p>}
      </div>
      {actions && <div className="flex items-center gap-2">{actions}</div>}
    </div>
  );
}
