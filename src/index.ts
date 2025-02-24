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

let commonTaskStyles = {
  display: 'flex',
  justifyContent: 'space-between',
  alignItems: 'center',
  padding: '0 1rem',
  gap: '1rem',
  backgroundColor: 'var(--bg-task)',
};

let styles = {
  task: {
    ...commonTaskStyles,
    borderTop: '2px solid transparent',
    borderBottom: '2px solid transparent',
    transition: 'all 0.2s ease',
  },
  taskDropTop: {
    ...commonTaskStyles,
    borderTop: '2px solid var(--accent)',
  },
  taskDropBottom: {
    ...commonTaskStyles,
    borderBottom: '2px solid var(--accent)',
  },
  taskDeleteButton: {
    padding: '0.5rem 1rem',
    backgroundColor: 'var(--bg-danger)',
    color: 'var(--text)',
    border: 'none',
    borderRadius: '4px',
    cursor: 'pointer',
  },
  taskDragHandle: {
    cursor: 'grab',
    userSelect: 'none',
    color: 'var(--text-muted)',
  },
  collapseButton: {
    display: 'flex',
    alignItems: 'center',
    backgroundColor: 'transparent',
    border: 'none',
    color: 'var(--text-muted)',
    cursor: 'pointer',
    padding: '0',
    fontSize: '1.2rem',
    marginRight: '0.5rem',
  },
  sectionHeader: {},
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

function formatTime(time: number): string {
  const hours = Math.floor(time / 3600);
  const minutes = Math.floor((time % 3600) / 60);
  let res = '';
  if (hours > 0) res += `${hours}h `;
  if (minutes > 0) res += `${minutes}m`;
  if (res === '') res = '0m';
  return res;
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
        style: styles.collapseButton,
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
      // collapsed ? '▸' : '▾',
      h1({ style: styles.sectionHeader }, title),
    ),
  );
}

function taskView(task: Task, { dragState = DragState.None }, update) {
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
    span({ style: styles.taskDragHandle }, '⠿'),
    input({
      value: task.description,
      oninput: (e) => {
        updateTask(task, { description: e.target.value });
      },
    }),
    input({
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
          'Queue',
        ),
      task.status !== TASK_COMPLETED &&
        button({ style: styles.taskDeleteButton, onclick: () => deleteTask(task) }, 'X'),
    ),
  );
}

function activeTaskView({ activeTask }: { activeTask: Task | null }) {
  if (!activeTask) {
    return div({ className: 'active-task' }, h1({}, 'No Active Task'));
  }
  return div({ className: 'active-task' }, h1({}, 'Active Task'), h(taskView, activeTask));
}

function taskListView(tasks: TaskList) {
  const taskListDiv = div({ className: 'task-list' }, ...tasks.list.map((t) => h(taskView, t)));
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

function ui(props: AppState) {
  if (props.status === APP_IDLE || props.sessionTasks.list.length === 0) {
    return div(
      { className: 'tasks-bar' },
      h(sessionButton, { onclick: startSession, label: 'Start Session' }),
      h(sessionTasksView, { key: 'session', ...props }),
      h(recurringTasksView, { key: 'recurring', ...props }),
      h(completedTasksView, { key: 'completed', ...props }),
    );
  } else {
    return div(
      { className: 'tasks-bar' },
      props.status === APP_ACTIVE
        ? h(sessionButton, { onclick: pauseSession, label: 'Pause Session' })
        : h(sessionButton, { onclick: startSession, label: 'Resume Session' }),
      h(sessionButton, { onclick: endSession, label: 'End Session' }),
      h(activeTaskView, { key: 'active', activeTask: props.sessionTasks.list[0] }),
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
  diff(h(ui, appState), root, root._vnode!);
}

callback.onChange = redraw;
