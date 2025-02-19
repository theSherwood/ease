export const TASK_SESSION = 0;
export const TASK_ACTIVE = 1;
export const TASK_RECURRING = 2;
export const TASK_COMPLETED = 3;

export type TaskStatus =
  | typeof TASK_SESSION
  | typeof TASK_ACTIVE
  | typeof TASK_RECURRING
  | typeof TASK_COMPLETED;

export type TaskConfig = {
  id: number;
  description: string;
  status: TaskStatus;
  timeEstimate: number;
  timeRemaining: number;
  createdAt: number;
  completedAt: number;
  fridx: string;
};
