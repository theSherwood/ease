import { generateKeyBetween } from './fridx';
import { ListStore, EASE_STORE, getId, taskStore, audioStore } from './storage';
import { TASK_COMPLETED, TASK_SESSION, TASK_RECURRING, Task, TaskStatus } from './types';

export const callback = {
  onChange: () => {
    console.log('callback onChange');
  },
};

const windowId = Math.random().toString(36);
const channel = new BroadcastChannel('ease');
type MessageTypes =
  | 'createTask'
  | 'deleteTask'
  | 'updateTask'
  | 'resetTasks'
  | 'resetAudio'
  | 'updateTaskField';
type Message = {
  type: MessageTypes;
  id: number;
  field?: keyof Task;
  prev?: any;
};

let maxMessageId = 0;
function getMessageId() {
  return ++maxMessageId;
}

// Map of pending messages and their resolvers so that the sender can await a response
function postTaskMessage(data: Message) {
  channel.postMessage({ data, windowId });
}

// All tabs update state from the storage on message
channel.addEventListener('message', async (e) => {
  let data: Message = e.data.data;
  console.log('received message', data);
  if (data.type === 'deleteTask') {
    removeTaskFromList(data.id, sessionTasks);
    removeTaskFromList(data.id, recurringTasks);
    removeTaskFromList(data.id, completedTasks);
    callback.onChange();
  }
  if (data.type === 'createTask') {
    await onCreateTask(data.id);
  }
  if (data.type === 'updateTask') {
    //
  }
  if (data.type === 'updateTaskField') {
    if (data.field === 'status') {
      let prevStatus = data.prev;
      if (prevStatus === TASK_SESSION) removeTaskFromList(data.id, sessionTasks);
      if (prevStatus === TASK_RECURRING) removeTaskFromList(data.id, recurringTasks);
      if (prevStatus === TASK_COMPLETED) removeTaskFromList(data.id, completedTasks);
      await onCreateTask(data.id);
    } else {
      let task = await taskFromId(data.id);
      if (task) callback.onChange();
    }
  }
  if (data.type === 'resetTasks') {
    await populateTasks();
  }
  if (data.type === 'resetAudio') {
    // TODO
  }
});

export type TaskList = { list: Task[] };

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

export const sessionTasks: TaskList = { list: [] };
export const recurringTasks: TaskList = { list: [] };
export const completedTasks: TaskList = { list: [] };

async function onCreateTask(id: number) {
  const task = await taskStore.get(id);
  if (task === null) return;
  if (task.status === TASK_SESSION) addTaskToList(task, sessionTasks);
  if (task.status === TASK_RECURRING) addTaskToList(task, recurringTasks);
  if (task.status === TASK_COMPLETED) addTaskToList(task, completedTasks);
  callback.onChange();
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
  // list.list.sort((a, b) => a.fridx.localeCompare(b.fridx));
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
    if (task.status === TASK_SESSION) addTaskToList(task, sessionTasks);
    if (task.status === TASK_RECURRING) addTaskToList(task, recurringTasks);
    if (task.status === TASK_COMPLETED) addTaskToList(task, completedTasks);
  }
  callback.onChange();
}

export async function createTask(taskConfig: Task) {
  const task = await storeTask(taskConfig);
  if (taskConfig.status === TASK_SESSION) addTaskToList(task, sessionTasks);
  if (taskConfig.status === TASK_RECURRING) addTaskToList(task, recurringTasks);
  if (taskConfig.status === TASK_COMPLETED) addTaskToList(task, completedTasks);
  callback.onChange();
  postTaskMessage({ type: 'createTask', id: task.id });
}

export async function deleteTask(task: Task) {
  await taskStore.delete(task.id);
  if (task.status === TASK_SESSION) removeTaskFromList(task.id, sessionTasks);
  if (task.status === TASK_RECURRING) removeTaskFromList(task.id, recurringTasks);
  if (task.status === TASK_COMPLETED) removeTaskFromList(task.id, completedTasks);
  console.log('deleted task', task, sessionTasks.list);
  callback.onChange();
  postTaskMessage({ type: 'deleteTask', id: task.id });
}

export async function updateTask(task: Task, update: Partial<Task>) {
  let newConfig: Task = {
    description: task.description,
    status: task.status,
    timeEstimate: task.timeEstimate,
    timeRemaining: task.timeRemaining,
    createdAt: task.createdAt,
    completedAt: task.completedAt,
    fridx: task.fridx,
    ...update,
    id: task.id,
  };
  await taskStore.upsert(newConfig);
  callback.onChange();
  postTaskMessage({ type: 'updateTask', id: task.id });
}

export async function updateTaskField(task: Task, field: keyof Task, value: any) {
  console.log('updateTaskField', task, field, value, task[field]);
  const prev = task[field];
  // @ts-ignore
  task[field] = value;
  await taskStore.upsert(task);
  postTaskMessage({ type: 'updateTaskField', id: task.id, field, prev });
}
