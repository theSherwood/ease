import { AppState, AppStatus, TaskList } from './types';

export const sessionTasks: TaskList = { list: [] };
export const recurringTasks: TaskList = { list: [] };
export const completedTasks: TaskList = { list: [] };

export const appState: AppState = {
  status: Number(localStorage.getItem('appStatus')) as AppStatus,
  sessionTasks,
  recurringTasks,
  completedTasks,
};
