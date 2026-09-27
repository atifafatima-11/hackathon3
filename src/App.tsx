import { useState } from "react";
import { DashboardPage } from "@/pages/DashboardPage";
import { ActiveIncidentsPage } from "@/pages/ActiveIncidentsPage";
import { CreateIncidentPage } from "@/pages/CreateIncidentPage";
import { IncidentDetailPage } from "@/pages/IncidentDetailPage";
import { HistoryPage } from "@/pages/HistoryPage";
import { MemoryPage } from "@/pages/MemoryPage";
import { AnalyticsPage } from "@/pages/AnalyticsPage";
import { SettingsPage } from "@/pages/SettingsPage";
import type { PageId } from "@/types";

function App() {
  const [page, setPage] = useState<PageId>("dashboard");
  const [incidentId, setIncidentId] = useState<string | null>(null);
  const [prevPage, setPrevPage] = useState<PageId>("dashboard");

  const navigate = (p: PageId) => {
    if (p !== "incident-detail") setPrevPage(p);
    setPage(p);
  };

  const openIncident = (id: string) => {
    setIncidentId(id);
    setPage("incident-detail");
  };

  const backFromIncident = () => {
    setPage(prevPage);
  };

  switch (page) {
    case "dashboard":
      return <DashboardPage onNavigate={navigate} onOpenIncident={openIncident} />;
    case "active":
      return <ActiveIncidentsPage onNavigate={navigate} onOpenIncident={openIncident} />;
    case "create":
      return <CreateIncidentPage onNavigate={navigate} onOpenIncident={openIncident} />;
    case "history":
      return <HistoryPage onNavigate={navigate} onOpenIncident={openIncident} />;
    case "memory":
      return <MemoryPage onNavigate={navigate} onOpenIncident={openIncident} />;
    case "analytics":
      return <AnalyticsPage onNavigate={navigate} />;
    case "settings":
      return <SettingsPage onNavigate={navigate} />;
    case "incident-detail":
      return incidentId ? (
        <IncidentDetailPage incidentId={incidentId} onNavigate={navigate} onBack={backFromIncident} />
      ) : (
        <DashboardPage onNavigate={navigate} onOpenIncident={openIncident} />
      );
    default:
      return <DashboardPage onNavigate={navigate} onOpenIncident={openIncident} />;
  }
}

export default App;
