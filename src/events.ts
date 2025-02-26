import { generateKeyBetween } from './fridx';
import {
  appState,
  completedTasks,
  readFromLocalStorage,
  recurringTasks,
  sessionTasks,
  writeToLocalStorage,
} from './state';
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
  AppStatus,
} from './types';

export const callback = {
  onChange: () => {
    console.log('callback onChange');
  },
};

const channel = new BroadcastChannel('ease');
type MessageTypes =
  | 'rollcallInit'
  | 'rollcallRespond'
  | 'goodbye'
  | 'updateTask'
  | 'resetTasks'
  | 'resetAudio'
  | 'sessionChange';
type MessageData = {
  type: MessageTypes;
  id: number;
};
type Message = {
  data: MessageData;
  tabId: string;
};

// Map of pending messages and their resolvers so that the sender can await a response
function postMessage(data: MessageData) {
  channel.postMessage({ data, tabId: appState.tabId });
}

// All tabs update state from the storage on message
channel.addEventListener('message', async (e) => {
  let { data, tabId }: Message = e.data;
  console.log('received message', data);
  if (data.type === 'rollcallInit') {
    appState.tabs = [appState.tabId, tabId];
    postMessage({ type: 'rollcallRespond', id: 0 });
    callback.onChange();
  }
  if (data.type === 'rollcallRespond') {
    appState.tabs.push(tabId.toString());
    callback.onChange();
  }
  if (data.type === 'goodbye') {
    appState.tabs = appState.tabs.filter((tab) => tab !== tabId);
    callback.onChange;
  }
  if (data.type === 'sessionChange') {
    await readFromLocalStorage();
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

export function rollcall() {
  appState.tabs = [appState.tabId];
  postMessage({ type: 'rollcallInit', id: 0 });
  callback.onChange();
}

export async function flipCountDirection() {
  appState.countup = !appState.countup;
  callback.onChange();
  await writeToLocalStorage();
  postMessage({ type: 'sessionChange', id: 0 });
}

export async function startSession() {
  appState.status = APP_ACTIVE;
  appState.sessionId = getId(); // TODO
  appState.checkpoint = Date.now();
  callback.onChange();
  await writeToLocalStorage();
  postMessage({ type: 'sessionChange', id: 0 });
}
export async function pauseSession() {
  appState.status = APP_PAUSED;
  appState.checkpoint = Date.now();
  callback.onChange();
  await writeToLocalStorage();
  postMessage({ type: 'sessionChange', id: 0 });
}
export async function endSession() {
  appState.status = APP_IDLE;
  appState.sessionId = 0;
  appState.checkpoint = 0;
  callback.onChange();
  await writeToLocalStorage();
  postMessage({ type: 'sessionChange', id: 0 });
}

window.addEventListener('beforeunload', async function (event) {
  let tabs = appState.tabs;
  postMessage({ type: 'goodbye', id: 0 });
  if (appState.status !== APP_IDLE && tabs.length === 0) {
    console.log('Session is active.');
    event.preventDefault();
    endSession();
    // event.returnValue = 'Are you sure you want to leave?';
  }
});

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
  postMessage({ type: 'updateTask', id: task.id });
}

export async function deleteTask(task: Task) {
  await taskStore.delete(task.id);
  removeTaskFromLists(task);
  callback.onChange();
  postMessage({ type: 'updateTask', id: task.id });
}

export async function updateTask(task: Task, update: Partial<Task>) {
  removeTaskFromLists(task);
  const updatedTask = { ...task, ...update };
  await taskStore.upsert(updatedTask);
  addTaskToLists(updatedTask);
  callback.onChange();
  postMessage({ type: 'updateTask', id: task.id });
}
