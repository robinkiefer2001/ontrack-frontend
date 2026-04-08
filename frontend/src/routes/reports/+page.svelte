
<script lang="ts">
import { get, derived } from "svelte/store";
import { projectList } from "$lib/modules/projects/store";
import { t } from "$lib/language";
import { formatBudget, formatHours } from "$lib/utils/format";
import { isProjectOnTrack, getProjectBudgetSummary } from "$lib/modules/projects/business";
import { loadHourlyRates } from "$lib/domain/project/hourlyRates";
import { buildProjectStateReportHtml } from "$lib/modules/projects/report";

// Helper to get store value
function getStore<T>(store: { subscribe: (fn: (v: T) => void) => () => void }): T {
	let value: T;
	store.subscribe((v: T) => value = v)();
	return value!;
}

// Formatting helpers
const fmt = (n: number | string) => typeof n === "number" ? n.toLocaleString("de-CH", { maximumFractionDigits: 1 }) : n;
const fmtCurrency = (n: number | string) => typeof n === "number" ? n.toLocaleString("de-CH", { style: "currency", currency: "CHF", maximumFractionDigits: 0 }) : n;


// ── Budget Report Data ────────────────────────────────────────────────
let budgetData = derived(projectList, ($projectList) => {
	// Aggregate budget data across all projects
	let totalBudget = 0;
	let totalEstimatedCost = 0;
	let totalEstimatedHours = 0;
	let overrun = 0;
	let hoursPerEmployee: { name: string; hours: number }[] = [];
	let costPerPhase: { phase: string; hours: number; cost: number }[] = [];
	const employeeHours: Record<string, number> = {};
	const phaseCosts: Record<string, { hours: number; cost: number }> = {};
	for (const project of $projectList) {
		totalBudget += project.budget ?? 0;
		const tasks = project.Tasks || [];
		for (const task of tasks) {
			totalEstimatedHours += task.estimatedHours ?? 0;
			totalEstimatedCost += (task.estimatedHours ?? 0) * 120; // Assume flat rate for demo
			if (task.assignedTo) {
				employeeHours[task.assignedTo] = (employeeHours[task.assignedTo] || 0) + (task.estimatedHours ?? 0);
			}
			if (task.phaseId) {
				if (!phaseCosts[task.phaseId]) phaseCosts[task.phaseId] = { hours: 0, cost: 0 };
				phaseCosts[task.phaseId].hours += task.estimatedHours ?? 0;
				phaseCosts[task.phaseId].cost += (task.estimatedHours ?? 0) * 120;
			}
		}
		overrun += Math.max(0, totalEstimatedCost - totalBudget);
	}
	hoursPerEmployee = Object.entries(employeeHours).map(([name, hours]) => ({ name, hours }));
	costPerPhase = Object.entries(phaseCosts).map(([phase, { hours, cost }]) => ({ phase, hours, cost }));
	return {
		totalBudget,
		totalEstimatedCost,
		totalEstimatedHours,
		overrun: totalEstimatedCost - totalBudget,
		hoursPerEmployee,
		costPerPhase
	};
});

// ── Workload Report Data ──────────────────────────────────────────────
let workloadData = derived(projectList, ($projectList) => {
	// Aggregate workload data across all projects
	let totalTasks = 0;
	let employeeWorkload: { name: string; assigned: number; monthlyCapacity: number; employmentPercent: number; weeklyCapacity: number; overloaded: boolean }[] = [];
	let upcomingDeadlines: { title: string; projectTitle: string; assignedTo: string; dueDate: string; taskID: number }[] = [];
	let taskDistribution: { status: string; count: number }[] = [];
	const employeeMap: Record<string, { assigned: number; monthlyCapacity: number; employmentPercent: number; weeklyCapacity: number; overloaded: boolean }> = {};
	const statusMap: Record<string, number> = {};
	for (const project of $projectList) {
		const tasks = project.Tasks || [];
		totalTasks += tasks.length;
		for (const task of tasks) {
			if (task.assignedTo) {
				if (!employeeMap[task.assignedTo]) employeeMap[task.assignedTo] = { assigned: 0, monthlyCapacity: 160, employmentPercent: 100, weeklyCapacity: 40, overloaded: false };
				employeeMap[task.assignedTo].assigned += task.estimatedHours ?? 0;
				// Overload if assigned > monthlyCapacity
				employeeMap[task.assignedTo].overloaded = employeeMap[task.assignedTo].assigned > employeeMap[task.assignedTo].monthlyCapacity;
			}
			if (task.status) {
				statusMap[task.status] = (statusMap[task.status] || 0) + 1;
			}
			if (task.dueDate) {
				const due = new Date(task.dueDate);
				if (due > new Date()) {
					upcomingDeadlines.push({ title: task.title, projectTitle: project.title, assignedTo: task.assignedTo ?? "", dueDate: due.toISOString(), taskID: task.taskID });
				}
			}
		}
	}
	employeeWorkload = Object.entries(employeeMap).map(([name, v]) => ({ name, ...v }));
	taskDistribution = Object.entries(statusMap).map(([status, count]) => ({ status, count }));
	return {
		totalTasks,
		employeeWorkload,
		upcomingDeadlines,
		taskDistribution
	};
});

	// ── Milestone Report Data ────────────────────────────────────────────
	let milestoneData = derived(projectList, ($projectList) => {
		const projects = $projectList;

		return projects.slice(0, 20).map((project) => {
			const tasks = project.Tasks || [];
			const doneTasks = tasks.filter((t: any) => t.status === "Done");
			const totalTasks = tasks.length;
			const progress = totalTasks === 0 ? 0 : Math.round((doneTasks.length / totalTasks) * 100);

			const phases = [
				...project.initiationPhase,
				...project.planingPhase,
				...project.executionPhase,
				...project.closurePhase,
			];
			const completedPhases = phases.filter((p: any) => p.dueDate && new Date(p.dueDate) < new Date());
			const nextPhase = phases.find((p: any) => p.dueDate && new Date(p.dueDate) >= new Date());

			const customerName = "-";

			return {
				projectTitle: project.title,
				customerName,
				progress,
				doneTasks: doneTasks.length,
				totalTasks,
				completedPhases: completedPhases.length,
				totalPhases: phases.length,
				nextPhase: nextPhase?.phaseName ?? "-",
				nextPhaseDue: nextPhase?.dueDate ? new Date(nextPhase.dueDate).toLocaleDateString("de-CH") : "-",
			};
		});
	});

	// ── Delay & Risk Report Data ─────────────────────────────────────────
	let delayRiskData = (() => {
		const projects = get(projectList);
		const tasks = projects.flatMap((p: any) => (p.Tasks || []).map((t: any) => ({ ...t, projectTitle: p.title })));
		const today = new Date();
		const overdueTasks = tasks
			.filter((t) => t.status !== "Done" && t.dueDate && new Date(t.dueDate) < today)
			.sort((a, b) => new Date(a.dueDate!).getTime() - new Date(b.dueDate!).getTime());
		const unassignedTasks = tasks.filter((t) => !t.assignedTo || t.assignedTo.trim() === "");
		const excessiveHoursTasks = tasks
			.filter((t) => (t.estimatedHours ?? 0) > 80)
			.sort((a, b) => (b.estimatedHours ?? 0) - (a.estimatedHours ?? 0));
		const phasesBehind = projects.flatMap((p) => {
			const allPhases = [
				...p.initiationPhase.map((ph) => ({ ...ph, projectTitle: p.title })),
				...p.planingPhase.map((ph) => ({ ...ph, projectTitle: p.title })),
				...p.executionPhase.map((ph) => ({ ...ph, projectTitle: p.title })),
				...p.closurePhase.map((ph) => ({ ...ph, projectTitle: p.title })),
			];
			return allPhases.filter((ph) => ph.dueDate && new Date(ph.dueDate) < today && p.projectstatus !== "Closed" && p.projectstatus !== "Cancelled");
		});
		return { overdueTasks, unassignedTasks, excessiveHoursTasks, phasesBehind };
	})();

	// ── Project Status Report Data ───────────────────────────────────────
	let projectStatusData = derived(projectList, ($projectList) => {
		const projects = $projectList;
		return projects.map((project) => {
			const tasks = project.Tasks || [];
			const totalTasks = tasks.length;
			const doneTasks = tasks.filter((t: any) => t.status === "Done").length;
			const inProgressTasks = tasks.filter((t: any) => t.status === "In Progress").length;
			const pendingTasks = tasks.filter((t: any) => t.status === "Pending" || t.status === "To Do").length;
			const overdueTasks = tasks.filter((t: any) => t.status !== "Done" && t.dueDate && new Date(t.dueDate) < new Date()).length;
			const progress = totalTasks === 0 ? 0 : Math.round((doneTasks / totalTasks) * 100);
			const totalHours = tasks.reduce((s: number, t: any) => s + (t.estimatedHours ?? 0), 0);
			const budget = project.budget ?? 0;
			const estimatedCost = totalHours * 120;
			const budgetUsage = budget > 0 ? Math.round((estimatedCost / budget) * 100) : 0;
			const customerName = "-";
			const hourlyRates = loadHourlyRates();
			const onTrack = isProjectOnTrack(project);
			const overBudget = getProjectBudgetSummary(project, hourlyRates).isOverBudget;
			const health: "onTrack" | "behind" | "overBudget" = overBudget ? "overBudget" : !onTrack ? "behind" : "onTrack";

			return {
				projectID: project.projectID,
				title: project.title,
				status: project.projectstatus,
				customerName,
				projectManager: project.projectManager || "-",
				progress, health,
				totalTasks, doneTasks, inProgressTasks, pendingTasks, overdueTasks,
				totalHours, budget, estimatedCost, budgetUsage,
				startDate: project.startDate ? new Date(project.startDate).toLocaleDateString("de-CH") : "-",
				dueDate: project.dueDate ? new Date(project.dueDate).toLocaleDateString("de-CH") : "-",
			};
		});
	});

	// ── UI State ─────────────────────────────────────────────────────────
	let currentView = $state("templates");
	let printPreviewHtml = $state("");
	let showPrintPreview = $state(false);

	// ── Print Functions ──────────────────────────────────────────────────
	function printCurrentReport() {
		const reportArea = document.getElementById("report-printable");
		if (!reportArea) return;
		const w = window.open("", "_blank", "width=1000,height=900");
		if (!w) return;
		w.document.open();
		w.document.write(`<!DOCTYPE html><html><head><meta charset="utf-8"><title>OnTrack Report</title>
<style>
* { margin:0; padding:0; box-sizing:border-box; }
body { font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', system-ui, sans-serif; padding: 32px 40px; color: #111827; font-size: 13px; line-height: 1.5; }
h1 { font-size: 24px; font-weight: 700; margin-bottom: 4px; }
.subtitle { font-size: 12px; color: #6b7280; margin-bottom: 24px; }
h2 { font-size: 15px; font-weight: 600; margin-bottom: 10px; color: #1f2937; border-bottom: 2px solid #e5e7eb; padding-bottom: 6px; }
.section { margin-bottom: 28px; }
table { width: 100%; border-collapse: collapse; margin-top: 6px; }
th { background: #f9fafb; font-weight: 600; font-size: 11px; text-transform: uppercase; letter-spacing: 0.05em; color: #6b7280; padding: 8px 12px; border-bottom: 2px solid #e5e7eb; text-align: left; }
td { padding: 8px 12px; border-bottom: 1px solid #f3f4f6; font-size: 13px; }
tr:hover { background: #f9fafb; }
.text-right { text-align: right; }
.text-red { color: #dc2626; }
.text-orange { color: #ea580c; }
.text-green { color: #16a34a; }
.text-blue { color: #2563eb; }
.text-muted { color: #9ca3af; font-style: italic; }
.kpi-row { display: flex; gap: 12px; flex-wrap: wrap; margin: 8px 0 4px; }
.kpi { border: 1px solid #e5e7eb; border-radius: 12px; padding: 14px 24px; text-align: center; min-width: 140px; }
.kpi-value { font-size: 24px; font-weight: 700; }
.kpi-label { font-size: 11px; color: #6b7280; margin-top: 2px; }
.badge { display: inline-block; padding: 2px 10px; border-radius: 9999px; font-size: 11px; font-weight: 600; background: #f3f4f6; }
.bar-bg { background: #e5e7eb; height: 8px; border-radius: 4px; overflow: hidden; }
.bar-fill { height: 8px; border-radius: 4px; }
.footer { margin-top: 32px; padding-top: 14px; border-top: 2px solid #e5e7eb; font-size: 11px; color: #9ca3af; display: flex; justify-content: space-between; }
@media print { body { padding: 16px; } .section { break-inside: avoid; } }
</style></head><body>`);
		w.document.write(reportArea.innerHTML);
		w.document.write("</body></html>");
		w.document.close();
		w.focus();
		w.print();
	}

	function generateBuilderReportHtml(): string {
		const tr = get(t);
		const date = new Date().toLocaleDateString("de-CH");
		const time = new Date().toLocaleTimeString("de-CH");
		const dateFormatted = new Date().toLocaleDateString("de-CH", { year: "numeric", month: "long", day: "numeric" });
		const reportTitle = customReportName.trim() || "Portfolio-Bericht";

		const _budgetData = getStore(budgetData);
		const _workloadData = getStore(workloadData);
		const _milestoneData = getStore(milestoneData);
		const _projectStatusData = getStore(projectStatusData);
		const sel = selectedDataSets;

		// ── Category flags ───────────────────────────────────────────────
		const hasBudget = sel.some((d) => ["budgetVsActual","hoursPerEmployee","costPerPhase","forecastedOverrun"].includes(d));
		const hasWorkload = sel.some((d) => ["hoursAssigned","overloadDetection","capacityPlanning","upcomingDeadlines","taskDistribution"].includes(d));
		const hasMilestone = sel.some((d) => ["milestonesAchieved","deliverables"].includes(d));
		const hasRisk = sel.some((d) => ["overdueTasks","unassignedTasks","excessiveHours","phasesBehind"].includes(d));
		const hasProject = sel.some((d) => ["projectOverview","projectProgress","projectBudgetUsage"].includes(d));

		// ── Computed Metrics ─────────────────────────────────────────────
		const budgetUsagePct = _budgetData.totalBudget > 0 ? (_budgetData.totalEstimatedCost / _budgetData.totalBudget) * 100 : 0;
		const overrunPct = _budgetData.totalBudget > 0 ? Math.round((_budgetData.overrun / _budgetData.totalBudget) * 100) : 0;
		const topPhases = [..._budgetData.costPerPhase].sort((a: any, b: any) => b.cost - a.cost);
		const topEmpHours = [..._budgetData.hoursPerEmployee].sort((a: any, b: any) => b.hours - a.hours);
		const avgHours = topEmpHours.length > 0 ? topEmpHours.reduce((s: number, e: any) => s + e.hours, 0) / topEmpHours.length : 0;
		const totalCostPhases = topPhases.reduce((s: number, p: any) => s + p.cost, 0);

		const overloadedEmps = _workloadData.employeeWorkload.filter((e: any) => e.overloaded);
		const totalEmps = _workloadData.employeeWorkload.length;
		const avgUtilization = totalEmps > 0 ? Math.round(_workloadData.employeeWorkload.reduce((s: number, e: any) => s + (e.monthlyCapacity > 0 ? (e.assigned / e.monthlyCapacity) * 100 : 0), 0) / totalEmps) : 0;
		const doneTasks = _workloadData.taskDistribution.find((d: any) => d.status === "Done")?.count ?? 0;
		const completionRate = _workloadData.totalTasks > 0 ? Math.round((doneTasks / _workloadData.totalTasks) * 100) : 0;

		const totalProjects = _projectStatusData.length;
		const onTrackCount = _projectStatusData.filter((p: any) => p.health === "onTrack").length;
		const behindCount = _projectStatusData.filter((p: any) => p.health === "behind").length;
		const overBudgetCount = _projectStatusData.filter((p: any) => p.health === "overBudget").length;
		const avgProjProgress = totalProjects > 0 ? Math.round(_projectStatusData.reduce((s: number, p: any) => s + p.progress, 0) / totalProjects) : 0;

		const overdueCount = delayRiskData.overdueTasks.length;
		const unassignedCount = delayRiskData.unassignedTasks.length;
		const excessiveCount = delayRiskData.excessiveHoursTasks.length;
		const phasesBehindCount = delayRiskData.phasesBehind.length;
		const avgMilestoneProgress = _milestoneData.length > 0 ? Math.round(_milestoneData.reduce((s: number, p: any) => s + p.progress, 0) / _milestoneData.length) : 0;

		// ── Helper: inline progress bar ────────────────────────────────
		function bar(pct: number, color = "#3b82f6"): string {
			const p = Math.min(Math.max(pct, 0), 100);
			return `<div style="background:#e5e7eb;height:8px;border-radius:4px;overflow:hidden;margin-top:4px;min-width:80px;"><div style="height:8px;border-radius:4px;background:${color};width:${p}%;"></div></div>`;
		}
		function healthColor(h: string): string {
			return h === "overBudget" ? "#dc2626" : h === "behind" ? "#ea580c" : "#16a34a";
		}

		// ── Executive Summary ────────────────────────────────────────────
		const execPoints: string[] = [];
		if (hasBudget && _budgetData.totalBudget > 0) {
			execPoints.push(_budgetData.overrun > 0
				? `Das Portfolio verzeichnet eine prognostizierte Budgetüberschreitung von <strong>${fmtCurrency(_budgetData.overrun)}</strong> (${overrunPct}% über dem Planbudget von ${fmtCurrency(_budgetData.totalBudget)}).`
				: `Das Portfolio liegt budgetseitig im Plan: Geschätzte Kosten ${fmtCurrency(_budgetData.totalEstimatedCost)} innerhalb des Budgets von <strong>${fmtCurrency(_budgetData.totalBudget)}</strong>.`);
			if (topPhases.length > 0) execPoints.push(`Kostenintensivste Phase: <strong>«${topPhases[0].phase}»</strong> mit ${fmtCurrency(topPhases[0].cost)} (${fmt(topPhases[0].hours)} Std.).`);
		}
		if (hasProject && totalProjects > 0) {
			execPoints.push(`${totalProjects} Projekte im Portfolio — <strong style="color:#16a34a">${onTrackCount} im Zeitplan</strong>, <span style="color:#ea580c">${behindCount} verzögert</span>, <span style="color:#dc2626">${overBudgetCount} über Budget</span>. Ø Fortschritt: ${avgProjProgress}%.`);
		}
		if (hasWorkload && totalEmps > 0) {
			execPoints.push(overloadedEmps.length > 0
				? `<strong style="color:#dc2626">${overloadedEmps.length} von ${totalEmps} Mitarbeitenden überlastet</strong> — Kapazitätsrebalancing empfohlen. Ø Auslastung: ${avgUtilization}%.`
				: `Kapazitätsseitig stabil: alle ${totalEmps} Mitarbeitenden im grünen Bereich. Ø Auslastung: ${avgUtilization}%.`);
		}
		if (hasMilestone && _milestoneData.length > 0) {
			execPoints.push(`Meilensteine über ${_milestoneData.length} Projekte: Ø Fortschritt <strong>${avgMilestoneProgress}%</strong>.`);
		}
		if (hasRisk && (overdueCount + unassignedCount + phasesBehindCount) > 0) {
			execPoints.push(`Offene Risiken: <strong style="color:#dc2626">${overdueCount} überfällige Tasks</strong>, ${unassignedCount} nicht zugewiesen, ${phasesBehindCount} Phasen hinter Zeitplan.`);
		}
		if (execPoints.length === 0) execPoints.push(`Bericht aus ${sel.length} Datensätzen generiert — keine ausreichenden Portfoliodaten für eine automatische Zusammenfassung.`);

		// ── Risk Detection ───────────────────────────────────────────────
		const risks: { level: "high" | "medium" | "low"; text: string }[] = [];
		if (_budgetData.overrun > 0 && overrunPct > 5) risks.push({ level: overrunPct > 20 ? "high" : "medium", text: `Budgetüberschreitung von ${fmtCurrency(_budgetData.overrun)} (${overrunPct}%) prognostiziert.` });
		if (overloadedEmps.length > 0) risks.push({ level: "high", text: `${overloadedEmps.length} Mitarbeitende überlastet: ${overloadedEmps.map((e: any) => e.name).slice(0, 3).join(", ")}${overloadedEmps.length > 3 ? ` +${overloadedEmps.length - 3} weitere` : ""}.` });
		if (overBudgetCount > 0) risks.push({ level: "high", text: `${overBudgetCount} Projekt${overBudgetCount > 1 ? "e" : ""} überschreiten das Budget.` });
		if (overdueCount > 0) risks.push({ level: overdueCount > 10 ? "high" : "medium", text: `${overdueCount} überfällige Tasks beeinträchtigen den Projektfortschritt.` });
		if (phasesBehindCount > 0) risks.push({ level: "medium", text: `${phasesBehindCount} Projektphasen liegen hinter dem Zeitplan.` });
		if (behindCount > 0 && totalProjects > 0 && (behindCount / totalProjects) > 0.4) risks.push({ level: "medium", text: `${Math.round((behindCount / totalProjects) * 100)}% der Projekte sind verzögert.` });
		if (unassignedCount > 0) risks.push({ level: "low", text: `${unassignedCount} Tasks ohne Zuweisung — Bottleneck-Risiko.` });
		if (excessiveCount > 0) risks.push({ level: "low", text: `${excessiveCount} Tasks mit ungewöhnlich hohem Stundenaufwand identifiziert.` });

		// ── Recommendations ──────────────────────────────────────────────
		const recs: string[] = [];
		if (_budgetData.overrun > 0 && overrunPct > 5) recs.push(`<strong>Scope-Review:</strong> Budgetüberschreitung von ${overrunPct}% analysieren — Leistungsumfang oder Budget anpassen.`);
		if (overloadedEmps.length > 0) recs.push(`<strong>Kapazitätsrebalancing:</strong> Aufgaben von überlasteten Mitarbeitenden auf Personen mit freier Kapazität umverteilen.`);
		if (overdueCount > 0) recs.push(`<strong>Überfällige Tasks priorisieren:</strong> ${overdueCount} Tasks benötigen sofortige Aufmerksamkeit durch Projektverantwortliche.`);
		if (phasesBehindCount > 0) recs.push(`<strong>Phasen-Standup:</strong> ${phasesBehindCount} Phasen hinter Zeitplan — Impediments identifizieren und eskalieren.`);
		if (unassignedCount > 5) recs.push(`<strong>Task-Zuweisung beschleunigen:</strong> ${unassignedCount} offene Tasks ohne Verantwortliche verlangsamen den Fortschritt.`);
		if (topEmpHours.length > 1 && avgHours > 0 && topEmpHours[0].hours > avgHours * 2.5) recs.push(`<strong>Stundenverteilung prüfen:</strong> «${topEmpHours[0].name}» hat ${Math.round((topEmpHours[0].hours / avgHours - 1) * 100)}% mehr Stunden als der Durchschnitt.`);
		if (completionRate < 30 && _workloadData.totalTasks > 10) recs.push(`<strong>Lieferfortschritt überprüfen:</strong> Nur ${completionRate}% der Tasks erledigt — Sprint-Ziele und Kapazitäten neu evaluieren.`);
		if (recs.length === 0) recs.push("Keine kritischen Handlungsempfehlungen. Das Portfolio läuft planmässig.");

		// ── Detailed Sections ────────────────────────────────────────────
		let sectionsHtml = "";

		if (sel.includes("budgetVsActual") || sel.includes("forecastedOverrun")) {
			const oc = _budgetData.overrun > 0 ? "#dc2626" : "#16a34a";
			sectionsHtml += `<div class="section"><h2 class="section-title">Budget &amp; Kosten</h2>
			<div class="kpi-row">
				<div class="kpi"><div class="kpi-value">${fmtCurrency(_budgetData.totalBudget)}</div><div class="kpi-label">Planbudget</div></div>
				<div class="kpi"><div class="kpi-value" style="color:#2563eb">${fmtCurrency(_budgetData.totalEstimatedCost)}</div><div class="kpi-label">Geschätzte Kosten</div></div>
				<div class="kpi"><div class="kpi-value" style="color:#059669">${fmt(_budgetData.totalEstimatedHours)}h</div><div class="kpi-label">Gesamtstunden</div></div>
				<div class="kpi"><div class="kpi-value" style="color:${oc}">${_budgetData.overrun > 0 ? "+" : ""}${fmtCurrency(_budgetData.overrun)}</div><div class="kpi-label">Differenz</div></div>
			</div>
			<p style="font-size:12px;color:#6b7280;margin-top:8px;">Budgetauslastung: <strong style="color:${oc}">${Math.round(budgetUsagePct)}%</strong></p>
			${bar(budgetUsagePct, _budgetData.overrun > 0 ? "#dc2626" : "#16a34a")}</div>`;
		}

		if (sel.includes("hoursPerEmployee") && topEmpHours.length > 0) {
			const maxH = topEmpHours[0].hours;
			sectionsHtml += `<div class="section"><h2 class="section-title">Stunden pro Mitarbeiter</h2>
			<table><thead><tr><th>Mitarbeiter</th><th style="text-align:right">Stunden</th><th style="text-align:right">vs. Ø</th><th style="min-width:100px">Anteil</th></tr></thead><tbody>
			${topEmpHours.slice(0, 15).map((r: any) => {
				const pct = maxH > 0 ? (r.hours / maxH) * 100 : 0;
				const vsAvg = avgHours > 0 ? Math.round(((r.hours / avgHours) - 1) * 100) : 0;
				const isHigh = r.hours > avgHours * 1.5;
				return `<tr><td>${r.name}${isHigh ? ' <span class="badge badge-warn">Hoch</span>' : ""}</td><td style="text-align:right;font-weight:600">${fmt(r.hours)}h</td><td style="text-align:right;color:${vsAvg > 50 ? "#dc2626" : vsAvg > 20 ? "#ea580c" : "#6b7280"}">${vsAvg > 0 ? "+" : ""}${vsAvg}%</td><td>${bar(pct)}</td></tr>`;
			}).join("")}
			</tbody></table>
			<p class="text-muted" style="margin-top:6px;">Ø ${fmt(avgHours)}h pro Person · ${topEmpHours.length} Mitarbeitende</p></div>`;
		}

		if (sel.includes("costPerPhase") && topPhases.length > 0) {
			sectionsHtml += `<div class="section"><h2 class="section-title">Kosten pro Phase</h2>
			<table><thead><tr><th>Phase</th><th style="text-align:right">Kosten</th><th style="text-align:right">Stunden</th><th style="text-align:right">Anteil</th><th style="min-width:100px"></th></tr></thead><tbody>
			${topPhases.map((r: any) => {
				const pct = totalCostPhases > 0 ? Math.round((r.cost / totalCostPhases) * 100) : 0;
				return `<tr><td><strong>${r.phase}</strong></td><td style="text-align:right;font-weight:600">${fmtCurrency(r.cost)}</td><td style="text-align:right">${fmt(r.hours)}h</td><td style="text-align:right">${pct}%</td><td>${bar(pct, "#6366f1")}</td></tr>`;
			}).join("")}
			</tbody></table></div>`;
		}

		if (sel.includes("hoursAssigned") || sel.includes("overloadDetection") || sel.includes("capacityPlanning")) {
			const sortedWl = [..._workloadData.employeeWorkload].sort((a: any, b: any) => {
				const uB = b.monthlyCapacity > 0 ? b.assigned / b.monthlyCapacity : 0;
				const uA = a.monthlyCapacity > 0 ? a.assigned / a.monthlyCapacity : 0;
				return uB - uA;
			});
			sectionsHtml += `<div class="section"><h2 class="section-title">Mitarbeiter-Auslastung</h2>
			<div class="kpi-row">
				<div class="kpi"><div class="kpi-value" style="color:#2563eb">${totalEmps}</div><div class="kpi-label">Mitarbeitende</div></div>
				<div class="kpi"><div class="kpi-value" style="color:${overloadedEmps.length > 0 ? "#dc2626" : "#16a34a"}">${overloadedEmps.length}</div><div class="kpi-label">Überlastet</div></div>
				<div class="kpi"><div class="kpi-value">${avgUtilization}%</div><div class="kpi-label">Ø Auslastung</div></div>
			</div>
			<table style="margin-top:12px;"><thead><tr><th>Mitarbeiter</th><th style="text-align:right">Zugewiesen</th><th style="text-align:right">Kapazität</th><th style="text-align:right">Auslastung</th><th style="min-width:90px"></th></tr></thead><tbody>
			${sortedWl.map((r: any) => {
				const util = r.monthlyCapacity > 0 ? Math.round((r.assigned / r.monthlyCapacity) * 100) : 0;
				const c = util > 100 ? "#dc2626" : util > 80 ? "#ea580c" : "#16a34a";
				return `<tr><td>${r.name}${r.overloaded ? ' <span class="badge badge-danger">Überlastet</span>' : ""}</td><td style="text-align:right">${fmt(r.assigned)}h</td><td style="text-align:right">${fmt(r.monthlyCapacity)}h</td><td style="text-align:right;font-weight:700;color:${c}">${util}%</td><td>${bar(util, c)}</td></tr>`;
			}).join("")}
			</tbody></table></div>`;
		}

		if (sel.includes("taskDistribution") && _workloadData.totalTasks > 0) {
			sectionsHtml += `<div class="section"><h2 class="section-title">Task-Verteilung</h2>
			<div class="kpi-row">
			${_workloadData.taskDistribution.map((r: any) => {
				const pct = _workloadData.totalTasks > 0 ? Math.round((r.count / _workloadData.totalTasks) * 100) : 0;
				return `<div class="kpi"><div class="kpi-value">${r.count}</div><div class="kpi-label">${r.status} · ${pct}%</div></div>`;
			}).join("")}
			</div>
			<p style="font-size:12px;color:#6b7280;margin-top:8px;">Abschlussrate: <strong>${completionRate}%</strong> — ${doneTasks} von ${_workloadData.totalTasks} Tasks erledigt</p>
			${bar(completionRate, "#16a34a")}</div>`;
		}

		if (sel.includes("upcomingDeadlines") && _workloadData.upcomingDeadlines.length > 0) {
			const sortedDl = [..._workloadData.upcomingDeadlines].sort((a: any, b: any) => new Date(a.dueDate).getTime() - new Date(b.dueDate).getTime());
			sectionsHtml += `<div class="section"><h2 class="section-title">Bevorstehende Deadlines (${_workloadData.upcomingDeadlines.length})</h2>
			<table><thead><tr><th>Task</th><th>Projekt</th><th>Verantwortlich</th><th>Fällig am</th></tr></thead><tbody>
			${sortedDl.slice(0, 15).map((t: any) => {
				const due = new Date(t.dueDate);
				const days = Math.ceil((due.getTime() - Date.now()) / 86400000);
				const urgent = days <= 7;
				return `<tr><td>${t.title}${urgent ? ' <span class="badge badge-warn">Dringend</span>' : ""}</td><td>${t.projectTitle}</td><td>${t.assignedTo || "—"}</td><td style="font-weight:${urgent ? 700 : 400};color:${urgent ? "#dc2626" : "inherit"}">${due.toLocaleDateString("de-CH")}</td></tr>`;
			}).join("")}
			</tbody></table></div>`;
		}

		if (sel.includes("milestonesAchieved") || sel.includes("deliverables")) {
			const sortedMs = [..._milestoneData].sort((a: any, b: any) => b.progress - a.progress);
			sectionsHtml += `<div class="section"><h2 class="section-title">Projektmeilensteine &amp; Liefergegenstände</h2>
			<table><thead><tr><th>Projekt</th><th>Auftraggeber</th><th style="text-align:right">Fortschritt</th><th style="text-align:right">Tasks</th><th style="text-align:right">Phasen</th><th>Nächste Phase</th></tr></thead><tbody>
			${sortedMs.map((r: any) => {
				const c = r.progress >= 80 ? "#16a34a" : r.progress >= 50 ? "#2563eb" : "#ea580c";
				return `<tr><td><strong>${r.projectTitle}</strong></td><td>${r.customerName}</td><td style="text-align:right;font-weight:700;color:${c}">${r.progress}%</td><td style="text-align:right">${r.doneTasks}/${r.totalTasks}</td><td style="text-align:right">${r.completedPhases}/${r.totalPhases}</td><td style="font-size:11px;color:#6b7280">${r.nextPhase}${r.nextPhaseDue ? " · " + r.nextPhaseDue : ""}</td></tr>`;
			}).join("")}
			</tbody></table></div>`;
		}

		if (sel.includes("overdueTasks") && overdueCount > 0) {
			sectionsHtml += `<div class="section"><h2 class="section-title" style="color:#dc2626">Überfällige Tasks (${overdueCount})</h2>
			<table><thead><tr><th>Task</th><th>Projekt</th><th>Zugewiesen</th></tr></thead><tbody>
			${delayRiskData.overdueTasks.slice(0, 20).map((t: any) => `<tr><td>${t.title}</td><td>${t.projectTitle}</td><td>${t.assignedTo || "—"}</td></tr>`).join("")}
			</tbody></table>${overdueCount > 20 ? `<p class="text-muted">+ ${overdueCount - 20} weitere</p>` : ""}</div>`;
		}

		if (sel.includes("unassignedTasks") && unassignedCount > 0) {
			sectionsHtml += `<div class="section"><h2 class="section-title" style="color:#ea580c">Nicht zugewiesene Tasks (${unassignedCount})</h2>
			<table><thead><tr><th>Task</th><th>Projekt</th></tr></thead><tbody>
			${delayRiskData.unassignedTasks.slice(0, 15).map((t: any) => `<tr><td>${t.title}</td><td>${t.projectTitle}</td></tr>`).join("")}
			</tbody></table></div>`;
		}

		if (sel.includes("excessiveHours") && excessiveCount > 0) {
			const sortedEx = [...delayRiskData.excessiveHoursTasks].sort((a: any, b: any) => b.estimatedHours - a.estimatedHours);
			const avgEx = sortedEx.reduce((s: number, t: any) => s + t.estimatedHours, 0) / sortedEx.length;
			sectionsHtml += `<div class="section"><h2 class="section-title">Tasks mit erhöhtem Stundenaufwand (${excessiveCount})</h2>
			<table><thead><tr><th>Task</th><th>Projekt</th><th style="text-align:right">Geschätzte Std.</th></tr></thead><tbody>
			${sortedEx.slice(0, 15).map((t: any) => `<tr><td>${t.title}</td><td>${t.projectTitle}</td><td style="text-align:right;font-weight:600">${t.estimatedHours}h</td></tr>`).join("")}
			</tbody></table><p class="text-muted" style="margin-top:6px;">Ø ${fmt(avgEx)}h pro Task</p></div>`;
		}

		if (sel.includes("phasesBehind") && phasesBehindCount > 0) {
			sectionsHtml += `<div class="section"><h2 class="section-title">Phasen hinter Zeitplan (${phasesBehindCount})</h2>
			<table><thead><tr><th>Projekt</th><th>Phase</th><th>Geplantes Ende</th></tr></thead><tbody>
			${delayRiskData.phasesBehind.slice(0, 15).map((p: any) => `<tr><td>${p.projectTitle}</td><td>${p.phaseName}</td><td>${p.dueDate ? new Date(p.dueDate).toLocaleDateString("de-CH") : "—"}</td></tr>`).join("")}
			</tbody></table></div>`;
		}

		if (sel.includes("projectOverview") && totalProjects > 0) {
			const sortedPo = [..._projectStatusData].sort((a: any, b: any) => ({ overBudget: 0, behind: 1, onTrack: 2 } as any)[a.health] - ({ overBudget: 0, behind: 1, onTrack: 2 } as any)[b.health]);
			sectionsHtml += `<div class="section"><h2 class="section-title">Projektübersicht</h2>
			<div class="kpi-row">
				<div class="kpi"><div class="kpi-value" style="color:#2563eb">${totalProjects}</div><div class="kpi-label">Projekte total</div></div>
				<div class="kpi"><div class="kpi-value" style="color:#16a34a">${onTrackCount}</div><div class="kpi-label">Im Zeitplan</div></div>
				<div class="kpi"><div class="kpi-value" style="color:#ea580c">${behindCount}</div><div class="kpi-label">Verzögert</div></div>
				<div class="kpi"><div class="kpi-value" style="color:#dc2626">${overBudgetCount}</div><div class="kpi-label">Über Budget</div></div>
			</div>
			<table style="margin-top:14px;"><thead><tr><th>Projekt</th><th>Auftraggeber</th><th>Status</th><th style="text-align:right">Fortschritt</th><th>Projektstatus</th></tr></thead><tbody>
			${sortedPo.map((p: any) => {
				const hc = healthColor(p.health);
				const hl = p.health === "overBudget" ? "Über Budget" : p.health === "behind" ? "Verzögert" : "Im Zeitplan";
				return `<tr><td><strong>${p.title}</strong><br><span style="font-size:11px;color:#9ca3af">${p.projectManager}</span></td><td>${p.customerName}</td><td>${p.status}</td><td style="text-align:right;font-weight:600">${p.progress}%</td><td><span style="display:inline-block;padding:2px 10px;border-radius:9999px;font-size:11px;font-weight:600;background:${hc}22;color:${hc}">${hl}</span></td></tr>`;
			}).join("")}
			</tbody></table></div>`;
		}

		if (sel.includes("projectProgress") && totalProjects > 0) {
			const sortedPp = [..._projectStatusData].sort((a: any, b: any) => a.progress - b.progress);
			sectionsHtml += `<div class="section"><h2 class="section-title">Projektfortschritt</h2>
			<table><thead><tr><th>Projekt</th><th style="text-align:right">Tasks</th><th style="text-align:right">Überfällig</th><th style="text-align:right">Fortschritt</th><th style="min-width:90px"></th></tr></thead><tbody>
			${sortedPp.map((p: any) => {
				const c = p.progress >= 75 ? "#16a34a" : p.progress >= 40 ? "#2563eb" : "#ea580c";
				return `<tr><td><strong>${p.title}</strong></td><td style="text-align:right">${p.doneTasks}/${p.totalTasks}</td><td style="text-align:right;color:${p.overdueTasks > 0 ? "#dc2626" : "inherit"};font-weight:${p.overdueTasks > 0 ? 600 : 400}">${p.overdueTasks}</td><td style="text-align:right;font-weight:700;color:${c}">${p.progress}%</td><td>${bar(p.progress, c)}</td></tr>`;
			}).join("")}
			</tbody></table></div>`;
		}

		if (sel.includes("projectBudgetUsage") && totalProjects > 0) {
			const sortedBu = [..._projectStatusData].sort((a: any, b: any) => b.budgetUsage - a.budgetUsage);
			sectionsHtml += `<div class="section"><h2 class="section-title">Budgetnutzung pro Projekt</h2>
			<table><thead><tr><th>Projekt</th><th style="text-align:right">Geschätzte Kosten</th><th style="text-align:right">Budget</th><th style="text-align:right">Nutzung</th><th style="min-width:90px"></th></tr></thead><tbody>
			${sortedBu.map((p: any) => {
				const c = p.budgetUsage > 100 ? "#dc2626" : p.budgetUsage > 80 ? "#ea580c" : "#16a34a";
				return `<tr><td><strong>${p.title}</strong></td><td style="text-align:right">${fmtCurrency(p.estimatedCost)}</td><td style="text-align:right">${fmtCurrency(p.budget)}</td><td style="text-align:right;font-weight:700;color:${c}">${p.budgetUsage}%</td><td>${bar(p.budgetUsage, c)}</td></tr>`;
			}).join("")}
			</tbody></table></div>`;
		}

		// ── Risk & Recommendations HTML ──────────────────────────────────
		const riskHtml = risks.length > 0
			? risks.map((r) => {
				const lc = { high: "#dc2626", medium: "#ea580c", low: "#ca8a04" }[r.level];
				const lb = { high: "#fef2f2", medium: "#fff7ed", low: "#fefce8" }[r.level];
				const ll = { high: "🔴 Kritisch", medium: "🟠 Warnung", low: "🟡 Hinweis" }[r.level];
				return `<div style="padding:10px 14px;margin-bottom:8px;border-radius:10px;border-left:4px solid ${lc};background:${lb};font-size:13px;"><span style="font-weight:700;color:${lc}">${ll}</span> &nbsp;${r.text}</div>`;
			}).join("")
			: `<p class="text-muted">Keine kritischen Risiken identifiziert.</p>`;

		const recsHtml = recs.map((r, i) =>
			`<div style="padding:10px 14px;margin-bottom:8px;border-radius:10px;background:#f0f9ff;border-left:4px solid #3b82f6;font-size:13px;"><span style="font-weight:700;color:#2563eb">${i + 1}.</span> ${r}</div>`
		).join("");

		return `<!DOCTYPE html><html lang="de"><head><meta charset="utf-8"><title>${reportTitle} — OnTrack</title><style>
* { margin:0; padding:0; box-sizing:border-box; }
body { font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',system-ui,sans-serif; padding:40px 48px; color:#111827; font-size:13px; line-height:1.6; background:#fff; }
.report-header { border-bottom:3px solid #1e40af; padding-bottom:20px; margin-bottom:32px; }
.report-title { font-size:26px; font-weight:800; color:#1e3a8a; letter-spacing:-0.5px; }
.report-meta { font-size:12px; color:#6b7280; margin-top:6px; }
.report-meta span { margin-right:16px; }
.section { margin-bottom:32px; page-break-inside:avoid; }
.section-title { font-size:10px; font-weight:700; text-transform:uppercase; letter-spacing:0.08em; color:#6b7280; border-bottom:2px solid #e5e7eb; padding-bottom:7px; margin-bottom:12px; }
.exec-box { background:#f8faff; border:1px solid #dbeafe; border-radius:12px; padding:16px 20px; }
.exec-box ul { margin:0; padding-left:18px; }
.exec-box li { margin-bottom:6px; color:#374151; }
table { width:100%; border-collapse:collapse; margin-top:6px; font-size:13px; }
thead th { background:#f9fafb; font-weight:700; font-size:10px; text-transform:uppercase; letter-spacing:0.06em; color:#6b7280; padding:8px 12px; border-bottom:2px solid #e5e7eb; text-align:left; }
tbody td { padding:8px 12px; border-bottom:1px solid #f3f4f6; }
tbody tr:hover td { background:#f9fafb; }
.kpi-row { display:flex; gap:12px; flex-wrap:wrap; margin:10px 0; }
.kpi { border:1px solid #e5e7eb; border-radius:12px; padding:14px 20px; text-align:center; min-width:120px; background:#fafafa; }
.kpi-value { font-size:22px; font-weight:800; color:#111827; }
.kpi-label { font-size:11px; color:#6b7280; margin-top:3px; }
.badge { display:inline-block; padding:1px 8px; border-radius:9999px; font-size:10px; font-weight:600; margin-left:4px; }
.badge-warn { background:#fef3c7; color:#92400e; }
.badge-danger { background:#fee2e2; color:#991b1b; }
.text-muted { color:#9ca3af; font-style:italic; font-size:12px; }
.footer { margin-top:40px; padding-top:14px; border-top:2px solid #e5e7eb; font-size:11px; color:#9ca3af; display:flex; justify-content:space-between; }
@media print { body { padding:16px 20px; } .section { break-inside:avoid; } .section-title { page-break-after:avoid; } }
</style></head><body>
<div class="report-header">
	<div class="report-title">${reportTitle}</div>
	<div class="report-meta"><span>📅 ${dateFormatted}</span><span>🕐 ${time} Uhr</span><span>📊 OnTrack Portfolio-Bericht</span><span>📦 ${sel.length} Datensätze</span></div>
</div>
<div class="section">
	<div class="section-title">Executive Summary</div>
	<div class="exec-box"><ul>${execPoints.map((p) => `<li>${p}</li>`).join("")}</ul></div>
</div>
${sectionsHtml}
${risks.length > 0 ? `<div class="section"><div class="section-title">Risiken &amp; Auffälligkeiten</div>${riskHtml}</div>` : ""}
<div class="section"><div class="section-title">Empfehlungen</div>${recsHtml}</div>
<div class="footer"><span>OnTrack — Vertraulich · Für interne Zwecke</span><span>Erstellt ${date} ${time}</span></div>
</body></html>`;
	}

	function printBuilderReport() {
		const html = generateBuilderReportHtml();
		const w = window.open("", "_blank", "width=1000,height=900");
		if (!w) return;
		w.document.open();
		w.document.write(html);
		w.document.close();
		w.focus();
		w.print();
	}

	function previewBuilderReport() {
		const html = generateBuilderReportHtml();
		const bodyMatch = html.match(/<body[^>]*>([\s\S]*)<\/body>/i);
		printPreviewHtml = bodyMatch ? bodyMatch[1] : html;
		showPrintPreview = true;
	}

	function openPrintPreview() {
		if (currentView === "builder") {
			previewBuilderReport();
		} else {
			printCurrentReport();
		}
	}

	function printProjectStateReport(project: any) {
		const hourlyRates = loadHourlyRates();
		const html = buildProjectStateReportHtml(project, hourlyRates, "", "de");
		const w = window.open("", "_blank", "width=1000,height=900");
		if (!w) return;
		w.document.open();
		w.document.write(html);
		w.document.close();
		w.focus();
		w.print();
	}

	// ── Icon Definitions ─────────────────────────────────────────────────
	type IconId = "currency" | "users" | "trophy" | "warning" | "chart" | "clock" | "clipboard" | "folder" | "target" | "lightning" | "shield" | "star";

	interface IconDef {
		id: IconId;
		path: string;
	}

	const ICONS: IconDef[] = [
		{ id: "currency", path: "M12 8c-1.657 0-3 .895-3 2s1.343 2 3 2 3 .895 3 2-1.343 2-3 2m0-8c1.11 0 2.08.402 2.599 1M12 8V7m0 1v8m0 0v1m0-1c-1.11 0-2.08-.402-2.599-1M21 12a9 9 0 11-18 0 9 9 0 0118 0z" },
		{ id: "users", path: "M17 20h5v-2a3 3 0 00-5.356-1.857M17 20H7m10 0v-2c0-.656-.126-1.283-.356-1.857M7 20H2v-2a3 3 0 015.356-1.857M7 20v-2c0-.656.126-1.283.356-1.857m0 0a5.002 5.002 0 019.288 0M15 7a3 3 0 11-6 0 3 3 0 016 0zm6 3a2 2 0 11-4 0 2 2 0 014 0zM7 10a2 2 0 11-4 0 2 2 0 014 0z" },
		{ id: "trophy", path: "M5 3h14M9 3v2a4 4 0 004 4h0a4 4 0 004-4V3M5 3a2 2 0 00-2 2v1a3 3 0 003 3m8-6a2 2 0 012 2v1a3 3 0 01-3 3m-4 0v3m0 0h4m-4 0H8m4 3H8a2 2 0 00-2 2v1h12v-1a2 2 0 00-2-2h-4" },
		{ id: "warning", path: "M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z" },
		{ id: "chart", path: "M9 19v-6a2 2 0 00-2-2H5a2 2 0 00-2 2v6a2 2 0 002 2h2a2 2 0 002-2zm0 0V9a2 2 0 012-2h2a2 2 0 012 2v10m-6 0a2 2 0 002 2h2a2 2 0 002-2m0 0V5a2 2 0 012-2h2a2 2 0 012 2v14a2 2 0 01-2 2h-2a2 2 0 01-2-2z" },
		{ id: "clock", path: "M12 8v4l3 3m6-3a9 9 0 11-18 0 9 9 0 0118 0z" },
		{ id: "clipboard", path: "M9 5H7a2 2 0 00-2 2v12a2 2 0 002 2h10a2 2 0 002-2V7a2 2 0 00-2-2h-2M9 5a2 2 0 002 2h2a2 2 0 002-2M9 5a2 2 0 012-2h2a2 2 0 012 2m-6 9l2 2 4-4" },
		{ id: "folder", path: "M3 7v10a2 2 0 002 2h14a2 2 0 002-2V9a2 2 0 00-2-2h-6l-2-2H5a2 2 0 00-2 2z" },
		{ id: "target", path: "M9 12l2 2 4-4m5.618-4.016A11.955 11.955 0 0112 2.944a11.955 11.955 0 01-8.618 3.04A12.02 12.02 0 003 9c0 5.591 3.824 10.29 9 11.622 5.176-1.332 9-6.03 9-11.622 0-1.042-.133-2.052-.382-3.016z" },
		{ id: "lightning", path: "M13 10V3L4 14h7v7l9-11h-7z" },
		{ id: "shield", path: "M9 12l2 2 4-4m5.618-4.016A11.955 11.955 0 0112 2.944a11.955 11.955 0 01-8.618 3.04A12.02 12.02 0 003 9c0 5.591 3.824 10.29 9 11.622 5.176-1.332 9-6.03 9-11.622 0-1.042-.133-2.052-.382-3.016z" },
		{ id: "star", path: "M11.049 2.927c.3-.921 1.603-.921 1.902 0l1.519 4.674a1 1 0 00.95.69h4.915c.969 0 1.371 1.24.588 1.81l-3.976 2.888a1 1 0 00-.363 1.118l1.518 4.674c.3.922-.755 1.688-1.538 1.118l-3.976-2.888a1 1 0 00-1.176 0l-3.976 2.888c-.783.57-1.838-.197-1.538-1.118l1.518-4.674a1 1 0 00-.363-1.118l-3.976-2.888c-.784-.57-.38-1.81.588-1.81h4.914a1 1 0 00.951-.69l1.519-4.674z" },
	];

	function getIconPath(id: IconId): string {
		return ICONS.find((i) => i.id === id)?.path ?? ICONS[0].path;
	}

	// ── Custom Report Builder ────────────────────────────────────────────
	type DataSetId = "budgetVsActual" | "hoursPerEmployee" | "costPerPhase" | "forecastedOverrun"
		| "hoursAssigned" | "overloadDetection" | "capacityPlanning" | "upcomingDeadlines" | "taskDistribution"
		| "milestonesAchieved" | "deliverables" | "overdueTasks" | "unassignedTasks" | "excessiveHours" | "phasesBehind"
		| "projectOverview" | "projectProgress" | "projectBudgetUsage";

	interface DataSetDef {
		id: DataSetId;
		label: string;
		category: string;
		color: string;
	}

	let availableDataSets = $derived<DataSetDef[]>([
		{ id: "budgetVsActual", label: $t.reports.budgetVsActual, category: $t.reports.budgetReport, color: "bg-emerald-100 text-emerald-700" },
		{ id: "hoursPerEmployee", label: $t.reports.hoursPerEmployee, category: $t.reports.budgetReport, color: "bg-emerald-100 text-emerald-700" },
		{ id: "costPerPhase", label: $t.reports.costPerPhase, category: $t.reports.budgetReport, color: "bg-emerald-100 text-emerald-700" },
		{ id: "forecastedOverrun", label: $t.reports.forecastedOverrun, category: $t.reports.budgetReport, color: "bg-emerald-100 text-emerald-700" },
		{ id: "hoursAssigned", label: $t.reports.hoursAssigned, category: $t.reports.workloadReport, color: "bg-blue-100 text-blue-700" },
		{ id: "overloadDetection", label: $t.reports.overloadDetection, category: $t.reports.workloadReport, color: "bg-blue-100 text-blue-700" },
		{ id: "capacityPlanning", label: $t.reports.capacityPlanning, category: $t.reports.workloadReport, color: "bg-blue-100 text-blue-700" },
		{ id: "upcomingDeadlines", label: $t.reports.upcomingDeadlines, category: $t.reports.workloadReport, color: "bg-blue-100 text-blue-700" },
		{ id: "taskDistribution", label: $t.reports.taskDistribution, category: $t.reports.workloadReport, color: "bg-blue-100 text-blue-700" },
		{ id: "milestonesAchieved", label: $t.reports.milestonesAchieved, category: $t.reports.milestoneReport, color: "bg-purple-100 text-purple-700" },
		{ id: "deliverables", label: $t.reports.deliverables, category: $t.reports.milestoneReport, color: "bg-purple-100 text-purple-700" },
		{ id: "overdueTasks", label: $t.reports.overdueTasks, category: $t.reports.delayRiskReport, color: "bg-red-100 text-red-700" },
		{ id: "unassignedTasks", label: $t.reports.unassignedTasks, category: $t.reports.delayRiskReport, color: "bg-red-100 text-red-700" },
		{ id: "excessiveHours", label: $t.reports.excessiveHours, category: $t.reports.delayRiskReport, color: "bg-red-100 text-red-700" },
		{ id: "phasesBehind", label: $t.reports.phasesBehind, category: $t.reports.delayRiskReport, color: "bg-red-100 text-red-700" },
		{ id: "projectOverview", label: $t.reports.projectOverview, category: $t.reports.projectStatusReport, color: "bg-teal-100 text-teal-700" },
		{ id: "projectProgress", label: $t.reports.projectProgress, category: $t.reports.projectStatusReport, color: "bg-teal-100 text-teal-700" },
		{ id: "projectBudgetUsage", label: $t.reports.projectBudgetUsage, category: $t.reports.projectStatusReport, color: "bg-teal-100 text-teal-700" },
	]);

	let selectedDataSets = $state<DataSetId[]>([]);
	let customReportName = $state("");
	let draggedItem = $state<DataSetId | null>(null);
	let dragOverTarget = $state(false);

	interface CustomTemplate {
		id: number;
		name: string;
		icon: IconId;
		dataSets: DataSetId[];
	}
	let customTemplates = $state<CustomTemplate[]>(loadTemplates());
	let selectedIcon = $state<IconId>("chart");

	function loadTemplates(): CustomTemplate[] {
		if (typeof window === "undefined") return [];
		const stored = localStorage.getItem("custom_report_templates");
		if (stored) {
			try { return JSON.parse(stored); } catch { return []; }
		}
		return [];
	}

	function saveTemplates() {
		if (typeof window !== "undefined") {
			localStorage.setItem("custom_report_templates", JSON.stringify(customTemplates));
		}
	}

	function handleDragStart(id: DataSetId) {
		draggedItem = id;
	}

	function handleDragOver(e: DragEvent) {
		e.preventDefault();
		dragOverTarget = true;
	}

	function handleDragLeave() {
		dragOverTarget = false;
	}

	function handleDrop(e: DragEvent) {
		e.preventDefault();
		dragOverTarget = false;
		if (draggedItem && !selectedDataSets.includes(draggedItem)) {
			selectedDataSets = [...selectedDataSets, draggedItem];
		}
		draggedItem = null;
	}

	function addDataSet(id: DataSetId) {
		if (!selectedDataSets.includes(id)) {
			selectedDataSets = [...selectedDataSets, id];
		}
	}

	function removeDataSet(id: DataSetId) {
		selectedDataSets = selectedDataSets.filter((d) => d !== id);
	}

	function saveAsTemplate() {
		const name = customReportName.trim() || "Custom Report";
		const id = Date.now();
		customTemplates = [...customTemplates, { id, name, icon: selectedIcon, dataSets: [...selectedDataSets] }];
		saveTemplates();
	}

	function deleteTemplate(id: number) {
		customTemplates = customTemplates.filter((t) => t.id !== id);
		saveTemplates();
	}

	function loadTemplate(tpl: CustomTemplate) {
		selectedDataSets = [...tpl.dataSets];
		customReportName = tpl.name;
		selectedIcon = tpl.icon ?? "chart";
		currentView = "builder";
	}

	function getStatusColor(status: string): string {
		switch (status) {
			case "Done": return "bg-green-100 text-green-700";
			case "In Progress": return "bg-blue-100 text-blue-700";
			case "To Do": return "bg-gray-100 text-gray-700";
			case "Pending": return "bg-orange-100 text-orange-700";
			default: return "bg-gray-100 text-gray-700";
		}
	}
</script>

<div class="min-h-screen bg-gray-50 font-sans">
	<div class="mx-auto flex max-w-7xl flex-col gap-6 p-6">

		<!-- Header -->
		<section class="overflow-hidden rounded-4xl border border-gray-200 bg-white shadow-sm">
			<div class="flex flex-wrap items-center justify-between gap-4 p-6 lg:p-8">
				<div>
					<p class="text-sm uppercase tracking-[0.24em] text-blue-600">{$t.nav.reports}</p>
					<h1 class="mt-2 text-3xl font-bold tracking-tight text-gray-900">{$t.reports.title}</h1>
					<p class="mt-1 text-sm text-gray-500">{$t.reports.subtitle}</p>
				</div>
				<div class="flex gap-2">
					{#if currentView !== "templates"}
						<button onclick={openPrintPreview} class="rounded-xl border border-gray-200 px-4 py-2 text-sm font-medium text-gray-700 transition hover:bg-gray-50" title={$t.reports.printReport}>
							<svg xmlns="http://www.w3.org/2000/svg" class="inline h-4 w-4 mr-1" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M17 17h2a2 2 0 002-2v-4a2 2 0 00-2-2H5a2 2 0 00-2 2v4a2 2 0 002 2h2m2 4h6a2 2 0 002-2v-4a2 2 0 00-2-2H9a2 2 0 00-2 2v4a2 2 0 002 2zm8-12V5a2 2 0 00-2-2H9a2 2 0 00-2 2v4h10z" /></svg>
							{$t.reports.printReport}
						</button>
						<button onclick={() => (currentView = "templates")} class="rounded-xl border border-gray-200 px-4 py-2 text-sm font-medium text-gray-700 transition hover:bg-gray-50">
							← {$t.reports.templates}
						</button>
					{/if}
				</div>
			</div>
		</section>

		<!-- ═══════════════════ Template Gallery ═══════════════════ -->
		{#if currentView === "templates"}
			<section class="grid gap-4 md:grid-cols-2">
				<!-- Budget & Cost Report -->
				<button onclick={() => (currentView = "budget")} class="group rounded-3xl border border-gray-200 bg-white p-6 text-left shadow-sm transition hover:border-emerald-300 hover:shadow-md">
					<div class="flex items-center gap-3">
						<span class="flex h-10 w-10 items-center justify-center rounded-xl bg-emerald-100 text-emerald-600">
							<svg xmlns="http://www.w3.org/2000/svg" class="h-5 w-5" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d={getIconPath("currency")} /></svg>
						</span>
						<h3 class="text-lg font-semibold text-gray-900">{$t.reports.budgetReport}</h3>
					</div>
					<p class="mt-3 text-sm text-gray-500">{$t.reports.budgetReportDesc}</p>
					<div class="mt-4 flex flex-wrap gap-2">
						<span class="rounded-full bg-emerald-50 px-2.5 py-1 text-xs font-medium text-emerald-700">{$t.reports.budgetVsActual}</span>
						<span class="rounded-full bg-emerald-50 px-2.5 py-1 text-xs font-medium text-emerald-700">{$t.reports.hoursPerEmployee}</span>
						<span class="rounded-full bg-emerald-50 px-2.5 py-1 text-xs font-medium text-emerald-700">{$t.reports.costPerPhase}</span>
						<span class="rounded-full bg-emerald-50 px-2.5 py-1 text-xs font-medium text-emerald-700">{$t.reports.forecastedOverrun}</span>
					</div>
				</button>

				<!-- Employee Workload Report -->
				<button onclick={() => (currentView = "workload")} class="group rounded-3xl border border-gray-200 bg-white p-6 text-left shadow-sm transition hover:border-blue-300 hover:shadow-md">
					<div class="flex items-center gap-3">
						<span class="flex h-10 w-10 items-center justify-center rounded-xl bg-blue-100 text-blue-600">
							<svg xmlns="http://www.w3.org/2000/svg" class="h-5 w-5" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d={getIconPath("users")} /></svg>
						</span>
						<h3 class="text-lg font-semibold text-gray-900">{$t.reports.workloadReport}</h3>
					</div>
					<p class="mt-3 text-sm text-gray-500">{$t.reports.workloadReportDesc}</p>
					<div class="mt-4 flex flex-wrap gap-2">
						<span class="rounded-full bg-blue-50 px-2.5 py-1 text-xs font-medium text-blue-700">{$t.reports.hoursAssigned}</span>
						<span class="rounded-full bg-blue-50 px-2.5 py-1 text-xs font-medium text-blue-700">{$t.reports.overloadDetection}</span>
						<span class="rounded-full bg-blue-50 px-2.5 py-1 text-xs font-medium text-blue-700">{$t.reports.upcomingDeadlines}</span>
						<span class="rounded-full bg-blue-50 px-2.5 py-1 text-xs font-medium text-blue-700">{$t.reports.taskDistribution}</span>
					</div>
				</button>

				<!-- Customer Milestone Report -->
				<button onclick={() => (currentView = "milestone")} class="group rounded-3xl border border-gray-200 bg-white p-6 text-left shadow-sm transition hover:border-purple-300 hover:shadow-md">
					<div class="flex items-center gap-3">
						<span class="flex h-10 w-10 items-center justify-center rounded-xl bg-purple-100 text-purple-600">
							<svg xmlns="http://www.w3.org/2000/svg" class="h-5 w-5" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d={getIconPath("trophy")} /></svg>
						</span>
						<h3 class="text-lg font-semibold text-gray-900">{$t.reports.milestoneReport}</h3>
					</div>
					<p class="mt-3 text-sm text-gray-500">{$t.reports.milestoneReportDesc}</p>
					<div class="mt-4 flex flex-wrap gap-2">
						<span class="rounded-full bg-purple-50 px-2.5 py-1 text-xs font-medium text-purple-700">{$t.reports.milestonesAchieved}</span>
						<span class="rounded-full bg-purple-50 px-2.5 py-1 text-xs font-medium text-purple-700">{$t.reports.deliverables}</span>
						<span class="rounded-full bg-purple-50 px-2.5 py-1 text-xs font-medium text-purple-700">{$t.reports.acceptanceCriteria}</span>
						<span class="rounded-full bg-purple-50 px-2.5 py-1 text-xs font-medium text-purple-700">{$t.reports.nextMilestone}</span>
					</div>
				</button>

				<!-- Delay & Risk Report -->
				<button onclick={() => (currentView = "delayrisk")} class="group rounded-3xl border border-gray-200 bg-white p-6 text-left shadow-sm transition hover:border-red-300 hover:shadow-md">
					<div class="flex items-center gap-3">
						<span class="flex h-10 w-10 items-center justify-center rounded-xl bg-red-100 text-red-600">
							<svg xmlns="http://www.w3.org/2000/svg" class="h-5 w-5" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d={getIconPath("warning")} /></svg>
						</span>
						<h3 class="text-lg font-semibold text-gray-900">{$t.reports.delayRiskReport}</h3>
					</div>
					<p class="mt-3 text-sm text-gray-500">{$t.reports.delayRiskReportDesc}</p>
					<div class="mt-4 flex flex-wrap gap-2">
						<span class="rounded-full bg-red-50 px-2.5 py-1 text-xs font-medium text-red-700">{$t.reports.overdueTasks}</span>
						<span class="rounded-full bg-red-50 px-2.5 py-1 text-xs font-medium text-red-700">{$t.reports.unassignedTasks}</span>
						<span class="rounded-full bg-red-50 px-2.5 py-1 text-xs font-medium text-red-700">{$t.reports.excessiveHours}</span>
						<span class="rounded-full bg-red-50 px-2.5 py-1 text-xs font-medium text-red-700">{$t.reports.phasesBehind}</span>
					</div>
				</button>

				<!-- Project Status Report -->
				<button onclick={() => (currentView = "projectstatus")} class="group rounded-3xl border border-gray-200 bg-white p-6 text-left shadow-sm transition hover:border-teal-300 hover:shadow-md">
					<div class="flex items-center gap-3">
						<span class="flex h-10 w-10 items-center justify-center rounded-xl bg-teal-100 text-teal-600">
							<svg xmlns="http://www.w3.org/2000/svg" class="h-5 w-5" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d={getIconPath("clipboard")} /></svg>
						</span>
						<h3 class="text-lg font-semibold text-gray-900">{$t.reports.projectStatusReport}</h3>
					</div>
					<p class="mt-3 text-sm text-gray-500">{$t.reports.projectStatusReportDesc}</p>
					<div class="mt-4 flex flex-wrap gap-2">
						<span class="rounded-full bg-teal-50 px-2.5 py-1 text-xs font-medium text-teal-700">{$t.reports.projectOverview}</span>
						<span class="rounded-full bg-teal-50 px-2.5 py-1 text-xs font-medium text-teal-700">{$t.reports.projectProgress}</span>
						<span class="rounded-full bg-teal-50 px-2.5 py-1 text-xs font-medium text-teal-700">{$t.reports.projectBudgetUsage}</span>
						<span class="rounded-full bg-teal-50 px-2.5 py-1 text-xs font-medium text-teal-700">{$t.reports.printReport}</span>
					</div>
				</button>
			</section>

			<!-- Custom Report Builder Entry -->
			<section class="rounded-3xl border border-gray-200 bg-white p-6 shadow-sm">
				<div class="flex flex-wrap items-center justify-between gap-3">
					<div>
						<h2 class="text-xl font-semibold text-gray-900">{$t.reports.customReport}</h2>
						<p class="mt-1 text-sm text-gray-500">{$t.reports.dragHint}</p>
					</div>
					<button onclick={() => (currentView = "builder")} class="rounded-xl bg-blue-600 px-5 py-2.5 text-sm font-semibold text-white shadow-sm transition hover:bg-blue-700">
						+ {$t.reports.createCustom}
					</button>
				</div>

				{#if customTemplates.length > 0}
					<div class="mt-4 space-y-2">
						<h3 class="text-sm font-semibold uppercase tracking-[0.15em] text-gray-500">{$t.reports.customTemplates}</h3>
						{#each customTemplates as tpl (tpl.id)}
							<div class="flex items-center justify-between rounded-2xl border border-gray-200 bg-gray-50 px-4 py-3">
								<div class="flex items-center gap-3">
									<span class="flex h-8 w-8 items-center justify-center rounded-lg bg-blue-100 text-blue-600">
										<svg xmlns="http://www.w3.org/2000/svg" class="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d={getIconPath(tpl.icon ?? "chart")} /></svg>
									</span>
									<div>
										<p class="text-sm font-medium text-gray-900">{tpl.name}</p>
										<p class="text-xs text-gray-500">{tpl.dataSets.length} data sets</p>
									</div>
								</div>
								<div class="flex gap-2">
									<button onclick={() => loadTemplate(tpl)} class="rounded-lg bg-blue-50 px-3 py-1.5 text-xs font-medium text-blue-700 transition hover:bg-blue-100">
										{$t.reports.preview}
									</button>
									<button onclick={() => deleteTemplate(tpl.id)} class="rounded-lg bg-red-50 px-3 py-1.5 text-xs font-medium text-red-600 transition hover:bg-red-100">
										{$t.reports.deleteTemplate}
									</button>
								</div>
							</div>
						{/each}
					</div>
				{:else}
					<p class="mt-4 text-sm text-gray-400">{$t.reports.noCustomTemplates}</p>
				{/if}
			</section>

		<!-- ═══════════════════ Budget & Cost Report ═══════════════════ -->
		{:else if currentView === "budget"}
			<div id="report-printable" class="space-y-6">
			<section class="grid gap-4 md:grid-cols-2 xl:grid-cols-4">
				<article class="rounded-3xl border border-gray-200 bg-white p-5 shadow-sm">
					<p class="text-sm font-medium text-gray-500">{$t.reports.total} Budget</p>
					<p class="mt-2 text-3xl font-bold text-gray-900">{fmtCurrency($budgetData.totalBudget)}</p>
				</article>
				<article class="rounded-3xl border border-gray-200 bg-white p-5 shadow-sm">
					<p class="text-sm font-medium text-gray-500">{$t.reports.total} {$t.common.cost}</p>
					<p class="mt-2 text-3xl font-bold text-blue-700">{fmtCurrency($budgetData.totalEstimatedCost)}</p>
				</article>
				<article class="rounded-3xl border border-gray-200 bg-white p-5 shadow-sm">
					<p class="text-sm font-medium text-gray-500">{$t.reports.total} {$t.common.hours}</p>
					<p class="mt-2 text-3xl font-bold text-green-700">{fmt($budgetData.totalEstimatedHours)}h</p>
				</article>
				<article class="rounded-3xl border border-gray-200 bg-white p-5 shadow-sm">
					<p class="text-sm font-medium text-gray-500">{$t.reports.forecastedOverrun}</p>
					<p class="mt-2 text-3xl font-bold {$budgetData.overrun > 0 ? 'text-red-600' : 'text-green-700'}">{fmtCurrency($budgetData.overrun)}</p>
				</article>
			</section>

			<div class="grid gap-6 xl:grid-cols-2">
				<!-- Hours per Employee -->
				<article class="rounded-3xl border border-gray-200 bg-white p-6 shadow-sm">
					<h3 class="text-lg font-semibold text-gray-900">{$t.reports.hoursPerEmployee}</h3>
					<div class="mt-4 max-h-80 space-y-2 overflow-y-auto">
						{#each $budgetData.hoursPerEmployee as row (row.name)}
							{@const pct = $budgetData.totalEstimatedHours > 0 ? (row.hours / $budgetData.totalEstimatedHours) * 100 : 0}
							<div class="rounded-xl border border-gray-200 bg-gray-50 px-4 py-3">
								<div class="flex items-center justify-between">
									<p class="text-sm font-medium text-gray-900">{row.name}</p>
									<p class="text-sm font-semibold text-gray-700">{fmt(row.hours)}h</p>
								</div>
								<div class="mt-2 h-2 w-full rounded-full bg-gray-200">
									<div class="h-2 rounded-full bg-emerald-500" style="width: {Math.min(pct, 100)}%"></div>
								</div>
							</div>
						{/each}
					</div>
				</article>

				<!-- Cost per Phase -->
				<article class="rounded-3xl border border-gray-200 bg-white p-6 shadow-sm">
					<h3 class="text-lg font-semibold text-gray-900">{$t.reports.costPerPhase}</h3>
					<div class="mt-4 space-y-3">
						{#each $budgetData.costPerPhase as row (row.phase)}
							<div class="rounded-xl border border-gray-200 bg-gray-50 px-4 py-3">
								<div class="flex items-center justify-between">
									<p class="text-sm font-medium text-gray-900">{row.phase}</p>
									<div class="text-right">
										<p class="text-sm font-semibold text-gray-700">{fmtCurrency(row.cost)}</p>
										<p class="text-xs text-gray-500">{fmt(row.hours)}h</p>
									</div>
								</div>
							</div>
						{/each}
					</div>
				</article>
			</div>

			</div>

		<!-- ═══════════════════ Employee Workload Report ═══════════════════ -->
		{:else if currentView === "workload"}
			<div id="report-printable" class="space-y-6">
			<section class="grid gap-4 md:grid-cols-3">
				<article class="rounded-3xl border border-gray-200 bg-white p-5 shadow-sm">
					<p class="text-sm font-medium text-gray-500">{$t.reports.total} {$t.nav.tasks}</p>
					<p class="mt-2 text-4xl font-bold text-gray-900">{$workloadData.totalTasks}</p>
				</article>
				<article class="rounded-3xl border border-gray-200 bg-white p-5 shadow-sm">
					<p class="text-sm font-medium text-gray-500">{$t.reports.overloadDetection}</p>
					<p class="mt-2 text-4xl font-bold text-red-600">{$workloadData.employeeWorkload.filter((e) => e.overloaded).length}</p>
				</article>
				<article class="rounded-3xl border border-gray-200 bg-white p-5 shadow-sm">
					<p class="text-sm font-medium text-gray-500">{$t.reports.upcomingDeadlines}</p>
					<p class="mt-2 text-4xl font-bold text-orange-600">{$workloadData.upcomingDeadlines.length}</p>
				</article>
			</section>

			<div class="grid gap-6 xl:grid-cols-2">
				<!-- Hours Assigned per Employee -->
				<article class="rounded-3xl border border-gray-200 bg-white p-6 shadow-sm">
					<h3 class="text-lg font-semibold text-gray-900">{$t.reports.hoursAssigned}</h3>
					<div class="mt-4 max-h-96 space-y-2 overflow-y-auto">
						{#each $workloadData.employeeWorkload as row (row.name)}
							{@const utilization = row.monthlyCapacity > 0 ? Math.round((row.assigned / row.monthlyCapacity) * 100) : 0}
							<div class="rounded-xl border px-4 py-3 {row.overloaded ? 'border-red-200 bg-red-50' : 'border-gray-200 bg-gray-50'}">
								<div class="flex items-center justify-between">
									<div>
										<p class="text-sm font-medium text-gray-900">{row.name}</p>
										<p class="text-xs text-gray-500">{row.employmentPercent}% · {row.weeklyCapacity}h/{$t.reports.week}</p>
									</div>
									<div class="text-right">
										<p class="text-sm font-semibold {row.overloaded ? 'text-red-600' : 'text-gray-700'}">{fmt(row.assigned)}h / {fmt(row.monthlyCapacity)}h</p>
										<span class="text-xs font-semibold {utilization > 100 ? 'text-red-600' : utilization > 80 ? 'text-orange-600' : 'text-green-600'}">{utilization}% {$t.reports.utilization}</span>
									</div>
								</div>
								<div class="mt-2 h-2 w-full rounded-full bg-gray-200">
									<div class="h-2 rounded-full {utilization > 100 ? 'bg-red-500' : utilization > 80 ? 'bg-orange-400' : 'bg-blue-500'}" style="width: {Math.min(utilization, 100)}%"></div>
								</div>
							</div>
						{/each}
					</div>
				</article>

				<!-- Task Distribution + Upcoming Deadlines -->
				<div class="flex flex-col gap-6">
					<article class="rounded-3xl border border-gray-200 bg-white p-6 shadow-sm">
						<h3 class="text-lg font-semibold text-gray-900">{$t.reports.taskDistribution}</h3>
						<div class="mt-4 grid grid-cols-2 gap-3">
							{#each $workloadData.taskDistribution as row (row.status)}
								<div class="rounded-xl border border-gray-200 bg-gray-50 px-4 py-3 text-center">
									<p class="text-2xl font-bold text-gray-900">{row.count}</p>
									<span class="mt-1 inline-block rounded-full px-2.5 py-0.5 text-xs font-semibold {getStatusColor(row.status)}">{row.status}</span>
								</div>
							{/each}
						</div>
					</article>

					<article class="rounded-3xl border border-gray-200 bg-white p-6 shadow-sm">
						<h3 class="text-lg font-semibold text-gray-900">{$t.reports.upcomingDeadlines}</h3>
						<div class="mt-4 max-h-52 space-y-2 overflow-y-auto">
							{#each $workloadData.upcomingDeadlines as task (task.taskID)}
								<div class="rounded-xl border border-orange-200 bg-orange-50 px-3 py-2">
									<p class="text-sm font-medium text-gray-900">{task.title}</p>
									<p class="text-xs text-gray-500">{task.projectTitle} · {task.assignedTo} · {new Date(task.dueDate!).toLocaleDateString("de-CH")}</p>
								</div>
							{/each}
							{#if $workloadData.upcomingDeadlines.length === 0}
								<p class="text-sm text-gray-400">—</p>
							{/if}
						</div>
					</article>
				</div>
			</div>

			</div>

		<!-- ═══════════════════ Customer Milestone Report ═══════════════════ -->
		{:else if currentView === "milestone"}
			<div id="report-printable" class="space-y-6">
			<section class="space-y-3">
				{#each $milestoneData as row (row.projectTitle)}
					<article class="rounded-3xl border border-gray-200 bg-white p-5 shadow-sm">
						<div class="flex flex-col gap-4 lg:flex-row lg:items-center lg:justify-between">
							<div class="min-w-0 flex-1">
								<p class="text-base font-semibold text-gray-900">{row.projectTitle}</p>
								<p class="text-sm text-gray-500">{row.customerName}</p>
							</div>
							<div class="flex flex-wrap items-center gap-4">
								<div class="text-center">
									<p class="text-2xl font-bold text-blue-700">{row.progress}%</p>
									<p class="text-xs text-gray-500">{row.doneTasks}/{row.totalTasks} tasks</p>
								</div>
								<div class="text-center">
									<p class="text-2xl font-bold text-purple-700">{row.completedPhases}/{row.totalPhases}</p>
									<p class="text-xs text-gray-500">Phases</p>
								</div>
								<div class="min-w-28 text-center">
									<p class="text-sm font-semibold text-gray-900">{row.nextPhase}</p>
									<p class="text-xs text-gray-500">{row.nextPhaseDue}</p>
								</div>
							</div>
						</div>
						<div class="mt-3 h-2 w-full rounded-full bg-gray-200">
							<div class="h-2 rounded-full bg-purple-500" style="width: {row.progress}%"></div>
						</div>
					</article>
				{/each}
			</section>

			</div>

		<!-- ═══════════════════ Delay & Risk Report ═══════════════════ -->
		{:else if currentView === "delayrisk"}
			<div id="report-printable" class="space-y-6">
			<section class="grid gap-4 md:grid-cols-2 xl:grid-cols-4">
				<article class="rounded-3xl border border-red-200 bg-red-50 p-5 shadow-sm">
					<p class="text-sm font-medium text-red-600">{$t.reports.overdueTasks}</p>
					<p class="mt-2 text-4xl font-bold text-red-700">{delayRiskData.overdueTasks.length}</p>
				</article>
				<article class="rounded-3xl border border-orange-200 bg-orange-50 p-5 shadow-sm">
					<p class="text-sm font-medium text-orange-600">{$t.reports.unassignedTasks}</p>
					<p class="mt-2 text-4xl font-bold text-orange-700">{delayRiskData.unassignedTasks.length}</p>
				</article>
				<article class="rounded-3xl border border-yellow-200 bg-yellow-50 p-5 shadow-sm">
					<p class="text-sm font-medium text-yellow-700">{$t.reports.excessiveHours}</p>
					<p class="mt-2 text-4xl font-bold text-yellow-800">{delayRiskData.excessiveHoursTasks.length}</p>
				</article>
				<article class="rounded-3xl border border-gray-200 bg-white p-5 shadow-sm">
					<p class="text-sm font-medium text-gray-500">{$t.reports.phasesBehind}</p>
					<p class="mt-2 text-4xl font-bold text-gray-900">{delayRiskData.phasesBehind.length}</p>
				</article>
			</section>

			<div class="grid gap-6 xl:grid-cols-2">
				<!-- Overdue Tasks -->
				<article class="rounded-3xl border border-gray-200 bg-white p-6 shadow-sm">
					<h3 class="text-lg font-semibold text-red-700">{$t.reports.overdueTasks}</h3>
					<div class="mt-4 max-h-96 space-y-2 overflow-y-auto">
						{#each delayRiskData.overdueTasks.slice(0, 20) as task (task.taskID)}
							{@const daysOverdue = Math.floor((Date.now() - new Date(task.dueDate!).getTime()) / (1000 * 60 * 60 * 24))}
							<div class="rounded-xl border border-red-200 bg-red-50 px-4 py-3">
								<div class="flex items-center justify-between">
									<div>
										<p class="text-sm font-medium text-gray-900">{task.title}</p>
										<p class="text-xs text-gray-500">{task.projectTitle} · {task.assignedTo}</p>
									</div>
									<span class="rounded-full bg-red-100 px-2.5 py-1 text-xs font-semibold text-red-700">
										{daysOverdue}d overdue
									</span>
								</div>
							</div>
						{/each}
						{#if delayRiskData.overdueTasks.length === 0}
							<p class="text-sm text-gray-400">—</p>
						{/if}
					</div>
				</article>

				<!-- Phases Behind Schedule -->
				<article class="rounded-3xl border border-gray-200 bg-white p-6 shadow-sm">
					<h3 class="text-lg font-semibold text-gray-900">{$t.reports.phasesBehind}</h3>
					<div class="mt-4 max-h-96 space-y-2 overflow-y-auto">
						{#each delayRiskData.phasesBehind.slice(0, 20) as phase (phase.phaseid)}
							<div class="rounded-xl border border-gray-200 bg-gray-50 px-4 py-3">
								<div class="flex items-center justify-between">
									<div>
										<p class="text-sm font-medium text-gray-900">{phase.projectTitle}</p>
										<p class="text-xs text-gray-500">{phase.phaseName}</p>
									</div>
									<p class="text-xs text-gray-500">{phase.dueDate ? new Date(phase.dueDate).toLocaleDateString("de-CH") : ""}</p>
								</div>
							</div>
						{/each}
						{#if delayRiskData.phasesBehind.length === 0}
							<p class="text-sm text-gray-400">—</p>
						{/if}
					</div>
				</article>

				<!-- Excessive Hours -->
				<article class="rounded-3xl border border-gray-200 bg-white p-6 shadow-sm">
					<h3 class="text-lg font-semibold text-yellow-700">{$t.reports.excessiveHours}</h3>
					<div class="mt-4 max-h-64 space-y-2 overflow-y-auto">
						{#each delayRiskData.excessiveHoursTasks.slice(0, 15) as task (task.taskID)}
							<div class="rounded-xl border border-yellow-200 bg-yellow-50 px-4 py-3">
								<div class="flex items-center justify-between">
									<div>
										<p class="text-sm font-medium text-gray-900">{task.title}</p>
										<p class="text-xs text-gray-500">{task.projectTitle}</p>
									</div>
									<span class="rounded-full bg-yellow-100 px-2.5 py-1 text-xs font-semibold text-yellow-700">{task.estimatedHours}h</span>
								</div>
							</div>
						{/each}
						{#if delayRiskData.excessiveHoursTasks.length === 0}
							<p class="text-sm text-gray-400">—</p>
						{/if}
					</div>
				</article>

				<!-- Unassigned Tasks -->
				<article class="rounded-3xl border border-gray-200 bg-white p-6 shadow-sm">
					<h3 class="text-lg font-semibold text-orange-700">{$t.reports.unassignedTasks}</h3>
					<div class="mt-4 max-h-64 space-y-2 overflow-y-auto">
						{#each delayRiskData.unassignedTasks.slice(0, 15) as task (task.taskID)}
							<div class="rounded-xl border border-orange-200 bg-orange-50 px-4 py-3">
								<p class="text-sm font-medium text-gray-900">{task.title}</p>
								<p class="text-xs text-gray-500">{task.projectTitle}</p>
							</div>
						{/each}
						{#if delayRiskData.unassignedTasks.length === 0}
							<p class="text-sm text-gray-400">—</p>
						{/if}
					</div>
				</article>
			</div>

			</div>

		<!-- ═══════════════════ Project Status Report ═══════════════════ -->
		{:else if currentView === "projectstatus"}
			<div id="report-printable" class="space-y-6">
				<!-- KPI Row -->
				<div class="grid gap-4 sm:grid-cols-2 lg:grid-cols-5">
					<div class="rounded-3xl border border-gray-200 bg-white p-6 shadow-sm text-center">
						<p class="text-3xl font-extrabold text-blue-600">{$projectStatusData.length}</p>
						<p class="mt-1 text-sm text-gray-500">{$t.reports.totalProjects}</p>
					</div>
					<div class="rounded-3xl border border-gray-200 bg-white p-6 shadow-sm text-center">
						<p class="text-3xl font-extrabold text-green-600">{$projectStatusData.filter((p) => p.health === "onTrack").length}</p>
						<p class="mt-1 text-sm text-gray-500">{$t.projects.onTrack}</p>
					</div>
					<div class="rounded-3xl border border-gray-200 bg-white p-6 shadow-sm text-center">
						<p class="text-3xl font-extrabold text-orange-600">{$projectStatusData.filter((p) => p.health === "behind").length}</p>
						<p class="mt-1 text-sm text-gray-500">{$t.projects.behind}</p>
					</div>
					<div class="rounded-3xl border border-gray-200 bg-white p-6 shadow-sm text-center">
						<p class="text-3xl font-extrabold text-red-600">{$projectStatusData.filter((p) => p.health === "overBudget").length}</p>
						<p class="mt-1 text-sm text-gray-500">{$t.projects.overBudget}</p>
					</div>
					<div class="rounded-3xl border border-gray-200 bg-white p-6 shadow-sm text-center">
						<p class="text-3xl font-extrabold text-purple-600">{$projectStatusData.length > 0 ? Math.round($projectStatusData.reduce((s, p) => s + p.progress, 0) / $projectStatusData.length) : 0}%</p>
						<p class="mt-1 text-sm text-gray-500">{$t.reports.avgProgress}</p>
					</div>
				</div>

				<!-- Project Cards -->
				{#each $projectStatusData as proj (proj.projectID)}
					<article class="rounded-3xl border border-gray-200 bg-white p-6 shadow-sm">
						<div class="flex items-start justify-between gap-4">
							<div class="flex items-center gap-3">
								<div class="h-3 w-3 rounded-full {proj.health === 'overBudget' ? 'bg-red-500' : proj.health === 'behind' ? 'bg-orange-400' : 'bg-green-500'}" title="{proj.health === 'overBudget' ? $t.projects.overBudget : proj.health === 'behind' ? $t.projects.behind : $t.projects.onTrack}"></div>
								<div>
									<h3 class="text-lg font-semibold text-gray-900">{proj.title}</h3>
									<p class="text-sm text-gray-500">{proj.customerName} · {proj.projectManager}</p>
								</div>
							</div>
							<div class="flex items-center gap-2">
								<span class="text-xs font-semibold {proj.health === 'overBudget' ? 'text-red-600' : proj.health === 'behind' ? 'text-orange-500' : 'text-green-600'}">{proj.health === 'overBudget' ? $t.projects.overBudget : proj.health === 'behind' ? $t.projects.behind : $t.projects.onTrack}</span>
								<span class="rounded-full px-3 py-1 text-xs font-semibold {proj.status === 'Closed' || proj.status === 'Closure' ? 'bg-green-100 text-green-700' : proj.status === 'Execution' ? 'bg-blue-100 text-blue-700' : proj.status === 'Cancelled' ? 'bg-yellow-100 text-yellow-700' : 'bg-gray-100 text-gray-700'}">
									{proj.status}
								</span>
								<button onclick={() => { const p = $projectList.find(pp => pp.projectID === proj.projectID); if (p) printProjectStateReport(p); }}
									class="rounded-lg border border-gray-200 p-1.5 text-gray-500 hover:bg-gray-100 hover:text-gray-700 transition" title="Print">
									<svg class="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke-width="1.5" stroke="currentColor">
										<path stroke-linecap="round" stroke-linejoin="round" d="M6.72 13.829c-.24.03-.48.062-.72.096m.72-.096a42.415 42.415 0 0110.56 0m-10.56 0L6.34 18m10.94-4.171c.24.03.48.062.72.096m-.72-.096L17.66 18m0 0l.229 2.523a1.125 1.125 0 01-1.12 1.227H7.231c-.662 0-1.18-.568-1.12-1.227L6.34 18m11.318 0h1.091A2.25 2.25 0 0021 15.75V9.456c0-1.081-.768-2.015-1.837-2.175a48.055 48.055 0 00-1.913-.247M6.34 18H5.25A2.25 2.25 0 013 15.75V9.456c0-1.081.768-2.015 1.837-2.175a48.041 48.041 0 011.913-.247m10.5 0a48.536 48.536 0 00-10.5 0m10.5 0V3.375c0-.621-.504-1.125-1.125-1.125h-8.25c-.621 0-1.125.504-1.125 1.125v3.659M18.75 7.21H5.25"/>
									</svg>
								</button>
							</div>
						</div>

						<div class="mt-4 grid gap-4 sm:grid-cols-2 lg:grid-cols-5">
							<div>
								<p class="text-xs text-gray-500">{$t.reports.progress}</p>
								<div class="mt-1 flex items-center gap-2">
									<div class="h-2 flex-1 rounded-full bg-gray-200">
										<div class="h-2 rounded-full bg-blue-500" style="width: {proj.progress}%"></div>
									</div>
									<span class="text-xs font-semibold text-gray-700">{proj.progress}%</span>
								</div>
							</div>
							<div>
								<p class="text-xs text-gray-500">{$t.reports.tasks}</p>
								<p class="text-sm font-medium">{proj.doneTasks}/{proj.totalTasks} done · <span class="text-red-600">{proj.overdueTasks} overdue</span></p>
							</div>
							<div>
								<p class="text-xs text-gray-500">{$t.reports.budget}</p>
								<p class="text-sm font-medium">{fmt(proj.estimatedCost)} / {fmt(proj.budget)} CHF</p>
								<p class="text-xs {proj.budgetUsage > 100 ? 'text-red-600 font-semibold' : proj.budgetUsage > 80 ? 'text-orange-600' : 'text-green-600'}">{proj.budgetUsage}% used</p>
							</div>
							<div>
								<p class="text-xs text-gray-500">{$t.reports.startDate}</p>
								<p class="text-sm font-medium">{proj.startDate}</p>
							</div>
							<div>
								<p class="text-xs text-gray-500">{$t.reports.dueDate}</p>
								<p class="text-sm font-medium">{proj.dueDate}</p>
							</div>
						</div>
					</article>
				{/each}
			</div>

		<!-- ═══════════════════ Custom Report Builder ═══════════════════ -->
		{:else if currentView === "builder"}
			<section class="grid gap-6 xl:grid-cols-[0.4fr_0.6fr]">
				<!-- Available Data Sets -->
				<article class="rounded-3xl border border-gray-200 bg-white p-6 shadow-sm">
					<h3 class="text-lg font-semibold text-gray-900">{$t.reports.availableDataSets}</h3>
					<p class="mt-1 text-sm text-gray-500">{$t.reports.dragHint}</p>

					<div class="mt-4 space-y-2">
						{#each availableDataSets as ds (ds.id)}
							{@const inReport = selectedDataSets.includes(ds.id)}
							<!-- svelte-ignore a11y_no_static_element_interactions -->
							<div
								draggable="true"
								role="listitem"
								ondragstart={() => handleDragStart(ds.id)}
								class="flex cursor-grab items-center justify-between rounded-xl border border-gray-200 px-4 py-3 transition {inReport ? 'bg-gray-100 opacity-50' : 'bg-gray-50 hover:border-blue-200'}"
							>
								<div>
									<p class="text-sm font-medium text-gray-900">{ds.label}</p>
									<span class="mt-1 inline-block rounded-full px-2 py-0.5 text-[10px] font-semibold {ds.color}">{ds.category}</span>
								</div>
								{#if !inReport}
									<button onclick={() => addDataSet(ds.id)} class="rounded-lg bg-blue-50 px-2.5 py-1 text-xs font-medium text-blue-700 transition hover:bg-blue-100">
										+ {$t.reports.addToReport}
									</button>
								{/if}
							</div>
						{/each}
					</div>
				</article>

				<!-- Drop Zone / Report Preview -->
				<article class="flex flex-col gap-6">
					<!-- Report name & icon -->
					<div class="rounded-3xl border border-gray-200 bg-white p-6 shadow-sm">
						<label for="reportName" class="block text-sm font-medium text-gray-700">{$t.reports.reportName}</label>
						<input id="reportName" type="text" placeholder={$t.reports.reportNamePlaceholder} bind:value={customReportName}
							class="mt-1 w-full rounded-lg border border-gray-200 bg-gray-50 px-3 py-2 text-sm text-gray-900 outline-none transition focus:border-blue-300 focus:bg-white" />

						<p class="mt-4 text-sm font-medium text-gray-700">Icon</p>
						<div class="mt-2 flex flex-wrap gap-2">
							{#each ICONS as icon (icon.id)}
								<button
									onclick={() => (selectedIcon = icon.id)}
									title={icon.id}
									class="flex h-9 w-9 items-center justify-center rounded-lg border-2 transition {selectedIcon === icon.id ? 'border-blue-500 bg-blue-50 text-blue-600' : 'border-gray-200 bg-gray-50 text-gray-500 hover:border-gray-300'}"
								>
									<svg xmlns="http://www.w3.org/2000/svg" class="h-4.5 w-4.5" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d={icon.path} /></svg>
								</button>
							{/each}
						</div>
					</div>

					<!-- Drop zone -->
					<!-- svelte-ignore a11y_no_static_element_interactions -->
					<div
						role="list"
						ondragover={handleDragOver}
						ondragleave={handleDragLeave}
						ondrop={handleDrop}
						class="min-h-64 rounded-3xl border-2 border-dashed p-6 transition {dragOverTarget ? 'border-blue-400 bg-blue-50' : 'border-gray-300 bg-white'}"
					>
						<h3 class="text-lg font-semibold text-gray-900">{$t.reports.selectedDataSets}</h3>

						{#if selectedDataSets.length === 0}
							<div class="mt-8 flex flex-col items-center justify-center text-gray-400">
								<svg xmlns="http://www.w3.org/2000/svg" class="h-12 w-12" fill="none" viewBox="0 0 24 24" stroke="currentColor">
									<path stroke-linecap="round" stroke-linejoin="round" stroke-width="1.5" d="M19 11H5m14 0a2 2 0 012 2v6a2 2 0 01-2 2H5a2 2 0 01-2-2v-6a2 2 0 012-2m14 0V9a2 2 0 00-2-2M5 11V9a2 2 0 012-2m0 0V5a2 2 0 012-2h6a2 2 0 012 2v2M7 7h10" />
								</svg>
								<p class="mt-3 text-sm">{$t.reports.noDataSets}</p>
							</div>
						{:else}
							<div class="mt-4 space-y-2">
								{#each selectedDataSets as dsId, idx (dsId)}
									{@const ds = availableDataSets.find((d) => d.id === dsId)}
									{#if ds}
										<div class="flex items-center justify-between rounded-xl border border-gray-200 bg-gray-50 px-4 py-3">
											<div class="flex items-center gap-3">
												<span class="flex h-6 w-6 items-center justify-center rounded-full bg-gray-200 text-xs font-bold text-gray-600">{idx + 1}</span>
												<div>
													<p class="text-sm font-medium text-gray-900">{ds.label}</p>
													<span class="text-[10px] font-semibold rounded-full px-2 py-0.5 {ds.color}">{ds.category}</span>
												</div>
											</div>
											<button onclick={() => removeDataSet(dsId)} class="rounded-lg bg-red-50 px-2.5 py-1 text-xs font-medium text-red-600 transition hover:bg-red-100">
												{$t.reports.removeFromReport}
											</button>
										</div>
									{/if}
								{/each}
							</div>
						{/if}
					</div>

					<!-- Actions -->
					{#if selectedDataSets.length > 0}
						<div class="flex justify-end gap-3">
							<button onclick={saveAsTemplate} class="rounded-xl border border-gray-200 px-5 py-2.5 text-sm font-semibold text-gray-700 transition hover:bg-gray-50">
								{$t.reports.saveTemplate}
							</button>
							<button onclick={previewBuilderReport} class="rounded-xl border border-blue-200 bg-blue-50 px-5 py-2.5 text-sm font-semibold text-blue-700 transition hover:bg-blue-100">
								{$t.reports.preview}
							</button>
							<button onclick={printBuilderReport} class="rounded-xl bg-blue-600 px-5 py-2.5 text-sm font-semibold text-white shadow-sm transition hover:bg-blue-700">
								{$t.reports.printReport}
							</button>
						</div>

						<!-- Live preview of selected datasets -->
						<div class="space-y-4">
							{#if selectedDataSets.includes("budgetVsActual")}
								<div class="rounded-3xl border border-gray-200 bg-white p-5 shadow-sm">
									<h4 class="text-base font-semibold text-gray-900">{$t.reports.budgetVsActual}</h4>
									<div class="mt-3 grid gap-3 sm:grid-cols-3">
										<div class="rounded-xl bg-gray-50 p-3 text-center"><p class="text-xs text-gray-500">Budget</p><p class="text-lg font-bold text-gray-900">{fmtCurrency($budgetData.totalBudget)}</p></div>
										<div class="rounded-xl bg-gray-50 p-3 text-center"><p class="text-xs text-gray-500">{$t.common.cost}</p><p class="text-lg font-bold text-blue-700">{fmtCurrency($budgetData.totalEstimatedCost)}</p></div>
										<div class="rounded-xl bg-gray-50 p-3 text-center"><p class="text-xs text-gray-500">Diff</p><p class="text-lg font-bold {$budgetData.overrun > 0 ? 'text-red-600' : 'text-green-700'}">{fmtCurrency($budgetData.overrun)}</p></div>
									</div>
								</div>
							{/if}
							{#if selectedDataSets.includes("hoursPerEmployee")}
								<div class="rounded-3xl border border-gray-200 bg-white p-5 shadow-sm">
									<h4 class="text-base font-semibold text-gray-900">{$t.reports.hoursPerEmployee}</h4>
									<div class="mt-3 max-h-48 space-y-1.5 overflow-y-auto">
										{#each $budgetData.hoursPerEmployee.slice(0, 10) as row (row.name)}
											<div class="flex justify-between rounded-lg bg-gray-50 px-3 py-2 text-sm"><span>{row.name}</span><span class="font-semibold">{fmt(row.hours)}h</span></div>
										{/each}
									</div>
								</div>
							{/if}
							{#if selectedDataSets.includes("costPerPhase")}
								<div class="rounded-3xl border border-gray-200 bg-white p-5 shadow-sm">
									<h4 class="text-base font-semibold text-gray-900">{$t.reports.costPerPhase}</h4>
									<div class="mt-3 space-y-1.5">
										{#each $budgetData.costPerPhase as row (row.phase)}
											<div class="flex justify-between rounded-lg bg-gray-50 px-3 py-2 text-sm"><span>{row.phase}</span><span class="font-semibold">{fmtCurrency(row.cost)}</span></div>
										{/each}
									</div>
								</div>
							{/if}
							{#if selectedDataSets.includes("forecastedOverrun")}
								<div class="rounded-3xl border border-gray-200 bg-white p-5 shadow-sm">
									<h4 class="text-base font-semibold text-gray-900">{$t.reports.forecastedOverrun}</h4>
									<p class="mt-2 text-3xl font-bold {$budgetData.overrun > 0 ? 'text-red-600' : 'text-green-700'}">{fmtCurrency($budgetData.overrun)}</p>
								</div>
							{/if}
							{#if selectedDataSets.includes("hoursAssigned")}
								<div class="rounded-3xl border border-gray-200 bg-white p-5 shadow-sm">
									<h4 class="text-base font-semibold text-gray-900">{$t.reports.hoursAssigned}</h4>
									<div class="mt-3 max-h-48 space-y-1.5 overflow-y-auto">
										{#each $workloadData.employeeWorkload.slice(0, 10) as row (row.name)}
											<div class="flex justify-between rounded-lg px-3 py-2 text-sm {row.overloaded ? 'bg-red-50' : 'bg-gray-50'}"><span>{row.name}</span><span class="font-semibold">{fmt(row.assigned)}h</span></div>
										{/each}
									</div>
								</div>
							{/if}
							{#if selectedDataSets.includes("overloadDetection")}
								<div class="rounded-3xl border border-gray-200 bg-white p-5 shadow-sm">
									<h4 class="text-base font-semibold text-red-700">{$t.reports.overloadDetection}</h4>
									<div class="mt-3 space-y-1.5">
										{#each $workloadData.employeeWorkload.filter((e) => e.overloaded) as row (row.name)}
											<div class="flex justify-between rounded-lg bg-red-50 px-3 py-2 text-sm"><span>{row.name}</span><span class="font-semibold text-red-600">{fmt(row.assigned)}h / {fmt(row.monthlyCapacity)}h</span></div>
										{/each}
										{#if $workloadData.employeeWorkload.filter((e) => e.overloaded).length === 0}
											<p class="text-sm text-gray-400">—</p>
										{/if}
									</div>
								</div>
							{/if}
							{#if selectedDataSets.includes("upcomingDeadlines")}
								<div class="rounded-3xl border border-gray-200 bg-white p-5 shadow-sm">
									<h4 class="text-base font-semibold text-gray-900">{$t.reports.upcomingDeadlines}</h4>
									<div class="mt-3 max-h-48 space-y-1.5 overflow-y-auto">
										{#each $workloadData.upcomingDeadlines as task (task.taskID)}
											<div class="flex justify-between rounded-lg bg-orange-50 px-3 py-2 text-sm"><span>{task.title}</span><span>{new Date(task.dueDate!).toLocaleDateString("de-CH")}</span></div>
										{/each}
										{#if $workloadData.upcomingDeadlines.length === 0}
											<p class="text-sm text-gray-400">—</p>
										{/if}
									</div>
								</div>
							{/if}
							{#if selectedDataSets.includes("taskDistribution")}
								<div class="rounded-3xl border border-gray-200 bg-white p-5 shadow-sm">
									<h4 class="text-base font-semibold text-gray-900">{$t.reports.taskDistribution}</h4>
									<div class="mt-3 grid grid-cols-2 gap-2">
										{#each $workloadData.taskDistribution as row (row.status)}
											<div class="rounded-xl bg-gray-50 p-3 text-center"><p class="text-xl font-bold">{row.count}</p><span class="text-xs rounded-full px-2 py-0.5 {getStatusColor(row.status)}">{row.status}</span></div>
										{/each}
									</div>
								</div>
							{/if}
							{#if selectedDataSets.includes("milestonesAchieved")}
								<div class="rounded-3xl border border-gray-200 bg-white p-5 shadow-sm">
									<h4 class="text-base font-semibold text-gray-900">{$t.reports.milestonesAchieved}</h4>
									<div class="mt-3 max-h-48 space-y-1.5 overflow-y-auto">
										{#each $milestoneData.slice(0, 10) as row (row.projectTitle)}
											<div class="flex justify-between rounded-lg bg-gray-50 px-3 py-2 text-sm"><span>{row.projectTitle}</span><span class="font-semibold">{row.progress}%</span></div>
										{/each}
									</div>
								</div>
							{/if}
							{#if selectedDataSets.includes("deliverables")}
								<div class="rounded-3xl border border-gray-200 bg-white p-5 shadow-sm">
									<h4 class="text-base font-semibold text-gray-900">{$t.reports.deliverables}</h4>
									<div class="mt-3 max-h-48 space-y-1.5 overflow-y-auto">
										{#each $milestoneData.slice(0, 10) as row (row.projectTitle)}
											<div class="flex justify-between rounded-lg bg-gray-50 px-3 py-2 text-sm"><span>{row.projectTitle}</span><span>{row.doneTasks}/{row.totalTasks} tasks</span></div>
										{/each}
									</div>
								</div>
							{/if}
							{#if selectedDataSets.includes("overdueTasks")}
								<div class="rounded-3xl border border-gray-200 bg-white p-5 shadow-sm">
									<h4 class="text-base font-semibold text-red-700">{$t.reports.overdueTasks}</h4>
									<div class="mt-3 max-h-48 space-y-1.5 overflow-y-auto">
										{#each delayRiskData.overdueTasks.slice(0, 10) as task (task.taskID)}
											<div class="flex justify-between rounded-lg bg-red-50 px-3 py-2 text-sm"><span>{task.title}</span><span class="text-red-600">{task.projectTitle}</span></div>
										{/each}
										{#if delayRiskData.overdueTasks.length === 0}
											<p class="text-sm text-gray-400">—</p>
										{/if}
									</div>
								</div>
							{/if}
							{#if selectedDataSets.includes("unassignedTasks")}
								<div class="rounded-3xl border border-gray-200 bg-white p-5 shadow-sm">
									<h4 class="text-base font-semibold text-orange-700">{$t.reports.unassignedTasks}</h4>
									<div class="mt-3 max-h-48 space-y-1.5 overflow-y-auto">
										{#each delayRiskData.unassignedTasks.slice(0, 10) as task (task.taskID)}
											<div class="rounded-lg bg-orange-50 px-3 py-2 text-sm">{task.title} — {task.projectTitle}</div>
										{/each}
										{#if delayRiskData.unassignedTasks.length === 0}
											<p class="text-sm text-gray-400">—</p>
										{/if}
									</div>
								</div>
							{/if}
							{#if selectedDataSets.includes("excessiveHours")}
								<div class="rounded-3xl border border-gray-200 bg-white p-5 shadow-sm">
									<h4 class="text-base font-semibold text-yellow-700">{$t.reports.excessiveHours}</h4>
									<div class="mt-3 max-h-48 space-y-1.5 overflow-y-auto">
										{#each delayRiskData.excessiveHoursTasks.slice(0, 10) as task (task.taskID)}
											<div class="flex justify-between rounded-lg bg-yellow-50 px-3 py-2 text-sm"><span>{task.title}</span><span class="font-semibold">{task.estimatedHours}h</span></div>
										{/each}
										{#if delayRiskData.excessiveHoursTasks.length === 0}
											<p class="text-sm text-gray-400">—</p>
										{/if}
									</div>
								</div>
							{/if}
							{#if selectedDataSets.includes("phasesBehind")}
								<div class="rounded-3xl border border-gray-200 bg-white p-5 shadow-sm">
									<h4 class="text-base font-semibold text-gray-900">{$t.reports.phasesBehind}</h4>
									<div class="mt-3 max-h-48 space-y-1.5 overflow-y-auto">
										{#each delayRiskData.phasesBehind.slice(0, 10) as phase (phase.phaseid)}
											<div class="flex justify-between rounded-lg bg-gray-50 px-3 py-2 text-sm"><span>{phase.projectTitle}</span><span>{phase.phaseName}</span></div>
										{/each}
										{#if delayRiskData.phasesBehind.length === 0}
											<p class="text-sm text-gray-400">—</p>
										{/if}
									</div>
								</div>
							{/if}
							{#if selectedDataSets.includes("capacityPlanning")}
								<div class="rounded-3xl border border-gray-200 bg-white p-5 shadow-sm">
									<h4 class="text-base font-semibold text-blue-700">{$t.reports.capacityPlanning}</h4>
									<div class="mt-3 max-h-48 space-y-1.5 overflow-y-auto">
										{#each $workloadData.employeeWorkload as row (row.name)}
											{@const util = row.monthlyCapacity > 0 ? Math.round((row.assigned / row.monthlyCapacity) * 100) : 0}
											<div class="flex items-center justify-between rounded-lg px-3 py-2 text-sm {util > 100 ? 'bg-red-50' : 'bg-gray-50'}">
												<span>{row.name} ({row.employmentPercent}%)</span>
												<span class="font-semibold {util > 100 ? 'text-red-600' : 'text-gray-700'}">{util}%</span>
											</div>
										{/each}
									</div>
								</div>
							{/if}
							{#if selectedDataSets.includes("projectOverview")}
								<div class="rounded-3xl border border-gray-200 bg-white p-5 shadow-sm">
									<h4 class="text-base font-semibold text-teal-700">{$t.reports.projectOverview}</h4>
									<div class="mt-3 max-h-48 space-y-1.5 overflow-y-auto">
										{#each $projectStatusData as proj (proj.projectID)}
											<div class="flex items-center justify-between rounded-lg bg-gray-50 px-3 py-2 text-sm">
												<div class="flex items-center gap-2">
													<div class="h-2.5 w-2.5 rounded-full {proj.health === 'overBudget' ? 'bg-red-500' : proj.health === 'behind' ? 'bg-orange-400' : 'bg-green-500'}"></div>
													<span>{proj.title}</span>
												</div>
												<span class="rounded-full px-2 py-0.5 text-xs font-semibold {proj.status === 'Closed' || proj.status === 'Closure' ? 'bg-green-100 text-green-700' : proj.status === 'Execution' ? 'bg-blue-100 text-blue-700' : 'bg-gray-100 text-gray-600'}">{proj.status}</span>
											</div>
										{/each}
									</div>
								</div>
							{/if}
							{#if selectedDataSets.includes("projectProgress")}
								<div class="rounded-3xl border border-gray-200 bg-white p-5 shadow-sm">
									<h4 class="text-base font-semibold text-teal-700">{$t.reports.projectProgress}</h4>
									<div class="mt-3 max-h-48 space-y-1.5 overflow-y-auto">
										{#each $projectStatusData as proj (proj.projectID)}
											<div class="rounded-lg bg-gray-50 px-3 py-2 text-sm">
												<div class="flex items-center justify-between"><span>{proj.title}</span><span class="font-semibold">{proj.progress}%</span></div>
												<div class="mt-1 h-1.5 rounded-full bg-gray-200"><div class="h-1.5 rounded-full bg-blue-500" style="width:{proj.progress}%"></div></div>
											</div>
										{/each}
									</div>
								</div>
							{/if}
							{#if selectedDataSets.includes("projectBudgetUsage")}
								<div class="rounded-3xl border border-gray-200 bg-white p-5 shadow-sm">
									<h4 class="text-base font-semibold text-teal-700">{$t.reports.projectBudgetUsage}</h4>
									<div class="mt-3 max-h-48 space-y-1.5 overflow-y-auto">
										{#each $projectStatusData as proj (proj.projectID)}
											<div class="flex items-center justify-between rounded-lg px-3 py-2 text-sm {proj.budgetUsage > 100 ? 'bg-red-50' : 'bg-gray-50'}">
												<span>{proj.title}</span>
												<span class="font-semibold {proj.budgetUsage > 100 ? 'text-red-600' : 'text-gray-700'}">{proj.budgetUsage}% used</span>
											</div>
										{/each}
									</div>
								</div>
							{/if}
						</div>
					{/if}
				</article>
			</section>
		{/if}
	</div>
</div>

<!-- ═══════════════════ Print Preview Modal ═══════════════════ -->
{#if showPrintPreview}
	<!-- svelte-ignore a11y_no_static_element_interactions -->
	<div class="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4" onkeydown={(e) => { if (e.key === "Escape") showPrintPreview = false; }}>
		<div class="flex max-h-[90vh] w-full max-w-4xl flex-col rounded-3xl bg-white shadow-2xl">
			<div class="flex items-center justify-between border-b border-gray-200 px-6 py-4">
				<h2 class="text-lg font-semibold text-gray-900">{$t.reports.printPreview}</h2>
				<div class="flex items-center gap-2">
					<button onclick={() => { const w = window.open("", "_blank", "width=1000,height=900"); if (!w) return; w.document.open(); w.document.write("<!DOCTYPE html><html><head><meta charset='utf-8'><title>OnTrack Report</title><style>* { margin:0;padding:0;box-sizing:border-box; } body { font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',sans-serif; padding:24px; color:#111; font-size:13px; } @media print { body { padding:12px; } }</style></head><body>"); w.document.write(printPreviewHtml); w.document.write("</body></html>"); w.document.close(); w.focus(); w.print(); }}
						class="rounded-xl bg-blue-600 px-4 py-2 text-sm font-medium text-white hover:bg-blue-700 transition">
						{$t.reports.printReport}
					</button>
					<button onclick={() => showPrintPreview = false}
						class="rounded-xl border border-gray-200 px-4 py-2 text-sm font-medium text-gray-700 hover:bg-gray-100 transition">
						{$t.common.close}
					</button>
				</div>
			</div>
			<div class="flex-1 overflow-auto p-6">
				<div class="prose prose-sm max-w-none">
					{@html printPreviewHtml}
				</div>
			</div>
		</div>
	</div>
{/if}