import { APP_IDLE, AppState, AppStatus, TaskList } from './types';

const POMODORO_DURATION_DEFAULT = 25 * 60;
const BREAK_DURATION_DEFAULT = 5 * 60;
const COUNTUP_DEFAULT = false;

export const sessionTasks: TaskList = { list: [] };
export const recurringTasks: TaskList = { list: [] };
export const completedTasks: TaskList = { list: [] };

const tabId = Math.random().toString(36);
console.log('tabId', tabId);

export const appState: AppState = {
  tabId,
  tabs: [tabId],
  master: tabId,

  // Stored in localStorage
  status: 0,
  sessionId: 0,
  checkpoint: 0,
  pomodoroDuration: 0,
  breakDuration: 0,
  countup: false,

  // Task data
  sessionTasks,
  recurringTasks,
  completedTasks,
};
readFromLocalStorageUnsafe();

function boolFromString(value: string | null, defaultBool = true): boolean {
  if (value === 'true') return true;
  if (value === 'false') return false;
  return defaultBool;
}

function readFromLocalStorageUnsafe() {
  appState.status = Number(localStorage.getItem('appStatus')) as AppStatus;
  appState.sessionId = Number(localStorage.getItem('sessionId')) || 0;
  appState.checkpoint = Number(localStorage.getItem('checkpoint')) || 0;
  appState.pomodoroDuration =
    Number(localStorage.getItem('pomodoroDefault')) || POMODORO_DURATION_DEFAULT;
  appState.breakDuration = Number(localStorage.getItem('breakDefault')) || BREAK_DURATION_DEFAULT;
  appState.countup = boolFromString(localStorage.getItem('countup'), COUNTUP_DEFAULT);
}

export async function readFromLocalStorage() {
  await navigator.locks.request('localStorage', async () => {
    readFromLocalStorageUnsafe();
  });
}

export async function writeToLocalStorage() {
  await navigator.locks.request('localStorage', async () => {
    localStorage.setItem('appStatus', appState.status.toString());
    localStorage.setItem('sessionId', appState.sessionId.toString());
    localStorage.setItem('checkpoint', appState.checkpoint.toString());
    localStorage.setItem('pomodoroDefault', appState.pomodoroDuration.toString());
    localStorage.setItem('breakDefault', appState.breakDuration.toString());
    localStorage.setItem('countup', appState.countup.toString());
  });
}
