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
  padding: '0.5rem',
};
let styles = {
  task: {
    ...commonTaskStyles,
    borderTop: '1px solid #ccc',
    borderBottom: '1px solid #ccc',
  },
  taskDropTop: {
    ...commonTaskStyles,
    borderTop: '1px solid #f00',
    borderBottom: '1px solid #ccc',
  },
  taskDropBottom: {
    ...commonTaskStyles,
    borderTop: '1px solid #ccc',
    borderBottom: '1px solid #f00',
  },
  taskDeleteButton: {
    marginLeft: '1rem',
  },
  taskDragHandle: { cursor: 'grab', userSelect: 'none' },
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

function taskView(task: Task, { dragState = DragState.None, timeSignal = 0 }, update) {
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

function sessionTasksView({ sessionTasks }: AppState) {
  return div(
    { className: 'session-tasks' },
    h1({}, 'Session Tasks'),
    h(taskListView, sessionTasks),
    h(newTaskInput, { status: TASK_SESSION }),
  );
}

function recurringTasksView({ recurringTasks }: AppState) {
  return div(
    { className: 'recurring-tasks' },
    h1({}, 'Recurring Tasks'),
    h(taskListView, recurringTasks),
    h(newTaskInput, { status: TASK_RECURRING }),
  );
}

function completedTasksView({ completedTasks }: AppState) {
  return div(
    { className: 'completed-tasks' },
    h1({}, 'Completed Tasks'),
    h(taskListView, completedTasks),
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
