import { generateKeyBetween } from './fridx';
import { setupStore } from './storage';
import {
  createTask,
  deleteTask,
  updateTask,
  Task,
  TaskListState,
  populateTasks,
  sessionTasks,
  recurringTasks,
  completedTasks,
  updateTaskField,
  idxFromId,
  idxFromTask,
  taskFromId,
} from './tasks';
import { createState, $, $$, dom } from './tiny';
import { TASK_SESSION, TASK_RECURRING, TaskStatus, TASK_COMPLETED } from './types';
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

function taskView(task: Task) {
  const descriptionInput = input({
    value: task.description,
    oninput: (e) => {
      updateTaskField(task, 'description', e.target.value);
    },
  }) as HTMLInputElement;
  task.addUpdate('description', () => {
    descriptionInput.value = task.description;
  });

  const timeEstimateInput = input({
    value: formatTime(task.timeEstimate),
    onblur: (e) => {
      updateTimeEstimate(e);
    },
    onkeydown: (e) => {
      if (e.key === 'Enter') {
        updateTimeEstimate(e);
      }
    },
  }) as HTMLInputElement;
  task.addUpdate('timeEstimate', () => {
    timeEstimateInput.value = formatTime(task.timeEstimate);
  });
  function updateTimeEstimate(e) {
    let time = parseHumanReadableTime(e.target.value);
    updateTaskField(task, 'timeEstimate', time);
    timeEstimateInput.value = formatTime(time);
  }

  const buttonContainer = div();
  const DndHandle = span(
    {
      style: { cursor: 'grab', userSelect: 'none' },
      ondrag: (e) => {
        console.log('dragging');
      },
      ondragstart: (e) => {
        console.log('drag start');
        e.dataTransfer.setData('text/plain', task.id.toString());
        e.dataTransfer.effectAllowed = 'move';
      },
    },
    '🔲',
  );
  const taskDiv = div({
    className: 'task',
    style: styles.task,
    draggable: true,
    ondragover: (e) => {
      e.preventDefault();
      e.dataTransfer.dropEffect = 'move';
      console.log('drag over', e);
      // find whether the mouse is closer to the top or bottom of the element
      const rect = taskDiv.getBoundingClientRect();
      const y = e.clientY - rect.top;
      if (y > rect.height / 2) {
        Object.assign(taskDiv.style, styles.taskDropBottom);
      } else {
        Object.assign(taskDiv.style, styles.taskDropTop);
      }
    },
    ondrop: async (e) => {
      e.preventDefault();
      try {
        console.log('drop?', e.dataTransfer.getData('text/plain'), e);
        const taskId = parseInt(e.dataTransfer.getData('text/plain'));
        const rect = taskDiv.getBoundingClientRect();
        const y = e.clientY - rect.top;
        let { idx, list } = idxFromTask(task.id, task.status);
        let newFridx = null;
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
        updateTaskField(droppedTask!.task, 'fridx', newFridx);
      } catch (e) {
        console.error(e);
      } finally {
        Object.assign(taskDiv.style, styles.task);
      }
    },
    ondragleave: (e) => {
      e.preventDefault();
      Object.assign(taskDiv.style, styles.task);
    },
  });
  const update = () => {
    taskDiv.innerHTML = '';
    taskDiv.append(DndHandle);
    taskDiv.append(descriptionInput);
    taskDiv.append(timeEstimateInput);
    taskDiv.append(buttonContainer);
  };
  update();

  const deleteButton = button(
    { style: styles.taskDeleteButton, onclick: () => deleteTask(task) },
    'X',
  );
  const promoteButton = button(
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
  );
  const updateButtons = () => {
    buttonContainer.innerHTML = '';
    if (task.status === TASK_RECURRING) buttonContainer.append(promoteButton);
    if (task.status !== TASK_COMPLETED) buttonContainer.append(deleteButton);
  };
  updateButtons();
  task.addUpdate('status', updateButtons);

  return taskDiv;
}

function taskListView(tasks: TaskListState) {
  const taskListDiv = div({ className: 'task-list' });
  const update = () => {
    taskListDiv.innerHTML = '';
    tasks.list.forEach((t) => taskListDiv.append(taskView(t)));
  };
  tasks.addUpdate('list', update);
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

function sessionTasksView() {
  return div(
    { className: 'session-tasks' },
    h1('Session Tasks'),
    taskListView(sessionTasks),
    newTaskInput({ status: TASK_SESSION }),
  );
}

function recurringTasksView() {
  return div(
    { className: 'recurring-tasks' },
    h1('Recurring Tasks'),
    taskListView(recurringTasks),
    newTaskInput({ status: TASK_RECURRING }),
  );
}

function completedTasksView() {
  return div(
    { className: 'completed-tasks' },
    h1('Completed Tasks'),

    taskListView(completedTasks),
  );
}

function ui() {
  const tasksBar = div(
    { className: 'tasks-bar' },
    sessionTasksView(),
    recurringTasksView(),
    completedTasksView(),
  );
  return tasksBar;
}

$('#app')?.append(ui());
