import type { HourlyRate, Project } from "$lib/modules/projects/contracts";
import { getAssignedBudget } from "$lib/modules/projects/business";
import type { Language } from "$lib/language";

function formatDate(value: Date | null, locale: Language): string {
  if (!value) return "-";
  return value.toLocaleDateString(locale === "de" ? "de-CH" : "en-GB", {
    day: "2-digit",
    month: "2-digit",
    year: "numeric",
  });
}

function formatHoursValue(value: number | null | undefined): string {
  const n = Number(value || 0);
  return `${n.toFixed(1)}h`;
}

function escapeHtml(value: string): string {
  return value
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/\"/g, "&quot;")
    .replace(/'/g, "&#39;");
}

type ReportLabels = {
  reportTitle: string;
  stateReportTitle: string;
  generatedAt: string;
  customer: string;
  executiveSummary: string;
  projectId: string;
  projectManager: string;
  timeline: string;
  status: string;
  budgetOverview: string;
  budgetUsage: string;
  total: string;
  assigned: string;
  reserve: string;
  statusBreakdown: string;
  tasks: string;
  subtasks: string;
  ragStatus: string;
  budget: string;
  delivery: string;
  quality: string;
  topCriticalTasks: string;
  milestones: string;
  risksAndIssues: string;
  decisions: string;
  tasksByPhase: string;
  riskIssue: string;
  impact: string;
  probability: string;
  mitigation: string;
  titleCol: string;
  assignedToCol: string;
  startCol: string;
  dueCol: string;
  hoursCol: string;
  phaseLabel: string;
  noCriticalTasks: string;
  interpretationBudget: string;
  interpretationStatus: string;
  interpretationPhase: string;
  duePrefix: string;
  low: string;
  medium: string;
  high: string;
  unassigned: string;
  summary: (projectStatus: string, completionPct: number, budgetPct: number, reserve: number, overdue: number, dueSoon: number) => string[];
};

function getLabels(locale: Language): ReportLabels {
  if (locale === "de") {
    return {
      reportTitle: "OnTrack Projektbericht",
      stateReportTitle: "Projektstatusbericht",
      generatedAt: "Erstellt",
      customer: "Kunde",
      executiveSummary: "Executive Summary",
      projectId: "Projekt ID",
      projectManager: "Projektleitung",
      timeline: "Zeitplan",
      status: "Status",
      budgetOverview: "Budgetuebersicht",
      budgetUsage: "Budgetnutzung",
      total: "Gesamt",
      assigned: "Zugewiesen",
      reserve: "Reserve",
      statusBreakdown: "Statusverteilung",
      tasks: "Tasks",
      subtasks: "Subtasks",
      ragStatus: "RAG Status (Ampellogik)",
      budget: "Budget",
      delivery: "Lieferfaehigkeit",
      quality: "Qualitaet",
      topCriticalTasks: "Top 3 Kritische Tasks",
      milestones: "Meilensteine",
      risksAndIssues: "Risiken & Issues",
      decisions: "Entscheidungen / Requests",
      tasksByPhase: "Tasks & Subtasks nach Phase",
      riskIssue: "Risiko / Issue",
      impact: "Auswirkung",
      probability: "Eintrittswahrscheinlichkeit",
      mitigation: "Massnahme",
      titleCol: "Titel",
      assignedToCol: "Zugewiesen an",
      startCol: "Start",
      dueCol: "Faellig",
      hoursCol: "Stunden",
      phaseLabel: "Phase",
      noCriticalTasks: "Aktuell keine kritischen Tasks identifiziert.",
      interpretationBudget: "Interpretation: Der Budgettrend ist",
      interpretationStatus: "Interpretation: Der Lieferstatus erfordert Fokus auf den Abbau von Pending- und ueberfaelligen Aufgaben.",
      interpretationPhase: "Interpretation: Nach Lieferphase gruppiert, um Fortschritt und Engpaesse sofort sichtbar zu machen.",
      duePrefix: "Faellig",
      low: "Niedrig",
      medium: "Mittel",
      high: "Hoch",
      unassigned: "Nicht zugeordnet",
      summary: (projectStatus, completionPct, budgetPct, reserve, overdue, dueSoon) => [
        `Projekt befindet sich aktuell in ${escapeHtml(projectStatus || "Ausfuehrung")} mit einem Fortschritt von ${completionPct.toFixed(0)}%.`,
        `Die Budgetnutzung liegt bei ${budgetPct.toFixed(1)}% bei einer Reserve von ${reserve.toLocaleString()}.`,
        `${overdue} ueberfaellige und ${dueSoon} bald faellige Tasks benoetigen fokussiertes Liefermanagement.`,
        "Naechste Schwerpunkte sind Testbereitschaft, Abhaengigkeiten und Go-Live-Vorbereitung.",
      ],
    };
  }

  return {
    reportTitle: "OnTrack Project Report",
    stateReportTitle: "Project State Report",
    generatedAt: "Generated",
    customer: "Customer",
    executiveSummary: "Executive Summary",
    projectId: "Project ID",
    projectManager: "Project Manager",
    timeline: "Timeline",
    status: "Status",
    budgetOverview: "Budget Overview",
    budgetUsage: "Budget Usage",
    total: "Total",
    assigned: "Assigned",
    reserve: "Reserve",
    statusBreakdown: "Status Breakdown",
    tasks: "Tasks",
    subtasks: "Subtasks",
    ragStatus: "RAG Status",
    budget: "Budget",
    delivery: "Delivery",
    quality: "Quality",
    topCriticalTasks: "Top 3 Critical Tasks",
    milestones: "Milestones",
    risksAndIssues: "Risks & Issues",
    decisions: "Decisions / Requests",
    tasksByPhase: "Tasks & Subtasks by Phase",
    riskIssue: "Risk / Issue",
    impact: "Impact",
    probability: "Probability",
    mitigation: "Mitigation",
    titleCol: "Title",
    assignedToCol: "Assigned To",
    startCol: "Start",
    dueCol: "Due",
    hoursCol: "Hours",
    phaseLabel: "Phase",
    noCriticalTasks: "No critical tasks currently identified.",
    interpretationBudget: "Interpretation: Budget trend is",
    interpretationStatus: "Interpretation: Delivery status indicates focus should remain on reducing pending and overdue items.",
    interpretationPhase: "Interpretation: Grouped by delivery phase to make progression and bottlenecks visible at a glance.",
    duePrefix: "Due",
    low: "Low",
    medium: "Medium",
    high: "High",
    unassigned: "Unassigned",
    summary: (projectStatus, completionPct, budgetPct, reserve, overdue, dueSoon) => [
      `Project is currently in ${escapeHtml(projectStatus || "Execution")} with completion at ${completionPct.toFixed(0)}%.`,
      `Budget utilization stands at ${budgetPct.toFixed(1)}% with reserve ${reserve.toLocaleString()}.`,
      `${overdue} overdue and ${dueSoon} due-soon tasks require focused delivery management.`,
      "Primary next milestone actions are testing readiness, dependency closure and go-live preparation.",
    ],
  };
}

function mapStatusLabel(status: string, locale: Language): string {
  if (locale !== "de") return status;
  if (status === "Pending") return "Ausstehend";
  if (status === "To Do") return "Zu erledigen";
  if (status === "In Progress") return "In Arbeit";
  if (status === "Done") return "Erledigt";
  return status;
}

function mapMilestoneStateLabel(state: "reached" | "critical" | "shifted", locale: Language): string {
  if (locale !== "de") return state.toUpperCase();
  if (state === "reached") return "ERREICHT";
  if (state === "critical") return "KRITISCH";
  return "VERSCHOBEN";
}

function mapRiskLevel(level: "low" | "medium" | "high", locale: Language, labels: ReportLabels): string {
  if (locale !== "de") return level.toUpperCase();
  if (level === "low") return labels.low.toUpperCase();
  if (level === "medium") return labels.medium.toUpperCase();
  return labels.high.toUpperCase();
}

export function buildProjectStateReportHtml(
  project: Project,
  hourlyRates: HourlyRate[],
  logoSrc: string,
  locale: Language,
): string {
  const labels = getLabels(locale);
  const tasks = project.Tasks || [];
  const subtasks = tasks.flatMap((task) => task.subtasks || []);
  const now = new Date();
  now.setHours(0, 0, 0, 0);

  const statusCounts = {
    Pending: tasks.filter((task) => task.status === "Pending").length,
    ToDo: tasks.filter((task) => task.status === "To Do").length,
    InProgress: tasks.filter((task) => task.status === "In Progress").length,
    Done: tasks.filter((task) => task.status === "Done").length,
  };

  const subtaskStatusCounts = {
    Pending: subtasks.filter((subtask) => subtask.status === "Pending").length,
    ToDo: subtasks.filter((subtask) => subtask.status === "To Do").length,
    InProgress: subtasks.filter((subtask) => subtask.status === "In Progress").length,
    Done: subtasks.filter((subtask) => subtask.status === "Done").length,
  };

  const assignedBudget = getAssignedBudget(project, hourlyRates);
  const budget = project.budget || 0;
  const reserve = budget - assignedBudget;
  const budgetUsagePct = budget > 0 ? Math.min(100, (assignedBudget / budget) * 100) : 0;

  const criticalTasks = [...tasks]
    .filter((task) => task.status !== "Done")
    .sort((a, b) => {
      const aDue = a.dueDate ? new Date(a.dueDate).getTime() : Number.MAX_SAFE_INTEGER;
      const bDue = b.dueDate ? new Date(b.dueDate).getTime() : Number.MAX_SAFE_INTEGER;
      const aOverdue = a.dueDate ? new Date(a.dueDate).getTime() < now.getTime() : false;
      const bOverdue = b.dueDate ? new Date(b.dueDate).getTime() < now.getTime() : false;
      if (aOverdue !== bOverdue) return aOverdue ? -1 : 1;
      if (aDue !== bDue) return aDue - bDue;
      return (b.estimatedHours || 0) - (a.estimatedHours || 0);
    })
    .slice(0, 3);

  const milestones = [...tasks]
    .map((task) => {
      const due = task.dueDate ? new Date(task.dueDate) : null;
      let state: "reached" | "critical" | "shifted" = "critical";
      if (task.status === "Done") state = "reached";
      else if (due && due.getTime() < now.getTime()) state = "shifted";
      else state = "critical";
      return {
        title: task.title,
        due,
        state,
        phase: task.projectPhase || "Unassigned",
      };
    })
    .sort((a, b) => {
      const ad = a.due ? a.due.getTime() : Number.MAX_SAFE_INTEGER;
      const bd = b.due ? b.due.getTime() : Number.MAX_SAFE_INTEGER;
      return ad - bd;
    })
    .slice(0, 8);

  const overdueTaskCount = tasks.filter((task) => task.status !== "Done" && task.dueDate && new Date(task.dueDate) < now).length;
  const dueSoonTaskCount = tasks.filter((task) => {
    if (task.status === "Done" || !task.dueDate) return false;
    const due = new Date(task.dueDate);
    const in7 = new Date(now);
    in7.setDate(in7.getDate() + 7);
    return due >= now && due <= in7;
  }).length;

  const completionPct = tasks.length > 0 ? (statusCounts.Done / tasks.length) * 100 : 0;
  const timelineRisk = overdueTaskCount > 0 ? "high" : dueSoonTaskCount > 2 ? "medium" : "low";
  const budgetRisk = budgetUsagePct > 95 ? "high" : budgetUsagePct > 80 ? "medium" : "low";
  const deliveryRisk = completionPct < 40 && statusCounts.InProgress > 0 ? "medium" : completionPct >= 70 ? "low" : "medium";
  const qualityRisk = subtaskStatusCounts.Pending > subtaskStatusCounts.Done ? "medium" : "low";

  const riskItems: Array<{ title: string; impact: string; probability: string; action: string }> = [];
  if (timelineRisk !== "low") {
    riskItems.push({
      title: locale === "de" ? "Zeitplandruck durch offene faellige Tasks" : "Timeline pressure from open due tasks",
      impact: timelineRisk === "high" ? labels.high : labels.medium,
      probability: timelineRisk === "high" ? labels.high : labels.medium,
      action: locale === "de"
        ? "Ueberfaellige und bald faellige Tasks priorisieren, woechentliche Readiness-Checks durchfuehren."
        : "Prioritize overdue and due-soon tasks, run weekly readiness checks.",
    });
  }
  if (budgetRisk !== "low") {
    riskItems.push({
      title: locale === "de" ? "Trend der Budgetausschoepfung" : "Budget consumption trend",
      impact: budgetRisk === "high" ? labels.high : labels.medium,
      probability: budgetRisk === "high" ? labels.high : labels.medium,
      action: locale === "de"
        ? "Arbeitspakete neu planen, Scope und Reserveeinsatz validieren."
        : "Re-plan work packages, validate scope and reserve usage.",
    });
  }
  if (deliveryRisk !== "low") {
    riskItems.push({
      title: locale === "de" ? "Unsicherheit bei Lieferdurchsatz" : "Delivery throughput uncertainty",
      impact: labels.medium,
      probability: labels.medium,
      action: locale === "de"
        ? "Ausfuehrungsfokus auf Hauptblocker und teamuebergreifende Abhaengigkeiten erhoehen."
        : "Increase execution focus on top blockers and cross-team dependencies.",
    });
  }
  if (qualityRisk !== "low") {
    riskItems.push({
      title: locale === "de" ? "Qualitaetsgates unter Risiko" : "Quality gates at risk",
      impact: labels.medium,
      probability: labels.medium,
      action: locale === "de"
        ? "Aufwand auf Tests und Abschluss der Akzeptanzkriterien verlagern."
        : "Shift effort to testing and acceptance criteria completion.",
    });
  }

  if (riskItems.length === 0) {
    riskItems.push({
      title: locale === "de" ? "Aktuell keine wesentlichen eskalierten Risiken" : "No material risks currently escalated",
      impact: labels.low,
      probability: labels.low,
      action: locale === "de" ? "Aktuellen Rhythmus und Monitoring fortsetzen." : "Continue current cadence and monitoring.",
    });
  }

  const decisionItems: string[] = [];
  if (budgetRisk === "high") decisionItems.push(locale === "de" ? "Budgetanpassung oder Descoping-Optionen fuer die naechste Phase freigeben." : "Approve budget adjustment or descoping options for next phase.");
  if (timelineRisk === "high") decisionItems.push(locale === "de" ? "Timeline-Trade-offs und Ressourcenverstaerkung bestaetigen." : "Confirm timeline trade-offs and resource reinforcement.");
  if (statusCounts.Pending > statusCounts.Done) decisionItems.push(locale === "de" ? "Unterstuetzung beim Beseitigen von Blockern in Pending-Task-Clustern bereitstellen." : "Support removal of blockers for pending task clusters.");
  if (decisionItems.length === 0) decisionItems.push(locale === "de" ? "In diesem Reporting-Zyklus ist keine dringende Management-Entscheidung erforderlich." : "No urgent management decision required at this reporting cycle.");

  const totalTaskCount = Math.max(1, tasks.length);
  const taskDonePct = (statusCounts.Done / totalTaskCount) * 100;
  const taskInProgressPct = (statusCounts.InProgress / totalTaskCount) * 100;
  const taskToDoPct = (statusCounts.ToDo / totalTaskCount) * 100;

  const makeBar = (label: string, count: number, total: number, color: string) => {
    const pct = total > 0 ? (count / total) * 100 : 0;
    return `
      <div class="bar-row">
        <div class="bar-head">
          <span>${label}</span>
          <span>${count} (${pct.toFixed(0)}%)</span>
        </div>
        <div class="bar-track">
          <div class="bar-fill" style="width:${pct}%; background:${color}"></div>
        </div>
      </div>
    `;
  };

  const taskBarsHtml = [
    makeBar(mapStatusLabel("Pending", locale), statusCounts.Pending, tasks.length, "#6b7280"),
    makeBar(mapStatusLabel("To Do", locale), statusCounts.ToDo, tasks.length, "#3b82f6"),
    makeBar(mapStatusLabel("In Progress", locale), statusCounts.InProgress, tasks.length, "#f59e0b"),
    makeBar(mapStatusLabel("Done", locale), statusCounts.Done, tasks.length, "#10b981"),
  ].join("");

  const subtaskBarsHtml = [
    makeBar(mapStatusLabel("Pending", locale), subtaskStatusCounts.Pending, subtasks.length, "#6b7280"),
    makeBar(mapStatusLabel("To Do", locale), subtaskStatusCounts.ToDo, subtasks.length, "#3b82f6"),
    makeBar(mapStatusLabel("In Progress", locale), subtaskStatusCounts.InProgress, subtasks.length, "#f59e0b"),
    makeBar(mapStatusLabel("Done", locale), subtaskStatusCounts.Done, subtasks.length, "#10b981"),
  ].join("");

  const tasksByPhase = tasks.reduce<Record<string, typeof tasks>>((acc, task) => {
    const phase = task.projectPhase || labels.unassigned;
    if (!acc[phase]) acc[phase] = [];
    acc[phase].push(task);
    return acc;
  }, {});

  const phaseTablesHtml = Object.entries(tasksByPhase)
    .map(([phase, phaseTasks]) => {
      const rowsHtml = phaseTasks
        .map((task) => {
          const subtasksHtml = (task.subtasks || [])
            .map(
              (subtask) => `
              <tr class="subtask-row">
                <td class="subtask">- ${escapeHtml(subtask.title)}</td>
                <td>${escapeHtml(mapStatusLabel(subtask.status, locale))}</td>
                <td>${escapeHtml(subtask.assignedTo || "-")}</td>
                <td>${formatDate(subtask.startDate, locale)}</td>
                <td>${formatDate(subtask.dueDate, locale)}</td>
                <td>${formatHoursValue(subtask.estimatedHours)}</td>
              </tr>`,
            )
            .join("");

          return `
            <tr>
              <td><strong>${escapeHtml(task.title)}</strong></td>
              <td>${escapeHtml(mapStatusLabel(task.status, locale))}</td>
              <td>${escapeHtml(task.assignedTo || "-")}</td>
              <td>${formatDate(task.startDate, locale)}</td>
              <td>${formatDate(task.dueDate, locale)}</td>
              <td>${formatHoursValue(task.estimatedHours)}</td>
            </tr>
            ${subtasksHtml}`;
        })
        .join("");

      return `
        <h3 class="phase-title">${labels.phaseLabel}: ${escapeHtml(phase)}</h3>
        <table>
          <thead>
            <tr>
              <th>${labels.titleCol}</th>
              <th>${labels.status}</th>
              <th>${labels.assignedToCol}</th>
              <th>${labels.startCol}</th>
              <th>${labels.dueCol}</th>
              <th>${labels.hoursCol}</th>
            </tr>
          </thead>
          <tbody>${rowsHtml}</tbody>
        </table>
      `;
    })
    .join("");

  const ragClass = (value: "low" | "medium" | "high") => (value === "high" ? "bad" : value === "medium" ? "warn" : "good");

  const summaryLines = labels.summary(project.projectstatus || "", completionPct, budgetUsagePct, reserve, overdueTaskCount, dueSoonTaskCount);

  const criticalTasksHtml = criticalTasks.length > 0
    ? criticalTasks
      .map((task) => `<li><strong>${escapeHtml(task.title)}</strong> (${escapeHtml(mapStatusLabel(task.status, locale))}) - ${labels.duePrefix} ${formatDate(task.dueDate, locale)}</li>`)
      .join("")
    : `<li>${labels.noCriticalTasks}</li>`;

  const milestoneHtml = milestones
    .map((m) => {
      const badge = m.state === "reached" ? "good" : m.state === "critical" ? "warn" : "bad";
      return `
        <li>
          <span class="pill ${badge}">${mapMilestoneStateLabel(m.state, locale)}</span>
          <strong>${escapeHtml(m.title)}</strong> (${escapeHtml(m.phase)}) - ${m.due ? formatDate(m.due, locale) : "-"}
        </li>`;
    })
    .join("");

  return `
    <!doctype html>
    <html>
      <head>
        <meta charset="utf-8" />
        <title>${labels.stateReportTitle} - ${escapeHtml(project.title)}</title>
        <style>
          :root {
            --slate-900: #0f172a;
            --slate-700: #334155;
            --slate-500: #64748b;
            --slate-200: #e2e8f0;
            --blue-600: #2563eb;
            --emerald-500: #10b981;
            --amber-500: #f59e0b;
            --rose-500: #f43f5e;
          }
          * { box-sizing: border-box; }
          body {
            font-family: "Segoe UI", Arial, sans-serif;
            color: var(--slate-900);
            background: #f8fafc;
            margin: 0;
            padding: 24px;
            -webkit-print-color-adjust: exact;
            print-color-adjust: exact;
          }
          .page {
            background: white;
            border: 1px solid var(--slate-200);
            border-radius: 16px;
            overflow: hidden;
          }
          .hero {
            padding: 18px 24px;
            background: #f8fafc;
            border-bottom: 1px solid var(--slate-200);
            display: flex;
            align-items: center;
            justify-content: space-between;
            gap: 18px;
          }
          .hero-left {
            display: flex;
            align-items: center;
            gap: 14px;
            min-width: 0;
          }
          .brand-logo {
            width: 44px;
            height: 44px;
            border-radius: 10px;
            border: 1px solid var(--slate-200);
            background: white;
            object-fit: contain;
            padding: 6px;
          }
          .hero h1 { margin: 0; font-size: 26px; line-height: 1.1; }
          .hero p { margin: 6px 0 0; color: var(--slate-700); font-size: 13px; }
          .brand-tag {
            font-size: 11px;
            color: var(--blue-600);
            font-weight: 700;
            text-transform: uppercase;
            letter-spacing: .12em;
          }
          .section { padding: 18px 24px; }
          .section h2 { margin: 0 0 10px; font-size: 17px; }
          .section p.interpret { margin: 6px 0 0; color: var(--slate-700); font-size: 13px; }
          .kpi-grid {
            display: grid;
            grid-template-columns: repeat(4, minmax(0, 1fr));
            gap: 10px;
          }
          .kpi {
            border: 1px solid var(--slate-200);
            border-radius: 12px;
            padding: 10px;
            background: #fff;
          }
          .kpi-label { font-size: 11px; color: var(--slate-500); text-transform: uppercase; letter-spacing: .08em; }
          .kpi-value { font-size: 20px; font-weight: 700; margin-top: 6px; }
          .grid2 {
            display: grid;
            grid-template-columns: 1.2fr 1fr;
            gap: 14px;
          }
          .panel {
            border: 1px solid var(--slate-200);
            border-radius: 12px;
            padding: 12px;
            background: white;
          }
          .bar-row { margin-bottom: 8px; }
          .bar-head { display: flex; justify-content: space-between; font-size: 12px; color: var(--slate-700); margin-bottom: 4px; }
          .bar-track { height: 9px; border-radius: 999px; background: #eef2f7; overflow: hidden; }
          .bar-fill { height: 100%; border-radius: 999px; }
          .donut-wrap { display: flex; align-items: center; gap: 12px; }
          .donut {
            width: 110px;
            height: 110px;
            border-radius: 50%;
            background: conic-gradient(
              #10b981 0 ${taskDonePct.toFixed(2)}%,
              #f59e0b ${taskDonePct.toFixed(2)}% ${(taskDonePct + taskInProgressPct).toFixed(2)}%,
              #3b82f6 ${(taskDonePct + taskInProgressPct).toFixed(2)}% ${(taskDonePct + taskInProgressPct + taskToDoPct).toFixed(2)}%,
              #6b7280 ${(taskDonePct + taskInProgressPct + taskToDoPct).toFixed(2)}% 100%
            );
            position: relative;
          }
          .donut::after {
            content: "";
            position: absolute;
            inset: 18px;
            border-radius: 50%;
            background: white;
          }
          .donut-center {
            position: absolute;
            inset: 0;
            display: flex;
            align-items: center;
            justify-content: center;
            z-index: 1;
            font-weight: 700;
            font-size: 18px;
          }
          .legend { font-size: 12px; color: var(--slate-700); }
          .legend div { margin-bottom: 4px; }
          .dot { display: inline-block; width: 8px; height: 8px; border-radius: 50%; margin-right: 6px; }
          table { width: 100%; border-collapse: collapse; margin-top: 10px; }
          th, td { border: 1px solid var(--slate-200); padding: 8px; text-align: left; font-size: 12px; }
          th { background: #f1f5f9; }
          .subtask-row td { background: #f8fafc; color: #334155; }
          .subtask { padding-left: 18px; }
          .pill {
            display: inline-block;
            border-radius: 999px;
            padding: 2px 8px;
            font-size: 11px;
            font-weight: 600;
          }
          .list { margin: 0; padding-left: 18px; }
          .list li { margin: 5px 0; font-size: 13px; color: var(--slate-800); }
          .phase-title {
            margin: 16px 0 8px;
            font-size: 14px;
            color: var(--slate-700);
            border-left: 3px solid #93c5fd;
            padding-left: 8px;
          }
          .good { background: #dcfce7; color: #166534; }
          .warn { background: #fef3c7; color: #92400e; }
          .bad { background: #ffe4e6; color: #9f1239; }
          @media print { body { padding: 0; background: white; } .page { border: none; border-radius: 0; } }
        </style>
      </head>
      <body>
        <div class="page">
          <div class="hero">
            <div class="hero-left">
              <img src="${logoSrc}" alt="OnTrack" class="brand-logo" />
              <div>
                <div class="brand-tag">${labels.reportTitle}</div>
                <h1>${labels.stateReportTitle}</h1>
                <p><strong>${escapeHtml(project.title)}</strong> | ${labels.customer}: ${escapeHtml(project.customerName || "-")} | ${labels.generatedAt}: ${new Date().toLocaleString(locale === "de" ? "de-CH" : "en-GB")}</p>
              </div>
            </div>
          </div>

          <div class="section">
            <h2>${labels.executiveSummary}</h2>
            <ul class="list">
              ${summaryLines.map((line) => `<li>${line}</li>`).join("")}
            </ul>
          </div>

          <div class="section">
            <div class="kpi-grid">
              <div class="kpi"><div class="kpi-label">${labels.projectId}</div><div class="kpi-value">${project.projectID ?? "-"}</div></div>
              <div class="kpi"><div class="kpi-label">${labels.projectManager}</div><div class="kpi-value">${escapeHtml(project.projectManager || "-")}</div></div>
              <div class="kpi"><div class="kpi-label">${labels.timeline}</div><div class="kpi-value" style="font-size:14px">${formatDate(project.startDate, locale)} - ${formatDate(project.dueDate, locale)}</div></div>
              <div class="kpi"><div class="kpi-label">${labels.status}</div><div class="kpi-value"><span class="pill ${project.projectstatus === "Execution" ? "warn" : project.projectstatus === "Closed" ? "good" : "bad"}">${escapeHtml(project.projectstatus || "-")}</span></div></div>
            </div>
          </div>

          <div class="section">
            <h2>${labels.budgetOverview}</h2>
            <p class="interpret">${labels.interpretationBudget} ${budgetUsagePct > 95 ? labels.high.toLowerCase() : budgetUsagePct > 80 ? labels.medium.toLowerCase() : labels.low.toLowerCase()}.</p>
            <div class="grid2">
              <div class="panel">
                <div class="bar-head"><span>${labels.budgetUsage}</span><strong>${budgetUsagePct.toFixed(1)}%</strong></div>
                <div class="bar-track"><div class="bar-fill" style="width:${budgetUsagePct}%; background:${budgetUsagePct > 100 ? "#f43f5e" : "#2563eb"}"></div></div>
                <div class="kpi-grid" style="margin-top:12px; grid-template-columns: repeat(3, minmax(0, 1fr));">
                  <div class="kpi"><div class="kpi-label">${labels.total}</div><div class="kpi-value" style="font-size:16px">${budget.toLocaleString()}</div></div>
                  <div class="kpi"><div class="kpi-label">${labels.assigned}</div><div class="kpi-value" style="font-size:16px">${assignedBudget.toLocaleString()}</div></div>
                  <div class="kpi"><div class="kpi-label">${labels.reserve}</div><div class="kpi-value" style="font-size:16px">${reserve.toLocaleString()}</div></div>
                </div>
              </div>
              <div class="panel donut-wrap">
                <div style="position:relative">
                  <div class="donut"></div>
                  <div class="donut-center">${taskDonePct.toFixed(0)}%</div>
                </div>
                <div class="legend">
                  <div><span class="dot" style="background:#10b981"></span>${mapStatusLabel("Done", locale)}</div>
                  <div><span class="dot" style="background:#f59e0b"></span>${mapStatusLabel("In Progress", locale)}</div>
                  <div><span class="dot" style="background:#3b82f6"></span>${mapStatusLabel("To Do", locale)}</div>
                  <div><span class="dot" style="background:#6b7280"></span>${mapStatusLabel("Pending", locale)}</div>
                </div>
              </div>
            </div>
          </div>

          <div class="section">
            <h2>${labels.statusBreakdown}</h2>
            <p class="interpret">${labels.interpretationStatus}</p>
            <div class="grid2">
              <div class="panel">
                <h3 style="margin:0 0 8px; font-size:14px; color:#334155">${labels.tasks} (${tasks.length})</h3>
                ${taskBarsHtml}
              </div>
              <div class="panel">
                <h3 style="margin:0 0 8px; font-size:14px; color:#334155">${labels.subtasks} (${subtasks.length})</h3>
                ${subtaskBarsHtml}
              </div>
            </div>
          </div>

          <div class="section">
            <h2>${labels.ragStatus}</h2>
            <div class="kpi-grid">
              <div class="kpi"><div class="kpi-label">${labels.budget}</div><div class="kpi-value"><span class="pill ${ragClass(budgetRisk)}">${mapRiskLevel(budgetRisk, locale, labels)}</span></div></div>
              <div class="kpi"><div class="kpi-label">${labels.timeline}</div><div class="kpi-value"><span class="pill ${ragClass(timelineRisk)}">${mapRiskLevel(timelineRisk, locale, labels)}</span></div></div>
              <div class="kpi"><div class="kpi-label">${labels.delivery}</div><div class="kpi-value"><span class="pill ${ragClass(deliveryRisk)}">${mapRiskLevel(deliveryRisk, locale, labels)}</span></div></div>
              <div class="kpi"><div class="kpi-label">${labels.quality}</div><div class="kpi-value"><span class="pill ${ragClass(qualityRisk)}">${mapRiskLevel(qualityRisk, locale, labels)}</span></div></div>
            </div>
          </div>

          <div class="section">
            <h2>${labels.topCriticalTasks}</h2>
            <ul class="list">${criticalTasksHtml}</ul>
          </div>

          <div class="section">
            <h2>${labels.milestones}</h2>
            <ul class="list">${milestoneHtml}</ul>
          </div>

          <div class="section">
            <h2>${labels.risksAndIssues}</h2>
            <table>
              <thead>
                <tr>
                  <th>${labels.riskIssue}</th>
                  <th>${labels.impact}</th>
                  <th>${labels.probability}</th>
                  <th>${labels.mitigation}</th>
                </tr>
              </thead>
              <tbody>
                ${riskItems
                  .map(
                    (r) => `
                      <tr>
                        <td>${escapeHtml(r.title)}</td>
                        <td>${escapeHtml(r.impact)}</td>
                        <td>${escapeHtml(r.probability)}</td>
                        <td>${escapeHtml(r.action)}</td>
                      </tr>`,
                  )
                  .join("")}
              </tbody>
            </table>
          </div>

          <div class="section">
            <h2>${labels.decisions}</h2>
            <ul class="list">${decisionItems.map((d) => `<li>${escapeHtml(d)}</li>`).join("")}</ul>
          </div>

          <div class="section">
            <h2>${labels.tasksByPhase}</h2>
            <p class="interpret">${labels.interpretationPhase}</p>
            ${phaseTablesHtml}
          </div>
        </div>
      </body>
    </html>
  `;
}
