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
  timeElapsed: number;
  checkpoint: number;
  createdAt: number;
  completedAt: number;
  fridx: string;
};

export type TaskList = { list: Task[] };

export type Audio = {
  id: number;
  name: string;
  data: Blob;
  type: string;
  lastModified: number;
};

export const AUDIO_FINISHED = 0;
export const AUDIO_ABORTED = 1;
export type AudioEndKind = typeof AUDIO_FINISHED | typeof AUDIO_ABORTED;

export type SessionKind = typeof APP_ACTIVE | typeof APP_BREAK;

export type SessionSegment = {
  id?: number;
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

  status: AppStatus;
  sessionId: number;
  checkpoint: number;
  countup: boolean;
  pomodoroDuration: number;
  breakDuration: number;
  speaker: string;

  audioUploadState: number;
  draggingFile: boolean;

  sessionTasks: TaskList;
  recurringTasks: TaskList;
  completedTasks: TaskList;
};
