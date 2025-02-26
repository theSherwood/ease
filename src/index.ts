import { generateKeyBetween } from './fridx';
import { setupStore } from './storage';
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
  pauseSession,
  rollcall,
  flipCountDirection,
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
} from './types';
import { appState } from './state';
const { div, h1, button, p, input, span } = dom;

const DEFAULT_TASK_TIME = 25 * 60;

setupStore().then(() => {
  populateTasks();
});

rollcall();

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
    if (includesHours) {
      const hours = parseInt(timeStr.split('h', 2)[0]);
      if (hours) time += hours * 60 * 60;
      timeStr = timeStr.split('h', 2)[1];
    }
    if (includesMinutes) {
      const minutes = parseInt(timeStr.split('m', 2)[0]);
      if (minutes) time += minutes * 60;
    }
    if (!includesHours && !includesMinutes) {
      time = parseInt(timeStr) * 60;
    }
    return time;
  } catch (e) {
    return DEFAULT_TASK_TIME;
  }
}

function partitionTime(time: number): { hours; minutes; seconds } {
  const hours = Math.floor(time / 3600);
  const minutes = Math.floor((time % 3600) / 60);
  const seconds = Math.floor(time % 60);
  return { hours, minutes, seconds };
}

function formatTime(time: number): string {
  const { hours, minutes, seconds } = partitionTime(time);
  let res = '';
  if (hours > 0) res += `${hours}h `;
  if (minutes > 0) res += `${minutes}m`;
  if (seconds > 0) res += `${seconds}s`;
  if (res === '') res = '0m';
  return res;
}

function padTime(time: number): string {
  return time.toString().padStart(2, '0');
}

enum DragState {
  None,
  Top,
  Bottom,
}

function sectionHeader({ title, collapsed, oncollapse, onexpand }) {
  return div(
    {},
    button(
      {
        class: 'collapse-button',
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

  return div(
    {
      id: domId,
      className: 'task',
      style: resolvedStyles,
      draggable: true,
      ondragover: (e) => {
        e.preventDefault();
        e.dataTransfer.dropEffect = 'move';
        // console.log('drag over', e);
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
    }),
    input({
      class: 'time-input',
      value: formatTime(task.timeEstimate),
      onblur: (e) => {
        updateTimeEstimate(e);
      },
      onkeydown: (e) => {
        if (e.key === 'Enter') {
          updateTimeEstimate(e);
        }
      },
    }),
    div(
      {},
      active && button({ onclick: () => updateTask(task, { status: TASK_COMPLETED }) }, '✓'),
      task.status === TASK_RECURRING &&
        button(
          {
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
      button({ class: 'delete-button', onclick: () => deleteTask(task) }, '✕'),
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

function newTaskInput({ status }: { status: TaskStatus }) {
  return input({
    type: 'text',
    placeholder: 'Add a task',
    onkeydown: (e) => {
      if (e.key === 'Enter') {
        const description = e.target.value;
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
        e.target.value = '';
      }
    },
  });
}

function sessionTasksView({ sessionTasks }: AppState, { collapsed = false }, update) {
  return div(
    { className: 'session-tasks' },
    sectionHeader({
      title: 'Session Tasks',
      collapsed,
      oncollapse: () => update({ collapsed: true }),
      onexpand: () => update({ collapsed: false }),
    }),
    collapsed ? null : [h(taskListView, sessionTasks), h(newTaskInput, { status: TASK_SESSION })],
  );
}

function recurringTasksView({ recurringTasks }: AppState, { collapsed = false }, update) {
  return div(
    { className: 'recurring-tasks' },
    sectionHeader({
      title: 'Recurring Tasks',
      collapsed,
      oncollapse: () => update({ collapsed: true }),
      onexpand: () => update({ collapsed: false }),
    }),
    collapsed
      ? null
      : [h(taskListView, recurringTasks), h(newTaskInput, { status: TASK_RECURRING })],
  );
}

function completedTasksView({ completedTasks }: AppState, { collapsed = true }, update) {
  return div(
    { className: 'completed-tasks' },
    sectionHeader({
      title: 'Completed Tasks',
      collapsed,
      oncollapse: () => update({ collapsed: true }),
      onexpand: () => update({ collapsed: false }),
    }),
    collapsed ? null : h(taskListView, completedTasks),
  );
}

function sessionButton({ onclick, label }: { onclick: () => void; label: string }) {
  return button({ onclick }, label);
}

function pomodoroTimer(
  { checkpoint, countup, pomodoroDuration, breakDuration }: AppState,
  { renderSignal = 0 },
  update,
) {
  setTimeout(() => {
    if (
      appState.checkpoint !== checkpoint ||
      appState.countup !== countup ||
      appState.pomodoroDuration !== pomodoroDuration ||
      appState.breakDuration !== breakDuration
    )
      return;
    update({ renderSignal: renderSignal + 1 });
  }, 400);
  let now = Date.now();
  let time = 0;
  let negative = false;
  let duration = pomodoroDuration;
  if (countup) time = Math.floor((now - checkpoint) / 1000);
  else time = Math.floor(duration - (now - checkpoint) / 1000);
  if (time < 0) {
    time = Math.abs(time);
    negative = true;
  }
  let { hours, minutes, seconds } = partitionTime(time);
  let className = 'pomodoro';
  if (negative || (countup && time > duration)) className += ' elapsed';
  let label = `${padTime(hours)}:${padTime(minutes)}:${padTime(seconds)}`;
  if (negative) label = '-' + label;
  return div(
    { class: 'pomodoro-wrapper' },
    button({ class: 'flip-icon', onclick: flipCountDirection }, '⮃'),
    span({ className }, label),
  );
}

function ui(props: AppState) {
  console.log('ui', appState.tabs);
  if (props.status === APP_IDLE || props.sessionTasks.list.length === 0) {
    return div(
      { className: 'tasks-bar' },
      // props.tabs.map((tab) => p({}, tab)),
      h(sessionButton, { onclick: startSession, label: 'Start Session' }),
      h(sessionTasksView, { key: 'session', ...props }),
      h(recurringTasksView, { key: 'recurring', ...props }),
      h(completedTasksView, { key: 'completed', ...props }),
    );
  } else {
    return div(
      { className: 'tasks-bar' },
      // props.tabs.map((tab) => p({}, tab)),
      // pomodoro timer
      h(pomodoroTimer, props),
      // buttons
      props.status === APP_ACTIVE
        ? h(sessionButton, { onclick: pauseSession, label: 'Take Break' })
        : h(sessionButton, { onclick: startSession, label: 'Resume' }),
      span({}, ' '),
      h(sessionButton, { onclick: endSession, label: 'End Session' }),
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
    );
  }
}

const root = document.getElementById('app') as DNode;
render(h(ui, appState), root);

function redraw() {
  console.log('redraw');
  diff(h(ui, appState), root, root._vnode!);
}

callback.onChange = redraw;
