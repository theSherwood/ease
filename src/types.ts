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

export const SESSION_ACTIVE = 0;
export const SESSION_PAUSED = 1;

export type SessionKind = typeof SESSION_ACTIVE | typeof SESSION_PAUSED;

export type SessionSegment = {
  id: number;
  sessionId: number;
  kind: SessionKind;
  start: number;
  end: number;
};

export const APP_IDLE = 0;
export const APP_ACTIVE = 1;
export const APP_BREAK = 2;

export type AppStatus = typeof APP_ACTIVE | typeof APP_BREAK | typeof APP_IDLE;

export type AppState = {
  tabId: string;
  tabs: string[];
  leader: string;

  activeUtterance: SpeechSynthesisUtterance | null;

  status: AppStatus;
  sessionId: number;
  checkpoint: number;
  countup: boolean;
  pomodoroDuration: number;
  breakDuration: number;
  speaker: string;

  sessionTasks: TaskList;
  recurringTasks: TaskList;
  completedTasks: TaskList;
};
