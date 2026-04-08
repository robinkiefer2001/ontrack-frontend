<script lang="ts">
  import { onMount, onDestroy, afterUpdate } from "svelte";
  import { browser } from "$app/environment";
  import { Chart } from "chart.js/auto";
  import ChartDataLabels from "chartjs-plugin-datalabels";
  import "chartjs-adapter-date-fns";
  import type { Task, ProjectPhase } from "$lib/modules/projects/contracts";
  import { toDateOrNull, parseSwissDate } from "$lib/utils/date";

  let canvas: HTMLCanvasElement;
  let chart: Chart | null = null;

  export let start: Date | string | null = null;
  export let end: Date | string | null = null;
  export let tasks: Task[] = [];
  export let phases: {
    initiation: ProjectPhase[];
    planing: ProjectPhase[];
    execution: ProjectPhase[];
    closure: ProjectPhase[];
  } | null = null;

  type ViewMode = "phases" | "tasks";
  let viewMode: ViewMode = "phases";
  let expandedPhases = new Set<string>(["Initiation", "Planing", "Execution", "Closure"]);
  
  type TimeUnit = "day" | "week" | "month";
  let timeUnit: TimeUnit = "week";

  function getProjectRange() {
    // Bevorzuge immer die Projekt Start- und Enddaten
    const projectStart = toDateOrNull(start);
    const projectEnd = toDateOrNull(end);
    
    if (projectStart && projectEnd) {
      if (projectStart > projectEnd) return { startDate: projectEnd, endDate: projectStart };
      return { startDate: projectStart, endDate: projectEnd };
    }

    // Fallback: Wenn Projekt-Daten fehlen, berechne aus Phasen
    if (!phases) return { startDate: null, endDate: null };

    const candidates = [
      ...phases.initiation,
      ...phases.planing,
      ...phases.execution,
      ...phases.closure,
    ];

    const starts = candidates
      .map((p) => toDateOrNull(p.startDate))
      .filter((d): d is Date => !!d)
      .map((d) => d.getTime());
    const ends = candidates
      .map((p) => toDateOrNull(p.dueDate))
      .filter((d): d is Date => !!d)
      .map((d) => d.getTime());

    if (!starts.length || !ends.length) return { startDate: null, endDate: null };

    return {
      startDate: new Date(Math.min(...starts)),
      endDate: new Date(Math.max(...ends)),
    };
  }



  // Setze Start auf 00:00:00 des Starttages und Ende auf 23:59:59 des Endtages
  // Damit füllt der Balken den Kalender-Kasten zwischen zwei Gitterlinien komplett aus
  function offsetDatesForBarPositioning(startTime: number, endTime: number) {
    const start = new Date(startTime);
    start.setHours(0, 0, 0, 0);

    const end = new Date(endTime);
    end.setHours(23, 59, 59, 999);

    return {
      start: start.getTime(),
      end: end.getTime()
    };
  }

  // PHASE VIEW: Nur Phasen anzeigen
  function createPhaseView() {
    const datasets: any[] = [];
    const labels: string[] = [];
    
    const phaseColors = {
      Initiation: { bg: "rgba(99, 102, 241, 0.65)", border: "rgba(99, 102, 241, 1)" },
      Planing: { bg: "rgba(59, 130, 246, 0.65)", border: "rgba(59, 130, 246, 1)" },
      Execution: { bg: "rgba(168, 85, 247, 0.65)", border: "rgba(168, 85, 247, 1)" },
      Closure: { bg: "rgba(20, 184, 166, 0.65)", border: "rgba(20, 184, 166, 1)" }
    };

    const phaseOrder = ["Initiation", "Planing", "Execution", "Closure"];
    
    // Alle Phase-Labels hinzufügen
    phaseOrder.forEach(phaseName => labels.push(phaseName));
    
    if (phases) {
      const allPhases = [
        ...(phases.initiation || []),
        ...(phases.planing || []),
        ...(phases.execution || []),
        ...(phases.closure || [])
      ];

      phaseOrder.forEach(phaseName => {
        const phase = allPhases.find(p => p.phaseName === phaseName);
        
        const phaseStart = phase ? toDateOrNull(phase.startDate) : null;
        const phaseEnd = phase ? toDateOrNull(phase.dueDate) : null;
        
        const startStr = phaseStart ? phaseStart.toLocaleDateString('de-CH', { day: '2-digit', month: '2-digit', year: 'numeric' }) : 'nicht gesetzt';
        const endStr = phaseEnd ? phaseEnd.toLocaleDateString('de-CH', { day: '2-digit', month: '2-digit', year: 'numeric' }) : 'nicht gesetzt';
        const phaseLabel = `${phaseName}`;
        const phaseDateInfo = `${startStr} - ${endStr}`;

        if (phaseStart && phaseEnd) {
          const xMin = Math.min(phaseStart.getTime(), phaseEnd.getTime());
          const xMax = Math.max(phaseStart.getTime(), phaseEnd.getTime());
          const { start, end } = offsetDatesForBarPositioning(xMin, xMax);
          
          datasets.push({
            label: `${phaseName} (${phaseDateInfo})`,
            data: [{
              x: [start, end],
              y: phaseLabel
            }],
            backgroundColor: phaseColors[phaseName as keyof typeof phaseColors].bg,
            borderColor: phaseColors[phaseName as keyof typeof phaseColors].border,
            borderWidth: 2.5,
            borderSkipped: false,
            barThickness: 14,
            categoryPercentage: 1.0,
            barPercentage: 0.9
          });
        } else if (phaseStart || phaseEnd) {
          // Show partial bar with dashed border if only one date is set
          const fallbackDate = phaseStart || phaseEnd;
          const dayInMs = 24 * 60 * 60 * 1000;
          const xMin = fallbackDate!.getTime();
          const xMax = fallbackDate!.getTime() + dayInMs;
          const { start, end } = offsetDatesForBarPositioning(xMin, xMax);
          
          datasets.push({
            label: `${phaseName} (incomplete)`,
            data: [{
              x: [start, end],
              y: phaseLabel
            }],
            backgroundColor: phaseColors[phaseName as keyof typeof phaseColors].bg,
            borderColor: phaseColors[phaseName as keyof typeof phaseColors].border,
            borderWidth: 2.5,
            borderSkipped: false,
            borderDash: [5, 5],
            barThickness: 14,
            categoryPercentage: 1.0,
            barPercentage: 0.9
          });
        }
      });
    }

    return { datasets, labels };
  }

  // TASK VIEW: Tasks gruppiert nach Phasen mit 4-stelligen Task-Nummern und Phasen-Farben
  function createTaskView() {
    const datasets: any[] = [];
    const labels: string[] = [];

    const phaseColors = {
      Initiation: { bg: "rgba(99, 102, 241, 0.8)", border: "rgba(99, 102, 241, 1)" },
      Planing: { bg: "rgba(59, 130, 246, 0.8)", border: "rgba(59, 130, 246, 1)" },
      Execution: { bg: "rgba(168, 85, 247, 0.8)", border: "rgba(168, 85, 247, 1)" },
      Closure: { bg: "rgba(20, 184, 166, 0.8)", border: "rgba(20, 184, 166, 1)" }
    };

    const phaseOrder = ["Initiation", "Planing", "Execution", "Closure"];
    let taskCounter = 0; // Globale Task-Nummer

    phaseOrder.forEach((phaseName) => {
      const phaseTasks = tasks.filter((t) => t.projectPhase === phaseName);

      phaseTasks.forEach((task) => {
        const taskStart = toDateOrNull(task.startDate);
        const taskEnd = toDateOrNull(task.dueDate);

        taskCounter++;
        const taskId = `T${taskCounter.toString().padStart(4, "0")}`;
        const taskLabel = `${taskId}: ${task.title}`;
        labels.push(taskLabel);

        if (taskStart && taskEnd) {
          const { start, end } = offsetDatesForBarPositioning(taskStart.getTime(), taskEnd.getTime());
          const color = phaseColors[phaseName as keyof typeof phaseColors];

          datasets.push({
            label: taskLabel,
            data: [{
              x: [start, end],
              y: taskLabel,
            }],
            backgroundColor: color.bg,
            borderColor: color.border,
            borderWidth: 1,
            borderSkipped: false,
            categoryPercentage: 1.0,
            barPercentage: 1.0,
          });
        }
      });
    });

    return { datasets, labels };
  }

  function createGanttData() {
    switch (viewMode) {
      case "phases":
        return createPhaseView();
      case "tasks":
        return createTaskView();
      default:
        return createPhaseView();
    }
  }

  onMount(async () => {
    if (!browser) return;

    // Plugin nur im Browser laden
    const zoomModule = await import("chartjs-plugin-zoom");
    const zoomPlugin = zoomModule.default ?? zoomModule;
    Chart.register(zoomPlugin, ChartDataLabels);

    const ctx = canvas.getContext("2d");
    if (!ctx) return;

    const { startDate, endDate } = getProjectRange();

    // Für Monatsansicht: Setze Start auf 1. des Monats, in dem das Projekt startet
    let minDate = startDate ? startDate.toISOString() : undefined;
    if (timeUnit === 'month' && startDate) {
      const chartStart = new Date(startDate);
      chartStart.setDate(1);
      chartStart.setHours(0, 0, 0, 0);
      minDate = chartStart.toISOString();
    }

    const ganttData = createGanttData();

    chart = new Chart(ctx, {
      type: "bar",
      plugins: [ChartDataLabels],
      data: {
        labels: ganttData.labels,
        datasets: ganttData.datasets,
      },
      options: {
        indexAxis: 'y',
        responsive: true,
        maintainAspectRatio: false,
        layout: {
          padding: {
            right: 36
          }
        },
        scales: {
          x: {
            type: "time",
            time: { 
              unit: timeUnit,
              displayFormats: {
                day: 'dd.MM',
                week: "'KW'ww yyyy",
                month: 'MMM yyyy'
              }
            },
            min: minDate,
            max: endDate ? endDate.toISOString() : undefined,
            offset: false,
            grid: {
              display: true,
              color: 'rgba(0, 0, 0, 0.05)',
              drawOnChartArea: true
            },
            ticks: {
              align: 'start',
              maxRotation: 0,
              minRotation: 0,
              font: {
                size: 11
              },
              source: 'auto'
            },
            bounds: 'data'
          },
          y: {
            type: "category",
            stacked: true,
            offset: true,
            grid: {
              display: true,
              drawOnChartArea: true,
              color: "rgba(0, 0, 0, 0.06)"
            },
            ticks: {
              autoSkip: false,
              font: {
                size: 11,
                weight: (context: any) => {
                  // Bold for phase names in task view
                  return context.tick.label && !context.tick.label.startsWith('  ') ? 'bold' : 'normal';
                }
              },
              padding: 5
            }
          },
        },
        plugins: {
          legend: {
            display: false
          },
          tooltip: {
            callbacks: {
              title: function(context: any) {
                return context[0]?.dataset?.label || '';
              },
              label: function(context: any) {
                const data = context.raw;
                if (data && data.x) {
                  const start = new Date(data.x[0]);
                  const end = new Date(data.x[1]);
                  const duration = Math.ceil((data.x[1] - data.x[0]) / (1000 * 60 * 60 * 24));
                  
                  return [
                    `Start: ${start.toLocaleDateString('de-CH', { weekday: 'short', day: '2-digit', month: 'short', year: 'numeric' })}`,
                    `Ende: ${end.toLocaleDateString('de-CH', { weekday: 'short', day: '2-digit', month: 'short', year: 'numeric' })}`,
                    `Dauer: ${duration} Tag${duration !== 1 ? 'e' : ''}`
                  ];
                }
                return '';
              },
              labelTextColor: function(context: any) {
                return '#fff';
              }
            },
            backgroundColor: 'rgba(0, 0, 0, 0.8)',
            padding: 12,
            cornerRadius: 6,
            displayColors: false
          },
          zoom: {
            limits: {
              x: {
                min: startDate ? startDate.getTime() : undefined,
                max: endDate ? endDate.getTime() : undefined,
              },
            },
            pan: {
              enabled: true,
              mode: "x",
            },
            zoom: {
              wheel: { enabled: true },
              mode: "x",
            },
          },
          // Custom Plugin: Text auf Balken zeichnen
          datalabels: {
            display: (context: any) => viewMode === "tasks" && !!context?.dataset?.label,
            color: "#000000",
            anchor: "start",
            align: "right",
            offset: 10,
            clamp: true,
            clip: false,
            padding: { left: 4, right: 4, top: 1, bottom: 1 },
            font: { size: 10, weight: "bold" },
            formatter: (_value: any, context: any) => {
              const label = context?.dataset?.label as string | undefined;
              return label ?? "";
            }
          }
        },
      },
    });
  });

  afterUpdate(() => {
    if (!chart) return;

    const { startDate, endDate } = getProjectRange();

    const ganttData = createGanttData();
    chart.data.datasets = ganttData.datasets;
    chart.data.labels = ganttData.labels;

    const x: any = chart.options.scales!.x;
    
    // Für Monatsansicht: Setze Start auf 1. des Monats, in dem das Projekt startet
    if (timeUnit === 'month' && startDate) {
      const chartStart = new Date(startDate);
      chartStart.setDate(1);
      chartStart.setHours(0, 0, 0, 0);
      x.min = chartStart.toISOString();
    } else {
      x.min = startDate ? startDate.toISOString() : undefined;
    }
    
    x.max = endDate ? endDate.toISOString() : undefined;
    if (x.time) {
      x.time.unit = timeUnit;
    }

    const zoomOptions: any = chart.options.plugins?.zoom;
    if (zoomOptions?.limits?.x) {
      zoomOptions.limits.x.min = startDate ? startDate.getTime() : undefined;
      zoomOptions.limits.x.max = endDate ? endDate.getTime() : undefined;
    }

    chart.update();
  });

  function switchView(mode: ViewMode) {
    viewMode = mode;
    if (chart) {
      const ganttData = createGanttData();
      chart.data.datasets = ganttData.datasets;
      chart.data.labels = ganttData.labels;
      chart.update();
    }
  }

  function switchTimeUnit(unit: TimeUnit) {
    timeUnit = unit;
    if (chart && chart.options.scales?.x) {
      const x: any = chart.options.scales.x;
      if (x.time) {
        x.time.unit = unit;
      }
      chart.update();
    }
  }

  onDestroy(() => {
    chart?.destroy();
  });

  export function resetFocus() {
    if (!chart) return;

    const { startDate, endDate } = getProjectRange();

    const x: any = chart.options.scales!.x;
    x.min = startDate ? startDate.toISOString() : undefined;
    x.max = endDate ? endDate.toISOString() : undefined;

    (chart as any).resetZoom?.();
    chart.update();
  }
</script>

<div class="rounded-2xl border border-gray-200 bg-white p-4 shadow-sm">
  <!-- View Switcher -->
  <div class="mb-4 flex items-center justify-between">
    <div class="flex gap-1 rounded-lg bg-gray-100 p-1">
      <button 
        class="rounded-md px-3 py-1.5 text-sm font-medium transition {viewMode === 'phases' ? 'bg-white text-gray-900 shadow-sm' : 'text-gray-500 hover:text-gray-700'}" 
        on:click={() => switchView('phases')}
      >
        Phases
      </button>
      <button 
        class="rounded-md px-3 py-1.5 text-sm font-medium transition {viewMode === 'tasks' ? 'bg-white text-gray-900 shadow-sm' : 'text-gray-500 hover:text-gray-700'}" 
        on:click={() => switchView('tasks')}
      >
        Tasks
      </button>
    </div>

    <div class="flex items-center gap-4">
      <!-- Time Unit Switcher -->
      <div class="flex gap-1 rounded-lg bg-gray-100 p-1">
        <button 
          class="rounded-md px-3 py-1.5 text-sm font-medium transition {timeUnit === 'day' ? 'bg-white text-gray-900 shadow-sm' : 'text-gray-500 hover:text-gray-700'}"
          on:click={() => switchTimeUnit('day')}
        >
          Tage
        </button>
        <button 
          class="rounded-md px-3 py-1.5 text-sm font-medium transition {timeUnit === 'week' ? 'bg-white text-gray-900 shadow-sm' : 'text-gray-500 hover:text-gray-700'}"
          on:click={() => switchTimeUnit('week')}
        >
          Wochen
        </button>
        <button 
          class="rounded-md px-3 py-1.5 text-sm font-medium transition {timeUnit === 'month' ? 'bg-white text-gray-900 shadow-sm' : 'text-gray-500 hover:text-gray-700'}"
          on:click={() => switchTimeUnit('month')}
        >
          Monate
        </button>
      </div>
    </div>
  </div>

  <!-- Chart -->
  <div style="height: {viewMode === 'tasks' ? '450px' : '350px'};">
    <canvas bind:this={canvas}></canvas>
  </div>

  <!-- Legends and Info -->
  <div class="mt-3">
    {#if viewMode === 'tasks'}
      <!-- Phase Color Legend -->
      <div class="flex gap-4 justify-center text-sm items-center mb-2">
        <span class="font-semibold text-gray-600">Task-Farben (nach Phase):</span>
        <div class="flex items-center gap-1.5">
          <div class="w-4 h-4 rounded" style="background-color: rgba(99, 102, 241, 0.8); border: 1.5px solid rgba(99, 102, 241, 1);"></div>
          <span>Initiation</span>
        </div>
        <div class="flex items-center gap-1.5">
          <div class="w-4 h-4 rounded" style="background-color: rgba(59, 130, 246, 0.8); border: 1.5px solid rgba(59, 130, 246, 1);"></div>
          <span>Planning</span>
        </div>
        <div class="flex items-center gap-1.5">
          <div class="w-4 h-4 rounded" style="background-color: rgba(168, 85, 247, 0.8); border: 1.5px solid rgba(168, 85, 247, 1);"></div>
          <span>Execution</span>
        </div>
        <div class="flex items-center gap-1.5">
          <div class="w-4 h-4 rounded" style="background-color: rgba(20, 184, 166, 0.8); border: 1.5px solid rgba(20, 184, 166, 1);"></div>
          <span>Closure</span>
        </div>
      </div>
    {/if}
    
    <!-- View-specific info -->
    <div class="text-xs text-gray-500 text-center">
      {#if viewMode === 'phases'}
        Phase Overview | Aktuelle Ansicht: {timeUnit === 'day' ? 'Tage' : timeUnit === 'week' ? 'Wochen' : 'Monate'}
      {:else if viewMode === 'tasks'}
        Task Details | Tasks nummeriert und nach Phase farbcodiert | Aktuelle Ansicht: {timeUnit === 'day' ? 'Tage' : timeUnit === 'week' ? 'Wochen' : 'Monate'}
      {/if}
    </div>
  </div>
</div>
