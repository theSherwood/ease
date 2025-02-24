import { generateKeyBetween } from './fridx';
import { appState, completedTasks, recurringTasks, sessionTasks } from './state';
import { ListStore, EASE_STORE, getId, taskStore, audioStore } from './storage';
import {
  TASK_COMPLETED,
  TASK_SESSION,
  TASK_RECURRING,
  Task,
  TaskList,
  TaskStatus,
  APP_ACTIVE,
  APP_PAUSED,
  APP_IDLE,
} from './types';

export const callback = {
  onChange: () => {
    console.log('callback onChange');
  },
};

const windowId = Math.random().toString(36);
const channel = new BroadcastChannel('ease');
type MessageTypes =
  | 'updateTask'
  | 'resetTasks'
  | 'resetAudio'
  | 'startSession'
  | 'pauseSession'
  | 'endSession';
type Message = {
  type: MessageTypes;
  id: number;
  field?: keyof Task;
  prev?: any;
};

// Map of pending messages and their resolvers so that the sender can await a response
function postTaskMessage(data: Message) {
  channel.postMessage({ data, windowId });
}

// All tabs update state from the storage on message
channel.addEventListener('message', async (e) => {
  let data: Message = e.data.data;
  console.log('received message', data);
  if (data.type === 'startSession') {
    localStorage.setItem('appStatus', APP_ACTIVE.toString());
    appState.status = APP_ACTIVE;
    callback.onChange();
  }
  if (data.type === 'pauseSession') {
    localStorage.setItem('appStatus', APP_PAUSED.toString());
    appState.status = APP_PAUSED;
    callback.onChange();
  }
  if (data.type === 'endSession') {
    localStorage.setItem('appStatus', APP_IDLE.toString());
    appState.status = APP_IDLE;
    callback.onChange();
  }
  if (data.type === 'updateTask') {
    removeTaskFromLists(data.id);
    const task = await taskStore.get(data.id);
    if (task !== null) addTaskToLists(task);
    callback.onChange();
  }
  if (data.type === 'resetTasks') {
    await populateTasks();
  }
  if (data.type === 'resetAudio') {
    // TODO
  }
});

export function startSession() {
  postTaskMessage({ type: 'startSession', id: 0 });
}
export function pauseSession() {
  postTaskMessage({ type: 'pauseSession', id: 0 });
}
export function endSession() {
  postTaskMessage({ type: 'endSession', id: 0 });
}

async function storeTask(config: Task) {
  config.id = getId();
  if (!config.fridx) {
    let lastTask;
    if (config.status === TASK_SESSION) lastTask = sessionTasks.list[sessionTasks.list.length - 1];
    if (config.status === TASK_RECURRING)
      lastTask = recurringTasks.list[recurringTasks.list.length - 1];
    if (config.status === TASK_COMPLETED)
      lastTask = completedTasks.list[completedTasks.list.length - 1];
    config.fridx = generateKeyBetween(lastTask?.fridx || null, null);
  }
  await taskStore.add(config);
  return config;
}

function removeTaskFromLists(task: number | Task) {
  if (typeof task === 'number') {
    removeTaskFromList(task, sessionTasks);
    removeTaskFromList(task, recurringTasks);
    removeTaskFromList(task, completedTasks);
  } else {
    if (task.status === TASK_SESSION) removeTaskFromList(task.id, sessionTasks);
    if (task.status === TASK_RECURRING) removeTaskFromList(task.id, recurringTasks);
    if (task.status === TASK_COMPLETED) removeTaskFromList(task.id, completedTasks);
  }
}

function addTaskToLists(task: Task) {
  if (task.status === TASK_SESSION) addTaskToList(task, sessionTasks);
  if (task.status === TASK_RECURRING) addTaskToList(task, recurringTasks);
  if (task.status === TASK_COMPLETED) addTaskToList(task, completedTasks);
}

export function idxFromTask(id: number, status: TaskStatus) {
  let list: Task[] = [];
  if (status === TASK_SESSION) list = sessionTasks.list;
  if (status === TASK_RECURRING) list = recurringTasks.list;
  if (status === TASK_COMPLETED) list = completedTasks.list;
  return { idx: list.findIndex((t) => t.id === id), list };
}

export async function idxFromId(id: number) {
  const taskConfig = await taskStore.get(id);
  if (taskConfig === null) return { idx: -1, list: [] };
  return idxFromTask(id, taskConfig.status);
}

export async function taskFromId(id: number): Promise<Task | null> {
  let storeTask = await taskStore.get(id);
  if (!storeTask) return null;
  let task: Task | undefined;
  if (storeTask?.status === TASK_SESSION) task = sessionTasks.list.find((t) => t.id === id);
  if (storeTask?.status === TASK_RECURRING) task = recurringTasks.list.find((t) => t.id === id);
  if (storeTask?.status === TASK_COMPLETED) task = completedTasks.list.find((t) => t.id === id);
  Object.assign(task!, storeTask);
  return task!;
}

function addTaskToList(task: Task, list: TaskList) {
  list.list.push(task);
  list.list.sort((a, b) => (a.fridx > b.fridx ? 1 : -1));
  list.list = list.list;
  console.log('added task', task, list.list);
}

function removeTaskFromList(taskId: number, list: TaskList) {
  let found = false;
  const newList = list.list.filter((t) => {
    if (t.id !== taskId) return true;
    found = true;
  });
  if (found) list.list = newList;
}

export async function populateTasks() {
  for await (const task of taskStore.iterate()) {
    addTaskToLists(task);
  }
  callback.onChange();
}

export async function createTask(taskConfig: Task) {
  const task = await storeTask(taskConfig);
  addTaskToLists(task);
  callback.onChange();
  postTaskMessage({ type: 'updateTask', id: task.id });
}

export async function deleteTask(task: Task) {
  await taskStore.delete(task.id);
  removeTaskFromLists(task);
  callback.onChange();
  postTaskMessage({ type: 'updateTask', id: task.id });
}

export async function updateTask(task: Task, update: Partial<Task>) {
  removeTaskFromLists(task);
  const updatedTask = { ...task, ...update };
  await taskStore.upsert(updatedTask);
  addTaskToLists(updatedTask);
  callback.onChange();
  postTaskMessage({ type: 'updateTask', id: task.id });
}
