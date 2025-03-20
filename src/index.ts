import { generateKeyBetween } from './fridx';
import { audioStore, setupStore } from './storage';
import {
  uploadAudioFiles,
  playShuffledAudio,
  ProcessOptions,
  storeAudio,
  processAudioFile,
} from './music';
import {
  createTask,
  deleteTask,
  updateTask,
  populateTasks,
  idxFromTask,
  taskFromId,
  callback,
  startSession,
  endSession,
  breakSession,
  rollcall,
  flipCountDirection,
  resumeSession,
  setPomodoroDuration,
  setBreakDuration,
} from './events';
import { render, diff, h, dom, DNode } from './vdom';
import {
  TASK_SESSION,
  TASK_RECURRING,
  TaskStatus,
  TASK_COMPLETED,
  Task,
  TaskList,
  AppState,
  APP_IDLE,
  APP_ACTIVE,
  APP_BREAK,
} from './types';
import { appState, isLeader } from './state';
import { playSpeech, stopMusic } from './audioPlayer';
const { div, h1, button, p, input, span } = dom;

const DEFAULT_TASK_TIME = 25 * 60;

setupStore().then(() => {
  populateTasks();
});

rollcall();

async function handleAudioUpload(files: File[]) {
  const options: ProcessOptions = {
    normalize: true,
    fadeIn: 0.01,
    fadeOut: 0.01,
  };
  try {
    appState.audioUploadState = 0;
    redraw();
    let portion = 1 / files.length;
    for (const file of files) {
      const processedAudio = await processAudioFile(file, options);
      await storeAudio(processedAudio);
      appState.audioUploadState += portion;
      redraw();
    }
    appState.audioUploadState = 1.01;
    redraw();
  } catch (e) {
    console.error(e);
  }
  await new Promise((resolve) => setTimeout(resolve, 400));
  appState.audioUploadState = 1;
  redraw();
}

// START NAVIGATION
////////////////////////////////////////////////////////////////////////////////

type Coords = { x: number; y: number };

function centerFromRect(rect: DOMRect): Coords {
  return { x: rect.left + rect.width / 2, y: rect.top + rect.height / 2 };
}

enum Axis {
  X,
  Y,
  None,
}

enum Direction {
  Up,
  Down,
  Left,
  Right,
  None,
}

function axisFromDirection(dir: Direction) {
  if (dir === Direction.Up || dir === Direction.Down) return Axis.Y;
  if (dir === Direction.Left || dir === Direction.Right) return Axis.X;
  return Axis.None;
}

function secondaryAxisFromDirection(dir: Direction) {
  if (dir === Direction.Up || dir === Direction.Down) return Axis.X;
  if (dir === Direction.Left || dir === Direction.Right) return Axis.Y;
  return Axis.None;
}

// NAV STATE
let lastRect: DOMRect | null = null;
let lastAxis: Axis = Axis.None;
let lastTargetCoords: Coords = { x: Infinity, y: Infinity };
let lastDirection: Direction = Direction.None;

function resetNavState() {
  lastTargetCoords = { x: Infinity, y: Infinity };
  lastDirection = Direction.None;
  lastAxis = Axis.None;
}

{
  let container = document;
  container.addEventListener('focusin', (event) => {
    if (event.target instanceof Element) lastRect = event.target.getBoundingClientRect();
  });
  container.addEventListener('focusout', () => {
    setTimeout(() => {
      if (!container.contains(document.activeElement) || document.activeElement === document.body) {
        resetNavState();
        if (lastRect) {
          let targetCoords = centerFromRect(lastRect);
          targetCoords = updateNavigationState(targetCoords, Direction.None);
          let closest = getNearestEl(getNavigableElements, targetCoords, Direction.None);
          if (closest) closest.focus();
        }
      }
    }, 0);
  });
  container.addEventListener('keydown', (e) => {
    if (e.key === 'Tab') {
      resetNavState();
    }
  });
  container.addEventListener('mousedown', (e) => {
    resetNavState();
  });
}

function groupElementsByRow(getElementCandidates: () => Element[]) {
  const elements: Element[] = getElementCandidates();
  if (elements.length === 0) return [];

  // Sort elements by their top position
  elements.sort((a, b) => a.getBoundingClientRect().top - b.getBoundingClientRect().top);

  let rows: Element[][] = [];

  elements.forEach((element) => {
    let rect = element.getBoundingClientRect();
    let added = false;

    // Try to place the element in an existing row
    for (let row of rows) {
      let firstInRow = row[0].getBoundingClientRect();
      let overlapHeight =
        Math.min(rect.bottom, firstInRow.bottom) - Math.max(rect.top, firstInRow.top);
      let elementHeight = rect.bottom - rect.top;
      let rowHeight = firstInRow.bottom - firstInRow.top;

      if (overlapHeight / elementHeight > 0.5 || overlapHeight / rowHeight > 0.5) {
        row.push(element);
        added = true;
        break;
      }
    }

    // If not added, create a new row
    if (!added) {
      rows.push([element]);
    }
  });

  // Sort each row from left to right
  rows.forEach((row) =>
    row.sort((a, b) => a.getBoundingClientRect().left - b.getBoundingClientRect().left),
  );

  return rows;
}

function groupElementsByColumn(getElementCandidates: () => Element[]) {
  const elements: Element[] = getElementCandidates();
  if (elements.length === 0) return [];

  // Sort elements by their left position
  elements.sort((a, b) => a.getBoundingClientRect().left - b.getBoundingClientRect().left);

  let columns: Element[][] = [];

  elements.forEach((element) => {
    let rect = element.getBoundingClientRect();
    let added = false;

    // Try to place the element in an existing column
    for (let column of columns) {
      let firstInColumn = column[0].getBoundingClientRect();
      let overlapWidth =
        Math.min(rect.right, firstInColumn.right) - Math.max(rect.left, firstInColumn.left);
      let elementWidth = rect.right - rect.left;
      let columnWidth = firstInColumn.right - firstInColumn.left;

      if (overlapWidth / elementWidth > 0.5 || overlapWidth / columnWidth > 0.5) {
        column.push(element);
        added = true;
        break;
      }
    }

    // If not added, create a new column
    if (!added) {
      columns.push([element]);
    }
  });

  // Sort each column from top to bottom
  columns.forEach((column) =>
    column.sort((a, b) => a.getBoundingClientRect().top - b.getBoundingClientRect().top),
  );

  return columns;
}

function getNavigableElements(container = document) {
  return Array.from(container.querySelectorAll('input:not(.skip-navigation), .navigable')).filter(
    (el) => !el.hasAttribute('disabled'),
  );
}

function getNextNonOverlappingRowOrColumn(
  getElementCandidates: () => Element[],
  coords: Coords,
  direction: Direction,
) {
  const { x, y } = coords;
  const rows = groupElementsByRow(getElementCandidates);
  const columns = groupElementsByColumn(getElementCandidates);

  if (direction === Direction.Down || direction === Direction.Up) {
    let selectedRow = rows.find((row) =>
      row.some((el) => {
        let rect = el.getBoundingClientRect();
        return rect.top <= y && rect.bottom >= y;
      }),
    );

    if (direction === Direction.Down && selectedRow) {
      let index = rows.indexOf(selectedRow);
      return index + 1 < rows.length ? rows[index + 1] : null;
    } else if (direction === Direction.Up && selectedRow) {
      let index = rows.indexOf(selectedRow);
      return index - 1 >= 0 ? rows[index - 1] : null;
    }
  } else {
    let selectedColumn = columns.find((column) =>
      column.some((el) => {
        let rect = el.getBoundingClientRect();
        return rect.left <= x && rect.right >= x;
      }),
    );

    if (direction === Direction.Right && selectedColumn) {
      let index = columns.indexOf(selectedColumn);
      return index + 1 < columns.length ? columns[index + 1] : null;
    } else if (direction === Direction.Left && selectedColumn) {
      let index = columns.indexOf(selectedColumn);
      return index - 1 >= 0 ? columns[index - 1] : null;
    }
  }

  return null;
}

function findClosestElementInRowOrColumn(coords: Coords, axis: Axis, group: Element[]) {
  if (!group || group.length === 0) return null;

  let closest: Node = document;
  let distance = Infinity;

  for (const el of group) {
    let rect = el.getBoundingClientRect();
    let dist =
      axis === Axis.X
        ? Math.abs(rect.left + rect.width / 2 - coords.x)
        : Math.abs(rect.top + rect.height / 2 - coords.y);

    if (dist < distance) {
      distance = dist;
      closest = el;
    }
  }

  if (closest === document) return null;
  return closest;
}

function updateNavigationState(targetCoords: { x: number; y: number }, dir: Direction) {
  let target = { ...targetCoords };
  let newAxis = axisFromDirection(dir);
  if (newAxis === Axis.None) {
    lastAxis = Axis.None;
    lastDirection = Direction.None;
    lastTargetCoords = { x: Infinity, y: Infinity };
  } else if (newAxis === lastAxis) {
    // Maintain a goal column/row when continuing in the same axis
    if (newAxis === Axis.X) {
      if (lastTargetCoords.y !== Infinity) target.y = lastTargetCoords.y;
      lastTargetCoords = target;
    } else if (newAxis === Axis.Y) {
      if (lastTargetCoords.x !== Infinity) target.x = lastTargetCoords.x;
      lastTargetCoords = target;
    } else {
      lastTargetCoords = { x: Infinity, y: Infinity };
    }
  } else {
    lastTargetCoords = target;
  }
  lastAxis = newAxis;
  lastDirection = dir;
  return target;
}

function getNearestEl(
  getNavigableElements: () => Element[],
  targetCoords: { x: number; y: number },
  dir: Direction,
) {
  // If we don't have a direction, find the nearest element even if it overlaps
  // the targetCoords.
  if (dir === Direction.None) {
    let elements = getNavigableElements();
    let closest: Node = document;
    let distance = Infinity;
    for (const el of elements) {
      let rect = el.getBoundingClientRect();
      let dist = Math.hypot(
        targetCoords.x - (rect.left + rect.width / 2),
        targetCoords.y - (rect.top + rect.height / 2),
      );
      if (dist < distance) {
        distance = dist;
        closest = el;
      }
    }
    if (closest === document) return null;
    return closest;
  }
  {
    // If we are going Left or Right, default to something like a ray cast.
    // If we don't find anything, we will fall back to the row/column method.
    if (dir === Direction.Left) {
      let elements = getNavigableElements();
      let closest: Node = document;
      let distance = Infinity;
      for (const el of elements) {
        let rect = el.getBoundingClientRect();
        if (rect.right > targetCoords.x) continue;
        if (rect.top > targetCoords.y || rect.bottom < targetCoords.y) continue;
        let dist = targetCoords.x - rect.right;
        if (dist < distance) {
          distance = dist;
          closest = el;
        }
      }
      if (closest !== document) return closest;
    } else if (dir === Direction.Right) {
      let elements = getNavigableElements();
      let closest: Node = document;
      let distance = Infinity;
      for (const el of elements) {
        let rect = el.getBoundingClientRect();
        if (rect.left < targetCoords.x) continue;
        if (rect.top > targetCoords.y || rect.bottom < targetCoords.y) continue;
        let dist = rect.left - targetCoords.x;
        if (dist < distance) {
          distance = dist;
          closest = el;
        }
      }
      if (closest !== document) return closest;
    }
  }
  // Fallback based on rows and columns
  let rowOrColumn = getNextNonOverlappingRowOrColumn(getNavigableElements, targetCoords, dir);
  if (!rowOrColumn) return null;
  let closest = findClosestElementInRowOrColumn(
    targetCoords,
    secondaryAxisFromDirection(dir),
    rowOrColumn,
  );
  return closest;
}

function navigateEl(el: Element, dir: Direction) {
  let elBox = el.getBoundingClientRect();
  let targetCoords = centerFromRect(elBox);
  targetCoords = updateNavigationState(targetCoords, dir);
  let closest = getNearestEl(getNavigableElements, targetCoords, dir);
  if (closest) closest.focus();
}

// END NAVIGATION
////////////////////////////////////////////////////////////////////////////////

let styles = {
  task: {
    borderTop: '2px solid transparent',
    borderBottom: '2px solid transparent',
    transition: 'all 0.2s ease',
  },
  taskDropTop: {
    borderTop: '2px solid var(--accent)',
  },
  taskDropBottom: {
    borderBottom: '2px solid var(--accent)',
  },
};

/**
 * 1h 30m => 90 * 60
 * 2H => 2 * 60 * 60
 * 25m => 25 * 60
 * 30 => 30 * 60
 */
function parseHumanReadableTime(hrTime: string): number {
  try {
    let timeStr = hrTime.trim().toLowerCase();
    let time = 0;
    let includesHours = timeStr.includes('h');
    let includesMinutes = timeStr.includes('m');
    let includesSeconds = timeStr.includes('s');
    if (includesHours) {
      const hours = parseInt(timeStr.split('h', 2)[0]);
      if (hours) time += hours * 60 * 60;
      timeStr = timeStr.split('h', 2)[1];
    }
    if (includesMinutes) {
      const minutes = parseInt(timeStr.split('m', 2)[0]);
      if (minutes) time += minutes * 60;
    }
    if (includesSeconds) {
      const seconds = parseInt(timeStr.split('s', 2)[0]);
      if (seconds) time += seconds;
    }
    if (!includesHours && !includesMinutes && !includesSeconds) {
      time = parseInt(timeStr) * 60;
    }
    return time;
  } catch (e) {
    return DEFAULT_TASK_TIME;
  }
}

type PartitionedTime = {
  hours: number;
  minutes: number;
  seconds: number;
};

function partitionTime(time: number): PartitionedTime {
  const hours = Math.floor(time / 3600);
  const minutes = Math.floor((time % 3600) / 60);
  const seconds = Math.floor(time % 60);
  return { hours, minutes, seconds };
}

type FormatTimeOptions = {
  forceHours?: boolean;
  forceMinutes?: boolean;
  forceSeconds?: boolean;
  pad?: number;
};

function formatTime(time: PartitionedTime, opts: FormatTimeOptions = {}): string {
  const { hours, minutes, seconds } = time;
  const { pad = 1 } = opts;
  let res = '';
  if (hours > 0 || opts.forceHours) res += `${hours}h`.padStart(pad + 1, '0');
  if (minutes > 0 || opts.forceMinutes) {
    if (res !== '') res += ' ';
    res += `${minutes}m`.padStart(pad + 1, '0');
  }
  if (seconds > 0 || opts.forceSeconds) {
    if (res !== '') res += ' ';
    res += `${seconds}s`.padStart(pad + 1, '0');
  }
  if (res === '') res = '0m'.padStart(pad + 1, '0');
  return res;
}

function formatTimestamp(timestamp: number, opts: FormatTimeOptions = {}): string {
  return formatTime(partitionTime(timestamp), opts);
}

enum DragState {
  None,
  Top,
  Bottom,
}

// HANDLERS
////////////////////////////////////////////////////////////////////////////////

function onCreateTask(status: TaskStatus, description: string) {
  if (!description) return;
  const time = Date.now();
  createTask({
    id: 0,
    description,
    status,
    timeEstimate: DEFAULT_TASK_TIME,
    timeRemaining: 0,
    createdAt: time,
    completedAt: 0,
    fridx: '',
  });
}

const audioDropHandlers = {
  ondragover: (e) => {
    // Prevent default to allow drop
    e.preventDefault();
    e.dataTransfer!.dropEffect = 'copy';
  },
  ondragenter: (e) => {
    e.preventDefault();
  },
  ondrop: (e: DragEvent) => {
    e.dataTransfer!.dropEffect = 'copy';
    e.preventDefault();
    uploadAudioFiles((files) => handleAudioUpload(files))(e);
  },
};

function basicKeydownNavigationHandler(e: KeyboardEvent) {
  console.log('key', e.key);
  if (e.key === 'ArrowUp') navigateEl(e.target as Element, Direction.Up);
  if (e.key === 'ArrowDown') navigateEl(e.target as Element, Direction.Down);
  if (e.key === 'ArrowLeft') navigateEl(e.target as Element, Direction.Left);
  if (e.key === 'ArrowRight') navigateEl(e.target as Element, Direction.Right);
}

// VIEWS
////////////////////////////////////////////////////////////////////////////////

function sectionHeaderView({ title, collapsed, oncollapse, onexpand }) {
  return div(
    {},
    button(
      {
        class: 'collapse-button navigable',
        onclick: () => {
          if (collapsed) {
            onexpand();
          } else {
            oncollapse();
          }
        },
        onkeydown: (e) => {
          console.log('key', e.key);
          if (e.key === 'ArrowLeft') oncollapse();
          if (e.key === 'ArrowRight') onexpand();
          if (e.key === 'ArrowUp') navigateEl(e.target, Direction.Up);
          if (e.key === 'ArrowDown') navigateEl(e.target, Direction.Down);
        },
      },
      div({ class: 'collapse-icon' }, collapsed ? '▸' : '▾'),
      h1({ class: 'section-header' }, title),
    ),
  );
}

function taskView(
  { task, active = false }: { task: Task; active: boolean },
  { dragState = DragState.None },
  update,
) {
  function updateTimeEstimate(e) {
    let time = parseHumanReadableTime(e.target.value);
    updateTask(task, { timeEstimate: time });
  }
  const domId = `task-${task.id}`;

  let resolvedStyles = styles.task;
  if (dragState === DragState.Bottom) resolvedStyles = { ...styles.task, ...styles.taskDropBottom };
  if (dragState === DragState.Top) resolvedStyles = { ...styles.task, ...styles.taskDropTop };

  // get human-readable createdAt from task
  let createdAt = new Date(task.createdAt).toLocaleString();
  // get number of days since task was created
  let daysAgo = Math.floor((Date.now() - task.createdAt) / (1000 * 60 * 60 * 24));
  let daysAgoLabel = daysAgo === 0 ? 'Today' : `${daysAgo} days ago`;

  return div(
    {
      id: domId,
      className: 'task',
      style: resolvedStyles,
      title: `
${daysAgoLabel} - ${createdAt}
`,
      draggable: true,
      ondragover: (e) => {
        e.preventDefault();
        e.dataTransfer.dropEffect = 'move';
        const taskDiv = document.getElementById(domId) as HTMLElement;
        // find whether the mouse is closer to the top or bottom of the element
        const rect = taskDiv.getBoundingClientRect();
        const y = e.clientY - rect.top;
        if (y > rect.height / 2) {
          update({ dragState: DragState.Bottom });
        } else {
          update({ dragState: DragState.Top });
        }
      },
      ondrop: async (e) => {
        e.preventDefault();
        try {
          console.log('drop?', e.dataTransfer.getData('text/plain'), e);
          const taskId = parseInt(e.dataTransfer.getData('text/plain'));
          const taskDiv = document.getElementById(domId) as HTMLElement;
          const rect = taskDiv.getBoundingClientRect();
          const y = e.clientY - rect.top;
          let { idx, list } = idxFromTask(task.id, task.status);
          let newFridx = '';
          if (y > rect.height / 2) {
            console.log('drop bottom');
            // drop below
            let otherTask = list[idx + 1];
            let nextTaskFridx = otherTask?.fridx || null;
            newFridx = generateKeyBetween(task.fridx, nextTaskFridx);
          } else {
            console.log('drop top');
            // drop above
            let prevTask = list[idx - 1];
            let prevTaskFridx = prevTask?.fridx || null;
            newFridx = generateKeyBetween(prevTaskFridx, task.fridx);
          }
          console.log('new fridx', newFridx, taskId);
          let droppedTask = await taskFromId(taskId);
          await updateTask(droppedTask!, { fridx: newFridx, status: task.status });
        } catch (e) {
          console.error(e);
        } finally {
          update({ dragState: DragState.None });
        }
      },
      ondragleave: (e) => {
        e.preventDefault();
        update({ dragState: DragState.None });
      },
      ondragstart: (e) => {
        console.log('drag start');
        e.dataTransfer.setData('text/plain', task.id.toString());
        e.dataTransfer.effectAllowed = 'move';
      },
    },
    span({ class: 'drag-handle' }, '⠿'),
    input({
      class: 'description-input',
      value: task.description,
      oninput: (e) => {
        updateTask(task, { description: e.target.value });
      },
      onkeydown: (e) => {
        console.log('key', e.key);
        if (e.key === 'ArrowUp') navigateEl(e.target, Direction.Up);
        if (e.key === 'ArrowDown') navigateEl(e.target, Direction.Down);
        if (e.key === 'ArrowRight' && e.target.selectionStart === e.target.value.length) {
          navigateEl(e.target, Direction.Right);
        }
      },
    }),
    input({
      class: 'time-input',
      value: formatTimestamp(task.timeEstimate),
      onblur: (e) => {
        updateTimeEstimate(e);
      },
      onkeydown: (e) => {
        if (e.key === 'Enter') updateTimeEstimate(e);
        if (e.key === 'ArrowUp') navigateEl(e.target, Direction.Up);
        if (e.key === 'ArrowDown') navigateEl(e.target, Direction.Down);
        if (e.key === 'ArrowLeft' && e.target.selectionStart === 0) {
          console.log('left');
          navigateEl(e.target, Direction.Left);
        }
        if (e.key === 'ArrowRight' && e.target.selectionStart === e.target.value.length) {
          console.log('right');
          navigateEl(e.target, Direction.Right);
        }
      },
    }),
    div(
      {},
      active &&
        button(
          {
            class: 'navigable',
            onkeydown: basicKeydownNavigationHandler,
            onclick: () => updateTask(task, { status: TASK_COMPLETED }),
          },
          '✓',
        ),
      task.status === TASK_RECURRING &&
        button(
          {
            class: 'navigable',
            onkeydown: basicKeydownNavigationHandler,
            onclick: () => {
              let description = task.description;
              if (!description) return;
              const time = Date.now();
              createTask({
                id: 0,
                description,
                status: TASK_SESSION,
                timeEstimate: task.timeEstimate,
                timeRemaining: 0,
                createdAt: time,
                completedAt: 0,
                fridx: '',
              });
            },
          },
          '+',
        ),
      button(
        {
          class: 'delete-button navigable',
          onkeydown: basicKeydownNavigationHandler,
          onclick: () => deleteTask(task),
        },
        '✕',
      ),
    ),
  );
}

function activeTaskView({ activeTask }: { activeTask: Task | null }) {
  if (!activeTask) {
    return div({ className: 'active-task' }, h1({}, 'No Active Task'));
  }
  return div(
    { className: 'active-task' },
    h1({}, 'Active Task'),
    h(taskView, { task: activeTask, key: activeTask.id, active: true }),
  );
}

function taskListView(tasks: TaskList) {
  const taskListDiv = div(
    { className: 'task-list' },
    ...tasks.list.map((task) => h(taskView, { task, key: task.id })),
  );
  return taskListDiv;
}

function newTaskInputView({ status }: { status: TaskStatus }) {
  return div(
    { class: 'new-task' },
    input({
      type: 'text',
      placeholder: 'Add a task',
      onkeydown: (e) => {
        if (e.key === 'Enter') {
          onCreateTask(status, e.target.value);
          e.target.value = '';
        }
        if (e.key === 'ArrowUp') navigateEl(e.target, Direction.Up);
        if (e.key === 'ArrowDown') navigateEl(e.target, Direction.Down);
        if (e.key === 'ArrowRight') navigateEl(e.target, Direction.Right);
      },
    }),
    div(
      { style: { display: 'flex' } },
      button(
        {
          class: 'square-button navigable',
          onclick: (e) => {
            let inputEl = e.target.previousElementSibling as HTMLInputElement;
            let value = inputEl.value;
            if (!value) return;
            onCreateTask(status, value);
            inputEl.value = '';
          },
          onkeydown: basicKeydownNavigationHandler,
        },
        '+',
      ),
      span({ class: 'square-button' }, ''),
    ),
  );
}

function sessionTasksView({ sessionTasks }: AppState, { collapsed = false }, update) {
  return div(
    { className: 'session-tasks' },
    sectionHeaderView({
      title: 'Session Tasks',
      collapsed,
      oncollapse: () => update({ collapsed: true }),
      onexpand: () => update({ collapsed: false }),
    }),
    collapsed
      ? null
      : [h(taskListView, sessionTasks), h(newTaskInputView, { status: TASK_SESSION })],
  );
}

function recurringTasksView({ recurringTasks }: AppState, { collapsed = false }, update) {
  return div(
    { className: 'recurring-tasks' },
    sectionHeaderView({
      title: 'Recurring Tasks',
      collapsed,
      oncollapse: () => update({ collapsed: true }),
      onexpand: () => update({ collapsed: false }),
    }),
    collapsed
      ? null
      : [h(taskListView, recurringTasks), h(newTaskInputView, { status: TASK_RECURRING })],
  );
}

function completedTasksView({ completedTasks }: AppState, { collapsed = true }, update) {
  return div(
    { className: 'completed-tasks' },
    sectionHeaderView({
      title: 'Completed Tasks',
      collapsed,
      oncollapse: () => update({ collapsed: true }),
      onexpand: () => update({ collapsed: false }),
    }),
    collapsed ? null : h(taskListView, completedTasks),
  );
}

function sessionButtonView({ onclick, label }: { onclick: () => void; label: string }) {
  return button(
    {
      class: 'session-button navigable',
      onclick,
      onkeydown: basicKeydownNavigationHandler,
    },
    label,
  );
}

function pomodoroTimerView(
  { checkpoint, countup, pomodoroDuration, breakDuration, status, speaker }: AppState,
  { renderSignal = 0, prevTimeRemaining = 0, editing = false, editingValue = '' },
  update,
) {
  function updateTimerFromInput(e) {
    let time = parseHumanReadableTime(e.target.value);
    update({ editing: false, editingValue: '' });
    if (status === APP_ACTIVE) {
      setPomodoroDuration(time);
    } else if (status === APP_BREAK) {
      setBreakDuration(time);
    }
  }

  let now = Date.now();
  let negative = false;
  let duration = status === APP_ACTIVE ? pomodoroDuration : breakDuration;
  let timeElapsed = Math.floor((now - checkpoint) / 1000);
  let timeRemaining = Math.floor(duration - timeElapsed);
  let time = countup ? timeElapsed : timeRemaining;
  if (time < 0) {
    time = Math.abs(time);
    negative = true;
  }
  let { hours, minutes, seconds } = partitionTime(time);

  setTimeout(() => {
    if (
      appState.status !== status ||
      appState.checkpoint !== checkpoint ||
      appState.countup !== countup ||
      appState.pomodoroDuration !== pomodoroDuration ||
      appState.breakDuration !== breakDuration ||
      appState.speaker !== speaker
    )
      return;
    update({ renderSignal: renderSignal + 1, prevTimeRemaining: timeRemaining });
  }, 400);

  if (isLeader()) {
    if (status === APP_BREAK) {
      if (prevTimeRemaining > 0 && timeRemaining <= 0) {
        playSpeech(`public/speech/break_over_${appState.speaker}.mp3`);
      }
    }
    if (status === APP_ACTIVE) {
      if (prevTimeRemaining > 0 && timeRemaining <= 0) {
        playSpeech(`public/speech/break_start_${appState.speaker}.mp3`);
      }
    }
  }

  let className = 'pomodoro';
  let label = '';
  if (editing) label = editingValue;
  else {
    if (negative || (countup && time > duration)) className += ' elapsed';
    label = formatTime(
      { hours, minutes, seconds },
      { forceMinutes: true, forceSeconds: true, pad: 2 },
    );
    if (negative) label = '-' + label;
  }

  return div(
    { class: 'pomodoro-wrapper' },
    button({ class: 'flip-icon', onclick: flipCountDirection }, '⮃'),
    input({
      class: className,
      value: label,
      oninput: (e) => {
        update({ editing: true, editingValue: e.target.value });
      },
      onblur: (e) => {
        if (editing) updateTimerFromInput(e);
      },
      onkeydown: (e) => {
        if (e.key === 'Enter' && editing) updateTimerFromInput(e);
        if (e.key === 'ArrowUp') navigateEl(e.target, Direction.Up);
        if (e.key === 'ArrowDown') navigateEl(e.target, Direction.Down);
      },
    }),
  );
}

const audioUploadView = (props: AppState) => {
  if (props.audioUploadState === 1) {
    return div(
      {
        className: 'audio-controls',
        ...audioDropHandlers,
      },
      h('label', { for: 'audio-upload' }, 'Upload Audio'),
      input({
        id: 'audio-upload',
        type: 'file',
        multiple: true,
        accept: 'audio/*',
        onchange: (e) => {
          console.log('change', e);
          uploadAudioFiles((files) => handleAudioUpload(files))(e);
        },
        ...audioDropHandlers,
      }),
      button(
        {
          onclick: () => {
            audioStore.clear();
          },
          ...audioDropHandlers,
        },
        'Delete Audio',
      ),
    );
  } else {
    return div(
      {
        className: 'audio-controls',
      },
      div({ className: 'progress', style: { width: props.audioUploadState * 100 + '%' } }),
    );
  }
};

function appView(props: AppState) {
  console.log('ui', appState.tabs);
  if (props.status === APP_IDLE || props.sessionTasks.list.length === 0) {
    return div(
      { className: 'tasks-bar' },
      // props.tabs.map((tab) => p({}, tab)),
      h(sessionButtonView, {
        onclick: () => {
          playShuffledAudio();
          startSession();
        },
        label: 'Start Session',
      }),
      h(sessionTasksView, { key: 'session', ...props }),
      h(recurringTasksView, { key: 'recurring', ...props }),
      h(completedTasksView, { key: 'completed', ...props }),
      h(audioUploadView, props),
    );
  } else {
    return div(
      { className: 'tasks-bar' },
      div({}, isLeader() ? 'Leader' : 'Follower'),
      // pomodoro timer
      h(pomodoroTimerView, props),
      // buttons
      props.status === APP_ACTIVE
        ? h(sessionButtonView, {
            onclick: () => {
              stopMusic();
              breakSession();
            },
            label: 'Take Break',
          })
        : h(sessionButtonView, {
            onclick: () => {
              playShuffledAudio();
              resumeSession();
            },
            label: 'Resume',
          }),
      span({}, ' '),
      h(sessionButtonView, {
        onclick: () => {
          stopMusic();
          endSession();
        },
        label: 'End Session',
      }),
      // active task
      h(activeTaskView, { key: 'active', activeTask: props.sessionTasks.list[0] }),
      // task lists
      h(sessionTasksView, {
        key: 'session',
        ...props,
        sessionTasks: { list: props.sessionTasks.list.slice(1) },
      }),
      h(recurringTasksView, { key: 'recurring', ...props }),
      h(completedTasksView, { key: 'completed', ...props }),
      h(audioUploadView, props),
    );
  }
}

// RENDER
////////////////////////////////////////////////////////////////////////////////

const root = document.getElementById('app') as DNode;
render(h(appView, appState), root);

function redraw() {
  console.log('redraw');
  diff(h(appView, appState), root, root._vnode!);
}

callback.onChange = redraw;
