export const TASK_SESSION = 0;
export const TASK_ACTIVE = 1;
export const TASK_RECURRING = 2;
export const TASK_COMPLETED = 3;

export type TaskStatus =
  | typeof TASK_SESSION
  | typeof TASK_ACTIVE
  | typeof TASK_RECURRING
  | typeof TASK_COMPLETED;

export type Task = {
  id: number;
  description: string;
  status: TaskStatus;
  timeEstimate: number;
  timeRemaining: number;
  createdAt: number;
  completedAt: number;
  fridx: string;
};

export type TaskList = { list: Task[] };

export const APP_IDLE = 0;
export const APP_ACTIVE = 1;
export const APP_PAUSED = 2;

export type AppStatus = typeof APP_ACTIVE | typeof APP_PAUSED | typeof APP_IDLE;

export type AppState = {
  status: AppStatus;
  sessionTasks: TaskList;
  recurringTasks: TaskList;
  completedTasks: TaskList;
};
