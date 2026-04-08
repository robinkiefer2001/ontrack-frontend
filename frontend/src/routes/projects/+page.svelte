<script lang="ts">
  import onTrackCorpFav from "$lib/assets/onTrackCorpFav.png";
  import type {
    Project,
    Customer,
    ProjectPhase,
    Task,
    HourlyRate,
  } from "$lib/modules/projects/contracts";
  import {
    addProject,
    projectList,
  } from "$lib/modules/projects/store";
  import { customerList } from "$lib/modules/projects/dataSource.mock";
  import { loadHourlyRates } from "$lib/modules/projects/rates";
  import {
    ProjectsTable,
    ProjectsToolbar,
    ProjectEditorModal,
    ProjectCurrentViewModal,
  } from "$lib/modules/projects/ui";
  import { toDateOrNull } from "$lib/utils/date";
  import { getPhaseRange, getTaskCost, getAssignedBudget } from "$lib/modules/projects/business";
  import { buildProjectStateReportHtml } from "$lib/modules/projects/report";
  import {
    createEmptyProject,
    createEmptyTaskDraft,
    createEmptySubtaskDraft,
    type SubtaskDraftItem,
  } from "$lib/modules/projects/models";
  import { page } from "$app/stores";
  import { currentLanguage, t } from "$lib/language";
  import { currentUser } from "$lib/modules/user/store";
  import { filterUserProjects } from "$lib/modules/dashboard/business";

  // State
  let initProject: Project | null = null;
  let selectedProject: Project | null = null;
  let selectedCustomer: Customer | null = null;
  let showCustomerSelect = false;
  let selectedRow: number | null = null;
  let showForm = false;
  let currentProjectView = false;
  let hourlyRates: HourlyRate[] = loadHourlyRates();
  let projectFullTextSearch = "";
  let projectManagerFilter = "";
  let customerFilter = "";
  let customerSearchText = "";
  let lastQueryFromUrl = "";
  let lastNewProjectFromUrl = "";
  let projectManagers: string[] = [];
  let customers: string[] = [];
  let filteredProjects: Project[] = [];
  let filteredCustomerList: Customer[] = [];

  // Task form state
  let newTask = createEmptyTaskDraft();

  // Subtask form state
  let newSubtask = createEmptySubtaskDraft();

  let currentTaskSubtasks: SubtaskDraftItem[] = [];

  // Selected tasks for bulk actions
  let selectedTasks = new Set<number>();

  $: projectManagers = Array.from(
    new Set(
      $projectList
        .map((p) => (p.projectManager || "").trim())
        .filter((v) => v.length > 0),
    ),
  ).sort((a, b) => a.localeCompare(b));

  $: userScopedProjects = filterUserProjects(
    $projectList,
    `${$currentUser.firstName} ${$currentUser.lastName}`,
  );

  $: customers = Array.from(
    new Set(
      $projectList
        .map((p) => (p.customerName || "").trim())
        .filter((v) => v.length > 0),
    ),
  ).sort((a, b) => a.localeCompare(b));

  $: filteredProjects = $projectList.filter((p) => {
    const fullText = projectFullTextSearch.trim().toLowerCase();
    const matchesProjectManager = !projectManagerFilter || p.projectManager === projectManagerFilter;
    const matchesCustomer = !customerFilter || p.customerName === customerFilter;

    if (!matchesProjectManager || !matchesCustomer) return false;
    if (!fullText) return true;

    const haystack = [
      p.title,
      p.customerName,
      p.projectManager,
      String(p.projectID || ""),
      p.projectstatus,
    ]
      .join(" ")
      .toLowerCase();

    return haystack.includes(fullText);
  });

  $: {
    const q = ($page.url.searchParams.get("q") || "").trim();
    if (q !== lastQueryFromUrl) {
      projectFullTextSearch = q;
      lastQueryFromUrl = q;
    }
  }

  $: {
    const newProjectFlag = ($page.url.searchParams.get("new") || "").trim();
    if (newProjectFlag !== lastNewProjectFromUrl) {
      lastNewProjectFromUrl = newProjectFlag;
      if (newProjectFlag === "1" && !showForm) {
        newProject();
      }
    }
  }

  $: filteredCustomerList = customerList.filter((c) => {
    const q = customerSearchText.trim().toLowerCase();
    if (!q) return true;
    return [c.companyName, c.contactName, c.email, c.phone]
      .join(" ")
      .toLowerCase()
      .includes(q);
  });

  $: taskPhaseRange = getPhaseRange(
    initProject,
    (newTask.projectPhase || "") as ProjectPhase["phaseName"] | "",
  );

  // Bidirectional sync: Project start = Initiation start
  $: if (initProject?.startDate && initProject?.initiationPhase[0]) {
    initProject.initiationPhase[0].startDate = initProject.startDate;
  }

  // Bidirectional sync: Project end = Closure end
  $: if (initProject?.dueDate && initProject?.closurePhase[0]) {
    initProject.closurePhase[0].dueDate = initProject.dueDate;
  }

  // Sync Initiation start back to Project start
  $: if (initProject?.initiationPhase[0]?.startDate && initProject) {
    if (initProject.startDate !== initProject.initiationPhase[0].startDate) {
      initProject.startDate = initProject.initiationPhase[0].startDate;
    }
  }

  // Sync Closure end back to Project end
  $: if (initProject?.closurePhase[0]?.dueDate && initProject) {
    if (initProject.dueDate !== initProject.closurePhase[0].dueDate) {
      initProject.dueDate = initProject.closurePhase[0].dueDate;
    }
  }

  // Synchronize phase dates: start date of next phase = due date of previous phase
  $: if (
    initProject?.initiationPhase[0]?.dueDate &&
    initProject?.planingPhase[0]
  ) {
    initProject.planingPhase[0].startDate =
      initProject.initiationPhase[0].dueDate;
  }
  $: if (
    initProject?.planingPhase[0]?.dueDate &&
    initProject?.executionPhase[0]
  ) {
    initProject.executionPhase[0].startDate =
      initProject.planingPhase[0].dueDate;
  }
  $: if (
    initProject?.executionPhase[0]?.dueDate &&
    initProject?.closurePhase[0]
  ) {
    initProject.closurePhase[0].startDate =
      initProject.executionPhase[0].dueDate;
  }

  function setTaskPhase(name: ProjectPhase["phaseName"]) {
    if (!initProject) return;

    newTask.projectPhase = name;
    // passende PhaseId aus deinen Arrays holen:
    const map: Record<ProjectPhase["phaseName"], number | null> = {
      Initiation: initProject.initiationPhase[0]?.phaseid ?? null,
      Planing: initProject.planingPhase[0]?.phaseid ?? null,
      Execution: initProject.executionPhase[0]?.phaseid ?? null,
      Closure: initProject.closurePhase[0]?.phaseid ?? null,
    };

    newTask.phaseid = map[name];

    const { start, end } = getPhaseRange(initProject, name);
    newTask.startDate = start;
    newTask.dueDate = end;
  }

  function newProject() {
    showForm = true;

    const projectId = Date.now();
    initProject = createEmptyProject(projectId);
  }

  function selectCustomer() {
    showCustomerSelect = true;
    customerSearchText = "";
    return selectedCustomer;
  }

  function cancelNewProject() {
    initProject = null;
    showForm = false;
  }

  function addTask() {
    if (!initProject || !newTask.title.trim()) return;

    const taskStart = toDateOrNull(newTask.startDate);
    const taskEnd = toDateOrNull(newTask.dueDate);

    if (!newTask.projectPhase || !taskStart || !taskEnd) return;

    const { start: phaseStartRaw, end: phaseEndRaw } = getPhaseRange(
      initProject,
      newTask.projectPhase as ProjectPhase["phaseName"],
    );
    const phaseStart = toDateOrNull(phaseStartRaw);
    const phaseEnd = toDateOrNull(phaseEndRaw);

    if (phaseStart && taskStart < phaseStart) return;
    if (phaseEnd && taskEnd > phaseEnd) return;
    if (taskStart > taskEnd) return;

    const task: Task = {
      taskID: Date.now(),
      projectID: initProject.projectID || 0,
      title: newTask.title,
      phaseId: newTask.phaseid,
      projectPhase: newTask.projectPhase,
      description: newTask.description,
      status: newTask.status as "Pending",
      assignedTo: newTask.assignedTo,
      dueDate: taskEnd,
      startDate: taskStart,
      notificationSent: false,
      estimatedHours: newTask.estimatedHours,
      hourlyRateType: newTask.hourlyRateType,
      isCritical: newTask.isCritical,
      riskNote: newTask.riskNote,
      subtasks: currentTaskSubtasks,
    };

    if (initProject.budget && initProject.budget > 0) {
      const nextAssignedBudget = getAssignedBudget(initProject, hourlyRates) + getTaskCost(task, hourlyRates);
      if (nextAssignedBudget > initProject.budget) {
        alert($t.messages.budgetExceeded);
        return;
      }
    }

    initProject.Tasks = [...initProject.Tasks, task];

    newTask = createEmptyTaskDraft();

    currentTaskSubtasks = [];
    newSubtask = createEmptySubtaskDraft();
  }

  function removeTask(taskID: number) {
    if (!initProject) return;
    initProject.Tasks = initProject.Tasks.filter((t) => t.taskID !== taskID);
  }

  function addSubtask() {
    if (!newSubtask.title.trim()) return;

    const subtaskStart = toDateOrNull(newSubtask.startDate);
    const subtaskEnd = toDateOrNull(newSubtask.dueDate);
    const taskStart = toDateOrNull(newTask.startDate);
    const taskEnd = toDateOrNull(newTask.dueDate);

    // Validierung: Wenn Daten angegeben, müssen sie innerhalb der Task-Dauer sein
    if (subtaskStart && subtaskEnd) {
      if (subtaskStart > subtaskEnd) return;

      if (taskStart && subtaskStart < taskStart) {
        alert($t.messages.subtaskDateBeforeTask);
        return;
      }
      if (taskEnd && subtaskEnd > taskEnd) {
        alert($t.messages.subtaskDateAfterTask);
        return;
      }
    }

    const subtask = {
      subtaskID: Date.now() + Math.random(),
      taskID: 0, // Will be set when task is created
      title: newSubtask.title,
      description: newSubtask.description,
      status: newSubtask.status as "Pending",
      assignedTo: newSubtask.assignedTo,
      dueDate: subtaskEnd,
      startDate: subtaskStart,
      estimatedHours: newSubtask.estimatedHours,
      hourlyRateType: newSubtask.hourlyRateType,
      isCritical: newSubtask.isCritical,
      riskNote: newSubtask.riskNote,
    };

    currentTaskSubtasks = [...currentTaskSubtasks, subtask];

    newSubtask = createEmptySubtaskDraft();
  }

  function removeSubtask(subtaskID: number | string) {
    currentTaskSubtasks = currentTaskSubtasks.filter(
      (st) => st.subtaskID !== subtaskID,
    );
  }

  function submitNewProject() {
    if (!initProject) return;

    const parsedBudget =
      initProject.budget === null || initProject.budget === 0
        ? null
        : Number(initProject.budget);

    const normalizedProject: Project = {
      ...initProject,
      budget: Number.isNaN(parsedBudget) ? null : parsedBudget,
      startDate: toDateOrNull(initProject.startDate as Date | string | null),
      dueDate: toDateOrNull(initProject.dueDate as Date | string | null),
    };

    if (normalizedProject.budget && normalizedProject.budget > 0) {
      const assignedBudget = getAssignedBudget(normalizedProject, hourlyRates);
      if (assignedBudget > normalizedProject.budget) {
        alert($t.messages.budgetExceeded);
        return;
      }
    }

    showForm = false;
    addProject(normalizedProject);
    initProject = null;
  }

  function printOutProjectState() {
    if (!selectedProject) return;
    const reportHtml = buildProjectStateReportHtml(
      selectedProject,
      hourlyRates,
      onTrackCorpFav,
      $currentLanguage,
    );

    const printWindow = window.open("", "_blank", "width=1000,height=900");
    if (!printWindow) {
      alert("Unable to open print window. Please allow popups.");
      return;
    }

    printWindow.document.open();
    printWindow.document.write(reportHtml);
    printWindow.document.close();
    printWindow.focus();
    printWindow.print();
  }

  function showCurrentProject() {
    if (!selectedProject) return;

    currentProjectView = true;
  }

  function handleRowSelect(
    event: CustomEvent<{ index: number; project: Project }>,
  ) {
    const {
      detail: { index, project },
    } = event;
    const isSameRow = selectedRow === index;

    selectedRow = isSameRow ? null : index;
    selectedProject = isSameRow
      ? null
      : {
          title: project.title,
          customerID: project.customerID,
          customerName: project.customerName,
          budget: project.budget,
          dueDate: project.dueDate,
          startDate: project.startDate,
          projectID: project.projectID,
          projectManager: project.projectManager,
          projectstatus: project.projectstatus,
          Tasks: project.Tasks,
          initiationPhase: project.initiationPhase,
          planingPhase: project.planingPhase,
          executionPhase: project.executionPhase,
          closurePhase: project.closurePhase,
        };
  }

  function editTask(taskID: number) {
    if (!initProject) return;

    const task = initProject.Tasks.find((t) => t.taskID === taskID);
    if (!task) return;

    // Load task data into form
    newTask = {
      title: task.title,
      description: task.description || "",
      status: task.status,
      assignedTo: task.assignedTo || "",
      phaseid: task.phaseId,
      projectPhase: task.projectPhase || "",
      dueDate: task.dueDate ? task.dueDate.toISOString().split("T")[0] : null,
      startDate: task.startDate
        ? task.startDate.toISOString().split("T")[0]
        : null,
      estimatedHours: task.estimatedHours,
      hourlyRateType: task.hourlyRateType,
      isCritical: Boolean(task.isCritical),
      riskNote: task.riskNote || "",
    };

    // Load subtasks
    currentTaskSubtasks = task.subtasks || [];

    // Remove the task from the list (it will be re-added when user clicks "Add Task")
    removeTask(taskID);
  }

  function toggleTaskSelection(taskID: number) {
    if (selectedTasks.has(taskID)) {
      selectedTasks.delete(taskID);
    } else {
      selectedTasks.add(taskID);
    }
    selectedTasks = selectedTasks; // Trigger reactivity
  }

  function toggleSelectAll() {
    if (!initProject) return;

    if (selectedTasks.size === initProject.Tasks.length) {
      selectedTasks.clear();
    } else {
      selectedTasks = new Set(initProject.Tasks.map((t) => t.taskID));
    }
    selectedTasks = selectedTasks; // Trigger reactivity
  }

  function deleteSelectedTasks() {
    if (!initProject || selectedTasks.size === 0) return;

    initProject.Tasks = initProject.Tasks.filter(
      (t) => !selectedTasks.has(t.taskID),
    );
    selectedTasks.clear();
    selectedTasks = selectedTasks; // Trigger reactivity
  }
</script>

<div class="min-h-screen bg-gray-50 font-sans">
  <div class="mx-auto flex max-w-7xl flex-col gap-6 p-6">
<ProjectsToolbar
  projects={filteredProjects}
  allProjects={userScopedProjects}
  totalAllProjects={$projectList}
  {selectedProject}
  bind:fullTextSearch={projectFullTextSearch}
  bind:projectManagerFilter={projectManagerFilter}
  bind:customerFilter={customerFilter}
  {projectManagers}
  {customers}
  on:newProject={newProject}
  on:printProjectState={printOutProjectState}
  on:modifyProject={() => {
    /* modifyProject */
  }}
  on:showCurrentProject={showCurrentProject}
/>

<ProjectsTable
  projects={filteredProjects}
  {selectedRow}
  {hourlyRates}
  on:rowSelect={handleRowSelect}
/>

{#if currentProjectView}
  <ProjectCurrentViewModal
    {selectedProject}
    {hourlyRates}
    closeCurrentProject={() => (currentProjectView = false)}
  />
{/if}

{#if showForm}
  <ProjectEditorModal
    {initProject}
    bind:showCustomerSelect
    bind:customerSearchText
    {filteredCustomerList}
    bind:newTask
    bind:newSubtask
    bind:currentTaskSubtasks
    bind:selectedTasks
    {hourlyRates}
    {taskPhaseRange}
    {selectCustomer}
    {setTaskPhase}
    {addSubtask}
    {removeSubtask}
    {addTask}
    {toggleSelectAll}
    {toggleTaskSelection}
    {editTask}
    {removeTask}
    {deleteSelectedTasks}
    {submitNewProject}
    {cancelNewProject}
  />
{/if}
</div>
</div>
