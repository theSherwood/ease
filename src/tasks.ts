import { generateKeyBetween } from './fridx';
import { ListStore, EASE_STORE, getId, taskStore, audioStore } from './storage';
import { createState, $, $$, dom } from './tiny';
import { TASK_COMPLETED, TASK_SESSION, TASK_RECURRING, TaskConfig, TaskStatus } from './types';

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
  field?: keyof TaskConfig;
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
  }
  if (data.type === 'createTask') {
    onCreateTask(data.id);
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
    } else if (data.field === 'fridx') {
      console.log('fridx update', data);
      let res = await taskFromId(data.id);
      if (!res) return;
      let { task, config } = res;
      let tasks: TaskListState;
      if (config.status === TASK_SESSION) tasks = sessionTasks;
      if (config.status === TASK_RECURRING) tasks = recurringTasks;
      if (config.status === TASK_COMPLETED) tasks = completedTasks;
      tasks!.list.sort((a, b) => a.fridx.localeCompare(b.fridx));
      tasks!.list = tasks!.list;
    } else {
      let res = await taskFromId(data.id);
      if (!res) return;
      let { task, config } = res;
      task[data.field! as string] = config[data.field!];
    }
  }
  if (data.type === 'resetTasks') {
    populateTasks();
  }
  if (data.type === 'resetAudio') {
    // TODO
  }
});

export type Task = ReturnType<typeof taskFromTaskConfig>;
export type TaskList = { list: Task[] };
export type TaskListState = ReturnType<typeof createState<TaskList>>;

function taskFromTaskConfig(config: TaskConfig) {
  return createState(config);
}
async function storeTask(config: TaskConfig) {
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
  return taskFromTaskConfig(config);
}

export const sessionTasks = createState<TaskList>({ list: [] });
export const recurringTasks = createState<TaskList>({ list: [] });
export const completedTasks = createState<TaskList>({ list: [] });

async function onCreateTask(id: number) {
  const taskConfig = await taskStore.get(id);
  if (taskConfig === null) return;
  const task = taskFromTaskConfig(taskConfig);
  if (taskConfig.status === TASK_SESSION) addTaskToList(task, sessionTasks);
  if (taskConfig.status === TASK_RECURRING) addTaskToList(task, recurringTasks);
  if (taskConfig.status === TASK_COMPLETED) addTaskToList(task, completedTasks);
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

export async function taskFromId(
  id: number,
): Promise<{ task: Task; config: TaskConfig } | undefined> {
  const taskConfig = await taskStore.get(id);
  if (taskConfig === null) return;
  let { idx, list } = idxFromTask(id, taskConfig.status);
  if (idx === -1) return;
  let task = list[idx];
  return { task, config: taskConfig };
}

function addTaskToList(task: Task, list: TaskListState) {
  list.list.push(task);
  list.list.sort((a, b) => a.fridx.localeCompare(b.fridx));
  list.list = list.list;
  console.log('added task', task, list.list);
}

function removeTaskFromList(taskId: number, list: TaskListState) {
  let found = false;
  const newList = list.list.filter((t) => {
    if (t.id !== taskId) return true;
    found = true;
  });
  if (found) list.list = newList;
}

export async function populateTasks() {
  for await (const taskConfig of taskStore.iterate()) {
    const task = taskFromTaskConfig(taskConfig);
    if (taskConfig.status === TASK_SESSION) addTaskToList(task, sessionTasks);
    if (taskConfig.status === TASK_RECURRING) addTaskToList(task, recurringTasks);
    if (taskConfig.status === TASK_COMPLETED) addTaskToList(task, completedTasks);
  }
}

export async function createTask(taskConfig: TaskConfig) {
  const task = await storeTask(taskConfig);
  if (taskConfig.status === TASK_SESSION) addTaskToList(task, sessionTasks);
  if (taskConfig.status === TASK_RECURRING) addTaskToList(task, recurringTasks);
  if (taskConfig.status === TASK_COMPLETED) addTaskToList(task, completedTasks);
  postTaskMessage({ type: 'createTask', id: task.id });
}

export async function deleteTask(task: Task) {
  await taskStore.delete(task.id);
  if (task.status === TASK_SESSION) removeTaskFromList(task.id, sessionTasks);
  if (task.status === TASK_RECURRING) removeTaskFromList(task.id, recurringTasks);
  if (task.status === TASK_COMPLETED) removeTaskFromList(task.id, completedTasks);
  postTaskMessage({ type: 'deleteTask', id: task.id });
}

export async function updateTask(task: Task, update: Partial<TaskConfig>) {
  let newConfig: TaskConfig = {
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
  postTaskMessage({ type: 'updateTask', id: task.id });
}

export async function updateTaskField(task: Task, field: keyof TaskConfig, value: any) {
  let newConfig: TaskConfig = {
    description: task.description,
    status: task.status,
    timeEstimate: task.timeEstimate,
    timeRemaining: task.timeRemaining,
    createdAt: task.createdAt,
    completedAt: task.completedAt,
    fridx: task.fridx,
    id: task.id,
    [field]: value,
  };
  await taskStore.upsert(newConfig);
  postTaskMessage({ type: 'updateTaskField', id: task.id, field, prev: task[field] });
}
