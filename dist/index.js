var __defProp = Object.defineProperty;
var __defNormalProp = (obj, key, value) => key in obj ? __defProp(obj, key, { enumerable: true, configurable: true, writable: true, value }) : obj[key] = value;
var __publicField = (obj, key, value) => __defNormalProp(obj, typeof key !== "symbol" ? key + "" : key, value);

// src/fridx.ts
var BASE_62_DIGITS = "0123456789ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz";
function midpoint(a, b, digits) {
  const zero = digits[0];
  if (b != null && a >= b) {
    throw new Error(a + " >= " + b);
  }
  if (a.slice(-1) === zero || b && b.slice(-1) === zero) {
    throw new Error("trailing zero");
  }
  if (b) {
    let n = 0;
    while ((a[n] || zero) === b[n]) {
      n++;
    }
    if (n > 0) {
      return b.slice(0, n) + midpoint(a.slice(n), b.slice(n), digits);
    }
  }
  const digitA = a ? digits.indexOf(a[0]) : 0;
  const digitB = b != null ? digits.indexOf(b[0]) : digits.length;
  if (digitB - digitA > 1) {
    const midDigit = Math.round(0.5 * (digitA + digitB));
    return digits[midDigit];
  } else {
    if (b && b.length > 1) {
      return b.slice(0, 1);
    } else {
      return digits[digitA] + midpoint(a.slice(1), null, digits);
    }
  }
}
function validateInteger(int) {
  if (int.length !== getIntegerLength(int[0])) {
    throw new Error("invalid integer part of order key: " + int);
  }
}
function getIntegerLength(head) {
  if (head >= "a" && head <= "z") {
    return head.charCodeAt(0) - "a".charCodeAt(0) + 2;
  } else if (head >= "A" && head <= "Z") {
    return "Z".charCodeAt(0) - head.charCodeAt(0) + 2;
  } else {
    throw new Error("invalid order key head: " + head);
  }
}
function getIntegerPart(key) {
  const integerPartLength = getIntegerLength(key[0]);
  if (integerPartLength > key.length) {
    throw new Error("invalid order key: " + key);
  }
  return key.slice(0, integerPartLength);
}
function validateOrderKey(key, digits) {
  if (key === "A" + digits[0].repeat(26)) {
    throw new Error("invalid order key: " + key);
  }
  const i = getIntegerPart(key);
  const f = key.slice(i.length);
  if (f.slice(-1) === digits[0]) {
    throw new Error("invalid order key: " + key);
  }
}
function incrementInteger(x, digits) {
  validateInteger(x);
  const [head, ...digs] = x.split("");
  let carry = true;
  for (let i = digs.length - 1; carry && i >= 0; i--) {
    const d = digits.indexOf(digs[i]) + 1;
    if (d === digits.length) {
      digs[i] = digits[0];
    } else {
      digs[i] = digits[d];
      carry = false;
    }
  }
  if (carry) {
    if (head === "Z") {
      return "a" + digits[0];
    }
    if (head === "z") {
      return null;
    }
    const h2 = String.fromCharCode(head.charCodeAt(0) + 1);
    if (h2 > "a") {
      digs.push(digits[0]);
    } else {
      digs.pop();
    }
    return h2 + digs.join("");
  } else {
    return head + digs.join("");
  }
}
function decrementInteger(x, digits) {
  validateInteger(x);
  const [head, ...digs] = x.split("");
  let borrow = true;
  for (let i = digs.length - 1; borrow && i >= 0; i--) {
    const d = digits.indexOf(digs[i]) - 1;
    if (d === -1) {
      digs[i] = digits.slice(-1);
    } else {
      digs[i] = digits[d];
      borrow = false;
    }
  }
  if (borrow) {
    if (head === "a") {
      return "Z" + digits.slice(-1);
    }
    if (head === "A") {
      return null;
    }
    const h2 = String.fromCharCode(head.charCodeAt(0) - 1);
    if (h2 < "Z") {
      digs.push(digits.slice(-1));
    } else {
      digs.pop();
    }
    return h2 + digs.join("");
  } else {
    return head + digs.join("");
  }
}
function generateKeyBetween(a, b, digits = BASE_62_DIGITS) {
  if (a != null) {
    validateOrderKey(a, digits);
  }
  if (b != null) {
    validateOrderKey(b, digits);
  }
  if (a != null && b != null && a >= b) {
    throw new Error(a + " >= " + b);
  }
  if (a == null) {
    if (b == null) {
      return "a" + digits[0];
    }
    const ib2 = getIntegerPart(b);
    const fb2 = b.slice(ib2.length);
    if (ib2 === "A" + digits[0].repeat(26)) {
      return ib2 + midpoint("", fb2, digits);
    }
    if (ib2 < b) {
      return ib2;
    }
    const res = decrementInteger(ib2, digits);
    if (res == null) {
      throw new Error("cannot decrement any more");
    }
    return res;
  }
  if (b == null) {
    const ia2 = getIntegerPart(a);
    const fa2 = a.slice(ia2.length);
    const i2 = incrementInteger(ia2, digits);
    return i2 == null ? ia2 + midpoint(fa2, null, digits) : i2;
  }
  const ia = getIntegerPart(a);
  const fa = a.slice(ia.length);
  const ib = getIntegerPart(b);
  const fb = b.slice(ib.length);
  if (ia === ib) {
    return ia + midpoint(fa, fb, digits);
  }
  const i = incrementInteger(ia, digits);
  if (i == null) {
    throw new Error("cannot increment any more");
  }
  if (i < b) {
    return i;
  }
  return ia + midpoint(fa, null, digits);
}

// src/storage.ts
var DB_VERSION = 1;
var EASE_STORE = "ease_store";
var TASKS_STORE = "tasks";
var AUDIO_STORE = "audio";
var SESSION_SEGMENTS_STORE = "sessionSegments";
var maxTaskId = 0;
var maxAudioId = 0;
var maxSessionId = 0;
function getTaskId() {
  return ++maxTaskId;
}
function getAudioId() {
  return ++maxAudioId;
}
function getSessionId() {
  return ++maxSessionId;
}
function getColumnMax(db, storeName, column) {
  return new Promise((resolve, reject) => {
    let store;
    try {
      const transaction = db.transaction(storeName, "readonly");
      store = transaction.objectStore(storeName);
    } catch (e) {
      console.warn(e);
      resolve(0);
    }
    let index = store.index(column);
    const request = index.openCursor(null, "prev");
    request.onsuccess = (event) => {
      const cursor = event.target.result;
      if (cursor) {
        resolve(cursor.value[column]);
      } else {
        resolve(0);
      }
    };
    request.onerror = () => reject(`Error retrieving max "${column}"`);
  });
}
var ListStore = class {
  constructor(storeName) {
    __publicField(this, "db");
    __publicField(this, "storeName");
    this.storeName = storeName;
  }
  connect(db) {
    this.db = db;
  }
  async add(record) {
    const db = this.db;
    return new Promise((resolve, reject) => {
      const tx = db.transaction(this.storeName, "readwrite");
      const store = tx.objectStore(this.storeName);
      store.add(record);
      tx.oncomplete = () => resolve();
      tx.onerror = () => reject(tx.error);
    });
  }
  async bulkAdd(records) {
    const db = this.db;
    return new Promise((resolve, reject) => {
      const tx = db.transaction(this.storeName, "readwrite");
      const store = tx.objectStore(this.storeName);
      for (const record of records) {
        store.add(record);
      }
      tx.oncomplete = () => resolve();
      tx.onerror = () => reject(tx.error);
    });
  }
  async upsert(record) {
    const db = this.db;
    return new Promise((resolve, reject) => {
      const tx = db.transaction(this.storeName, "readwrite");
      const store = tx.objectStore(this.storeName);
      store.put(record);
      tx.oncomplete = () => resolve();
      tx.onerror = () => reject(tx.error);
    });
  }
  async get(id) {
    const db = this.db;
    return new Promise((resolve, reject) => {
      const tx = db.transaction(this.storeName, "readonly");
      const store = tx.objectStore(this.storeName);
      const request = store.get(id);
      request.onerror = () => reject(request.error);
      request.onsuccess = () => resolve(request.result || null);
    });
  }
  async getAll() {
    const db = this.db;
    return new Promise((resolve, reject) => {
      const tx = db.transaction(this.storeName, "readonly");
      const store = tx.objectStore(this.storeName);
      const request = store.getAll();
      request.onerror = () => reject(request.error);
      request.onsuccess = () => resolve(request.result);
    });
  }
  async delete(id) {
    const db = this.db;
    return new Promise((resolve, reject) => {
      const tx = db.transaction(this.storeName, "readwrite");
      const store = tx.objectStore(this.storeName);
      store.delete(id);
      tx.oncomplete = () => resolve();
      tx.onerror = () => reject(tx.error);
    });
  }
  async clear() {
    const db = this.db;
    return new Promise((resolve, reject) => {
      const tx = db.transaction(this.storeName, "readwrite");
      const store = tx.objectStore(this.storeName);
      store.clear();
      tx.oncomplete = () => resolve();
      tx.onerror = () => reject(tx.error);
    });
  }
  async *iterate() {
    const db = this.db;
    const tx = db.transaction(this.storeName, "readonly");
    const store = tx.objectStore(this.storeName);
    const request = store.openCursor();
    let cursor = await new Promise((resolve) => {
      request.onsuccess = () => resolve(request.result);
    });
    while (cursor) {
      yield cursor.value;
      cursor = await new Promise((resolve) => {
        cursor.continue();
        request.onsuccess = () => resolve(request.result);
      });
    }
  }
};
var taskStore = new ListStore(TASKS_STORE);
var audioStore = new ListStore(AUDIO_STORE);
var sessionSegmentStore = new ListStore(SESSION_SEGMENTS_STORE);
var options = {
  [TASKS_STORE]: { indexes: [{ name: "id", unique: true }] },
  [AUDIO_STORE]: { indexes: [{ name: "id", unique: true }] },
  [SESSION_SEGMENTS_STORE]: { indexes: [{ name: "sessionId", unique: false }] }
};
async function setupStore() {
  let db;
  const setupDb = new Promise((resolve, reject) => {
    const request = indexedDB.open(EASE_STORE, DB_VERSION);
    request.onerror = () => reject(request.error);
    request.onsuccess = () => {
      db = request.result;
      resolve(request.result);
    };
    request.onupgradeneeded = (event) => {
      db = event.target.result;
      for (const storeName of [TASKS_STORE, AUDIO_STORE, SESSION_SEGMENTS_STORE]) {
        console.log("onupgradeneeded", storeName, options);
        if (!db.objectStoreNames.contains(storeName)) {
          let store = db.createObjectStore(storeName, { keyPath: "id", autoIncrement: true });
          for (const { name, unique } of options[storeName].indexes) {
            if (!store.indexNames.contains(name)) {
              store.createIndex(name, name, { unique });
            }
          }
        }
      }
    };
  });
  await setupDb;
  taskStore.connect(db);
  audioStore.connect(db);
  sessionSegmentStore.connect(db);
  console.log("Object Stores:", Array.from(db.objectStoreNames));
  let id = await getColumnMax(taskStore.db, "tasks", "id");
  if (id > maxTaskId) maxTaskId = id;
  id = await getColumnMax(audioStore.db, "audio", "id");
  if (id > maxAudioId) maxAudioId = id;
  id = await getColumnMax(sessionSegmentStore.db, "sessionSegments", "sessionId");
  if (id > maxSessionId) maxSessionId = id;
  console.log("maxTaskId", maxTaskId);
  console.log("maxAudioId", maxAudioId);
  console.log("maxSessionSegmentId", maxSessionId);
}

// src/types.ts
var TASK_SESSION = 0;
var TASK_RECURRING = 2;
var TASK_COMPLETED = 3;
var AUDIO_FINISHED = 0;
var AUDIO_ABORTED = 1;
var APP_IDLE = 0;
var APP_ACTIVE = 1;
var APP_BREAK = 2;

// src/audioPlayer.ts
var AudioPlayer = class {
  constructor() {
    __publicField(this, "audio", null);
    __publicField(this, "currentResolver", null);
  }
  play(audioUrl) {
    console.log("PLAY:", audioUrl);
    this.stop();
    return new Promise((resolve, reject) => {
      this.currentResolver = resolve;
      this.audio = new Audio(audioUrl);
      this.audio.addEventListener("ended", () => {
        var _a;
        (_a = this.currentResolver) == null ? void 0 : _a.call(this, AUDIO_FINISHED);
        this.currentResolver = null;
        this.audio = null;
      });
      this.audio.play().catch((error) => {
        reject(error);
        this.currentResolver = null;
        this.audio = null;
      });
    });
  }
  stop() {
    var _a;
    if (this.audio) {
      this.audio.pause();
      this.audio.currentTime = 0;
      (_a = this.currentResolver) == null ? void 0 : _a.call(this, AUDIO_ABORTED);
      this.currentResolver = null;
      this.audio = null;
    }
  }
  setVolume(volume) {
    if (this.audio) {
      this.audio.volume = volume;
    }
  }
};
var speechPlayer = new AudioPlayer();
var musicPlayer = new AudioPlayer();
async function playSpeech(audioUrl) {
  musicPlayer.setVolume(0.5);
  let res = await speechPlayer.play(audioUrl);
  musicPlayer.setVolume(1);
  return res;
}
async function playMusic(audioUrl) {
  return musicPlayer.play(audioUrl);
}
function stopMusic() {
  musicPlayer.stop();
}

// src/music.ts
function getPeakValue(buffer) {
  let peak = 0;
  for (let channel2 = 0; channel2 < buffer.numberOfChannels; channel2++) {
    const data = buffer.getChannelData(channel2);
    for (let i = 0; i < data.length; i++) {
      peak = Math.max(peak, Math.abs(data[i]));
    }
  }
  return peak;
}
function normalizeAudio(ctx, source, peak) {
  const gain = ctx.createGain();
  gain.gain.value = peak > 0 ? 1 / peak : 1;
  source.connect(gain);
  return gain;
}
function addFadeIn(ctx, source, duration) {
  const gain = ctx.createGain();
  gain.gain.setValueAtTime(0, 0);
  gain.gain.linearRampToValueAtTime(1, duration);
  source.connect(gain);
  return gain;
}
function addFadeOut(ctx, source, duration, totalDuration) {
  const gain = ctx.createGain();
  gain.gain.setValueAtTime(1, totalDuration - duration);
  gain.gain.linearRampToValueAtTime(0, totalDuration);
  source.connect(gain);
  return gain;
}
function audioBufferToBlob(audioBuffer) {
  const numOfChannels = audioBuffer.numberOfChannels;
  const sampleRate = audioBuffer.sampleRate;
  const format = 1;
  const bitDepth = 16;
  let numOfFrames = audioBuffer.length;
  let buffer = new ArrayBuffer(44 + numOfFrames * numOfChannels * 2);
  let view = new DataView(buffer);
  writeString(view, 0, "RIFF");
  view.setUint32(4, 36 + numOfFrames * numOfChannels * 2, true);
  writeString(view, 8, "WAVE");
  writeString(view, 12, "fmt ");
  view.setUint32(16, 16, true);
  view.setUint16(20, format, true);
  view.setUint16(22, numOfChannels, true);
  view.setUint32(24, sampleRate, true);
  view.setUint32(28, sampleRate * numOfChannels * 2, true);
  view.setUint16(32, numOfChannels * 2, true);
  view.setUint16(34, bitDepth, true);
  writeString(view, 36, "data");
  view.setUint32(40, numOfFrames * numOfChannels * 2, true);
  let offset = 44;
  for (let channel2 = 0; channel2 < numOfChannels; channel2++) {
    let channelData = audioBuffer.getChannelData(channel2);
    for (let i = 0; i < numOfFrames; i++) {
      let sample = Math.max(-1, Math.min(1, channelData[i]));
      sample = sample < 0 ? sample * 32768 : sample * 32767;
      view.setInt16(offset, sample, true);
      offset += 2;
    }
  }
  return new Blob([buffer], { type: "audio/wav" });
}
function writeString(view, offset, text) {
  for (let i = 0; i < text.length; i++) {
    view.setUint8(offset + i, text.charCodeAt(i));
  }
}
async function processAudio(buffer, options2) {
  const ctx = new OfflineAudioContext(buffer.numberOfChannels, buffer.length, buffer.sampleRate);
  const source = ctx.createBufferSource();
  source.buffer = buffer;
  let node = source;
  if (options2.normalize) node = normalizeAudio(ctx, source, getPeakValue(buffer));
  if (options2.fadeIn) node = addFadeIn(ctx, node, options2.fadeIn);
  if (options2.fadeOut) node = addFadeOut(ctx, node, options2.fadeOut, buffer.duration);
  node.connect(ctx.destination);
  source.start();
  const renderedBuffer = await ctx.startRendering();
  return audioBufferToBlob(renderedBuffer);
}
async function processAudioFile(file, options2) {
  const audioContext = new AudioContext();
  const arrayBuffer = await file.arrayBuffer();
  const audioBuffer = await audioContext.decodeAudioData(arrayBuffer);
  const processed = await processAudio(audioBuffer, options2);
  return {
    id: -1,
    name: file.name,
    type: file.type,
    data: processed,
    lastModified: Date.now()
  };
}
async function storeAudio(config) {
  config.id = getAudioId();
  await audioStore.add(config);
}
async function playAudioAsMusic(audio) {
  const blob = new Blob([audio.data], { type: audio.type });
  const audioUrl = URL.createObjectURL(blob);
  let res = await playMusic(audioUrl);
  URL.revokeObjectURL(audioUrl);
  return res;
}
async function playShuffledAudio() {
  while (true) {
    const music = await audioStore.getAll();
    const shuffledMusic = music.sort(() => Math.random() - 0.5);
    if (shuffledMusic.length === 0) return;
    for (const m of shuffledMusic) {
      let res = await playAudioAsMusic(m);
      if (res === AUDIO_ABORTED) return;
      await new Promise((resolve) => setTimeout(resolve, 1e3));
    }
  }
}
function uploadAudioFiles(callback2) {
  return async (event) => {
    event.preventDefault();
    let files = [];
    if (event instanceof DragEvent && event.dataTransfer) {
      files = await extractAudioFiles(event.dataTransfer.items);
    } else if (event.target instanceof HTMLInputElement && event.target.files) {
      files = await extractAudioFiles(event.target.files);
    }
    console.log("files", files);
    return callback2(files);
  };
}
function isAudioFile(file) {
  return file.name.endsWith(".mp3") || file.name.endsWith(".wav");
}
async function extractAudioFiles(items) {
  let audioFiles = [];
  if (items instanceof DataTransferItemList) {
    for (const item of items) {
      if (item.kind === "file") {
        const entry = item.webkitGetAsEntry();
        if (entry) await traverseFileTree(entry, audioFiles);
      }
    }
  } else if (items instanceof FileList) {
    for (const item of items) {
      if (isAudioFile(item)) audioFiles.push(item);
    }
  }
  return audioFiles;
}
async function traverseFileTree(entry, files) {
  if (entry.isFile) {
    const file = await getFile(entry);
    if (isAudioFile(file)) {
      files.push(file);
    }
  } else if (entry.isDirectory) {
    const reader = entry.createReader();
    let entries = await readEntries(reader);
    for (const subEntry of entries) {
      await traverseFileTree(subEntry, files);
    }
  }
}
function getFile(entry) {
  return new Promise((resolve) => entry.file(resolve));
}
function readEntries(reader) {
  return new Promise((resolve) => reader.readEntries(resolve));
}

// src/state.ts
var POMODORO_DURATION_DEFAULT = 5;
var BREAK_DURATION_DEFAULT = 5;
var COUNTUP_DEFAULT = false;
var SPEAKER_DEFAULT = "rick_sanchez";
var SESSION_ID_DEFAULT = -1;
var sessionTasks = { list: [] };
var recurringTasks = { list: [] };
var completedTasks = { list: [] };
var tabId = Math.random().toString(36);
console.log("tabId", tabId);
var appState = {
  // Tab coordination
  tabId,
  tabs: [tabId],
  leader: "",
  // Stored in localStorage
  status: 0,
  checkpoint: 0,
  pomodoroDuration: 0,
  breakDuration: 0,
  sessionId: SESSION_ID_DEFAULT,
  countup: false,
  speaker: "",
  // Local state
  audioUploadState: 1,
  // Task data
  sessionTasks,
  recurringTasks,
  completedTasks
};
readFromLocalStorageUnsafe();
function boolFromString(value, defaultBool = true) {
  if (value === "true") return true;
  if (value === "false") return false;
  return defaultBool;
}
function readFromLocalStorageUnsafe() {
  appState.status = Number(localStorage.getItem("appStatus"));
  appState.sessionId = Number(localStorage.getItem("sessionId")) || SESSION_ID_DEFAULT;
  appState.checkpoint = Number(localStorage.getItem("checkpoint")) || 0;
  appState.pomodoroDuration = Number(localStorage.getItem("pomodoroDefault")) || POMODORO_DURATION_DEFAULT;
  appState.breakDuration = Number(localStorage.getItem("breakDefault")) || BREAK_DURATION_DEFAULT;
  appState.countup = boolFromString(localStorage.getItem("countup"), COUNTUP_DEFAULT);
  appState.speaker = localStorage.getItem("speaker") || SPEAKER_DEFAULT;
}
async function readFromLocalStorage() {
  await navigator.locks.request("localStorage", async () => {
    readFromLocalStorageUnsafe();
  });
}
async function writeToLocalStorage() {
  await navigator.locks.request("localStorage", async () => {
    localStorage.setItem("appStatus", appState.status.toString());
    localStorage.setItem("sessionId", appState.sessionId.toString());
    localStorage.setItem("checkpoint", appState.checkpoint.toString());
    localStorage.setItem("pomodoroDefault", appState.pomodoroDuration.toString());
    localStorage.setItem("breakDefault", appState.breakDuration.toString());
    localStorage.setItem("countup", appState.countup.toString());
    localStorage.setItem("speaker", appState.speaker);
  });
}
function isLeader() {
  return appState.tabId === appState.leader;
}

// src/events.ts
var callback = {
  onChange: () => {
    console.log("callback onChange");
  }
};
var channel = new BroadcastChannel("ease");
function postMessage(data) {
  channel.postMessage({ data, sender: appState.tabId });
}
channel.addEventListener("message", async (e) => {
  let { data, sender } = e.data;
  console.log("received message", data);
  if (data.type === "rollcallInit") {
    appState.tabs = [appState.tabId, sender];
    postMessage({ type: "rollcallRespond", id: 0 });
    callback.onChange();
  }
  if (data.type === "rollcallRespond") {
    appState.tabs.push(sender.toString());
    callback.onChange();
  }
  if (data.type === "goodbye") {
    appState.tabs = appState.tabs.filter((tab) => tab !== sender);
    appState.leader = data.tabId;
    callback.onChange;
  }
  if (data.type === "sessionChange") {
    appState.leader = sender;
    await readFromLocalStorage();
    callback.onChange();
  }
  if (data.type === "updateTask") {
    appState.leader = sender;
    removeTaskFromLists(data.id);
    const task = await taskStore.get(data.id);
    if (task !== null) addTaskToLists(task);
    callback.onChange();
  }
});
function rollcall() {
  appState.tabs = [appState.tabId];
  postMessage({ type: "rollcallInit", id: 0 });
  callback.onChange();
}
async function broadcastSessionChange() {
  appState.leader = appState.tabId;
  callback.onChange();
  await writeToLocalStorage();
  postMessage({ type: "sessionChange", id: 0 });
}
async function flipCountDirection() {
  appState.countup = !appState.countup;
  await broadcastSessionChange();
}
async function setPomodoroDuration(duration) {
  appState.checkpoint = Date.now();
  appState.pomodoroDuration = duration;
  await broadcastSessionChange();
}
async function setBreakDuration(duration) {
  appState.leader = appState.tabId;
  appState.checkpoint = Date.now();
  appState.breakDuration = duration;
  await broadcastSessionChange();
}
async function startSession() {
  appState.status = APP_ACTIVE;
  appState.sessionId = getSessionId();
  appState.checkpoint = Date.now();
  await broadcastSessionChange();
}
async function breakSession() {
  const checkpoint = appState.checkpoint;
  const status = appState.status;
  appState.status = APP_BREAK;
  appState.checkpoint = Date.now();
  await broadcastSessionChange();
  await sessionSegmentStore.add({
    sessionId: appState.sessionId,
    kind: status === APP_ACTIVE ? APP_ACTIVE : APP_BREAK,
    start: checkpoint,
    end: appState.checkpoint
  });
}
async function resumeSession() {
  const checkpoint = appState.checkpoint;
  appState.status = APP_ACTIVE;
  appState.checkpoint = Date.now();
  await broadcastSessionChange();
  await sessionSegmentStore.add({
    sessionId: appState.sessionId,
    kind: APP_BREAK,
    start: checkpoint,
    end: appState.checkpoint
  });
}
async function endSession() {
  const checkpoint = appState.checkpoint;
  const sessionId = appState.sessionId;
  appState.status = APP_IDLE;
  appState.sessionId = SESSION_ID_DEFAULT;
  appState.checkpoint = 0;
  await broadcastSessionChange();
  await sessionSegmentStore.add({
    sessionId,
    kind: APP_ACTIVE,
    start: checkpoint,
    end: Date.now()
  });
}
window.addEventListener("beforeunload", async function(event) {
  let tabs = appState.tabs;
  postMessage({ type: "goodbye", id: 0, tabId: tabs.filter((t) => t !== appState.tabId)[0] });
  if (appState.status !== APP_IDLE && tabs.length === 1) {
    console.log("Session is active.");
    endSession();
  }
});
async function storeTask(config) {
  config.id = getTaskId();
  if (!config.fridx) {
    let lastTask;
    if (config.status === TASK_SESSION) lastTask = sessionTasks.list[sessionTasks.list.length - 1];
    if (config.status === TASK_RECURRING)
      lastTask = recurringTasks.list[recurringTasks.list.length - 1];
    if (config.status === TASK_COMPLETED)
      lastTask = completedTasks.list[completedTasks.list.length - 1];
    config.fridx = generateKeyBetween((lastTask == null ? void 0 : lastTask.fridx) || null, null);
  }
  await taskStore.add(config);
  return config;
}
function removeTaskFromLists(task) {
  if (typeof task === "number") {
    removeTaskFromList(task, sessionTasks);
    removeTaskFromList(task, recurringTasks);
    removeTaskFromList(task, completedTasks);
  } else {
    if (task.status === TASK_SESSION) removeTaskFromList(task.id, sessionTasks);
    if (task.status === TASK_RECURRING) removeTaskFromList(task.id, recurringTasks);
    if (task.status === TASK_COMPLETED) removeTaskFromList(task.id, completedTasks);
  }
}
function addTaskToLists(task) {
  if (task.status === TASK_SESSION) addTaskToList(task, sessionTasks);
  if (task.status === TASK_RECURRING) addTaskToList(task, recurringTasks);
  if (task.status === TASK_COMPLETED) addTaskToList(task, completedTasks);
}
function idxFromTask(id, status) {
  let list = [];
  if (status === TASK_SESSION) list = sessionTasks.list;
  if (status === TASK_RECURRING) list = recurringTasks.list;
  if (status === TASK_COMPLETED) list = completedTasks.list;
  return { idx: list.findIndex((t) => t.id === id), list };
}
async function taskFromId(id) {
  let storeTask2 = await taskStore.get(id);
  if (!storeTask2) return null;
  let task;
  if ((storeTask2 == null ? void 0 : storeTask2.status) === TASK_SESSION) task = sessionTasks.list.find((t) => t.id === id);
  if ((storeTask2 == null ? void 0 : storeTask2.status) === TASK_RECURRING) task = recurringTasks.list.find((t) => t.id === id);
  if ((storeTask2 == null ? void 0 : storeTask2.status) === TASK_COMPLETED) task = completedTasks.list.find((t) => t.id === id);
  Object.assign(task, storeTask2);
  return task;
}
function addTaskToList(task, list) {
  list.list.push(task);
  list.list.sort((a, b) => a.fridx > b.fridx ? 1 : -1);
  list.list = list.list;
  console.log("added task", task, list.list);
}
function removeTaskFromList(taskId, list) {
  let found = false;
  const newList = list.list.filter((t) => {
    if (t.id !== taskId) return true;
    found = true;
  });
  if (found) list.list = newList;
}
async function populateTasks() {
  for await (const task of taskStore.iterate()) {
    addTaskToLists(task);
  }
  callback.onChange();
}
async function createTask(taskConfig) {
  appState.leader = appState.tabId;
  const task = await storeTask(taskConfig);
  addTaskToLists(task);
  callback.onChange();
  postMessage({ type: "updateTask", id: task.id });
}
async function deleteTask(task) {
  appState.leader = appState.tabId;
  await taskStore.delete(task.id);
  removeTaskFromLists(task);
  callback.onChange();
  postMessage({ type: "updateTask", id: task.id });
}
async function updateTask(task, update) {
  appState.leader = appState.tabId;
  removeTaskFromLists(task);
  const updatedTask = { ...task, ...update };
  await taskStore.upsert(updatedTask);
  addTaskToLists(updatedTask);
  callback.onChange();
  postMessage({ type: "updateTask", id: task.id });
}

// src/vdom.ts
function h(type, props, ...children) {
  return {
    _type: type,
    _props: props,
    // An object for components and DOM nodes, a string for text nodes.
    _children: children.filter((_) => !!_),
    // Filter out null and undefined children.
    key: props && (props.key || props.id)
  };
}
function Fragment(props) {
  return props.children;
}
function render(newVNode, dom2, oldVNode = dom2._vnode || (dom2._vnode = {})) {
  return diff(h(Fragment, {}, [newVNode]), dom2, oldVNode);
}
function diff(newVNode, dom2, oldVNode, currentChildIndex = -1) {
  if (Array.isArray(newVNode)) {
    return diffChildren(dom2, newVNode, oldVNode);
  } else if (typeof newVNode._type === "function") {
    newVNode._state = oldVNode._state || {};
    const props = { children: newVNode._children, ...newVNode._props };
    const renderResult = newVNode._type(
      props,
      newVNode._state,
      // Updater function that is passed as 3rd argument to components
      (nextState) => {
        Object.assign(newVNode._state, nextState);
        return diff(newVNode, dom2, newVNode);
      }
    );
    newVNode._patched = diff(
      renderResult,
      dom2,
      oldVNode && oldVNode._patched || {},
      currentChildIndex
    );
    return dom2._vnode = newVNode;
  } else {
    const newDom = oldVNode.dom || (newVNode._type ? document.createElement(newVNode._type) : (
      // If we have a text node, vnode.props will be a string
      new Text(newVNode._props)
    ));
    if (newVNode._props != oldVNode._props) {
      if (newVNode._type) {
        const { key, ref, ...newProps } = newVNode._props;
        if (ref) ref.current = newDom;
        for (let name in newProps) {
          const value = newProps[name];
          if (name === "style" && !value.trim) {
            for (const n in value) {
              newDom.style[n] = value[n];
            }
          } else if (value != (oldVNode._props && oldVNode._props[name])) {
            if (name in newDom || (name = name.toLowerCase()) in newDom) {
              newDom[name] = value;
            } else if (value != null) {
              newDom.setAttribute(name, value);
            } else {
              newDom.removeAttribute(name);
            }
          }
        }
      } else {
        newDom.data = newVNode._props;
      }
    }
    diffChildren(newDom, newVNode._children, oldVNode);
    if (!oldVNode.dom || currentChildIndex > -1) {
      dom2.insertBefore(newVNode.dom = newDom, dom2.childNodes[currentChildIndex + 1] || null);
    }
    return dom2._vnode = Object.assign(oldVNode, newVNode);
  }
}
function diffChildren(parentDom, newChildren, oldVNode) {
  const oldChildren = oldVNode._normalizedChildren || [];
  oldVNode._normalizedChildren = newChildren.concat.apply([], newChildren).map((child, index) => {
    const nextNewChild = child._children ? child : h("", "" + child);
    const nextOldChild = oldChildren.find((oldChild, childIndex) => {
      let result = oldChild && oldChild._type == nextNewChild._type && oldChild.key == nextNewChild.key && (childIndex == index && (index = void 0), oldChildren[childIndex] = 0, oldChild);
      return result;
    }) || {};
    return diff(nextNewChild, parentDom, nextOldChild, index);
  });
  oldChildren.forEach(removePatchedChildren);
  return oldVNode;
}
function removePatchedChildren(child) {
  const { _children = [], _patched } = child;
  if (child.dom) {
    child.dom.remove();
  } else {
    _children.forEach((c) => c && removePatchedChildren(c));
    _patched && removePatchedChildren(_patched);
  }
}
var tags = ["div", "h1", "button", "p", "input", "span", "progress"];
var dom = tags.reduce((acc, tag) => {
  acc[tag] = (props, ...children) => h(tag, props, ...children);
  return acc;
}, {});

// src/index.ts
var { div, h1, button, p, input, span } = dom;
var DEFAULT_TASK_TIME = 25 * 60;
setupStore().then(() => {
  populateTasks();
});
rollcall();
async function handleAudioUpload(files) {
  const options2 = {
    normalize: true,
    fadeIn: 0.01,
    fadeOut: 0.01
  };
  try {
    appState.audioUploadState = 0;
    redraw();
    let portion = 1 / files.length;
    for (const file of files) {
      const processedAudio = await processAudioFile(file, options2);
      await storeAudio(processedAudio);
      appState.audioUploadState += portion;
      redraw();
    }
    appState.audioUploadState = 1.01;
    redraw();
  } catch (e) {
    console.error(e);
  }
  await new Promise((resolve) => setTimeout(resolve, 400));
  appState.audioUploadState = 1;
  redraw();
}
function centerFromRect(rect) {
  return { x: rect.left + rect.width / 2, y: rect.top + rect.height / 2 };
}
function axisFromDirection(dir) {
  if (dir === 0 /* Up */ || dir === 1 /* Down */) return 1 /* Y */;
  if (dir === 2 /* Left */ || dir === 3 /* Right */) return 0 /* X */;
  return 2 /* None */;
}
function secondaryAxisFromDirection(dir) {
  if (dir === 0 /* Up */ || dir === 1 /* Down */) return 0 /* X */;
  if (dir === 2 /* Left */ || dir === 3 /* Right */) return 1 /* Y */;
  return 2 /* None */;
}
var lastRect = null;
var lastAxis = 2 /* None */;
var lastTargetCoords = { x: Infinity, y: Infinity };
var lastDirection = 4 /* None */;
function resetNavState() {
  lastTargetCoords = { x: Infinity, y: Infinity };
  lastDirection = 4 /* None */;
  lastAxis = 2 /* None */;
}
{
  let container = document;
  container.addEventListener("focusin", (event) => {
    if (event.target instanceof Element) lastRect = event.target.getBoundingClientRect();
  });
  container.addEventListener("focusout", () => {
    setTimeout(() => {
      if (!container.contains(document.activeElement) || document.activeElement === document.body) {
        resetNavState();
        if (lastRect) {
          let targetCoords = centerFromRect(lastRect);
          targetCoords = updateNavigationState(targetCoords, 4 /* None */);
          let closest = getNearestEl(getNavigableElements, targetCoords, 4 /* None */);
          if (closest) closest.focus();
        }
      }
    }, 0);
  });
  container.addEventListener("keydown", (e) => {
    if (e.key === "Tab") {
      resetNavState();
    }
  });
  container.addEventListener("mousedown", (e) => {
    resetNavState();
  });
}
function groupElementsByRow(getElementCandidates) {
  const elements = getElementCandidates();
  if (elements.length === 0) return [];
  elements.sort((a, b) => a.getBoundingClientRect().top - b.getBoundingClientRect().top);
  let rows = [];
  elements.forEach((element) => {
    let rect = element.getBoundingClientRect();
    let added = false;
    for (let row of rows) {
      let firstInRow = row[0].getBoundingClientRect();
      let overlapHeight = Math.min(rect.bottom, firstInRow.bottom) - Math.max(rect.top, firstInRow.top);
      let elementHeight = rect.bottom - rect.top;
      let rowHeight = firstInRow.bottom - firstInRow.top;
      if (overlapHeight / elementHeight > 0.5 || overlapHeight / rowHeight > 0.5) {
        row.push(element);
        added = true;
        break;
      }
    }
    if (!added) {
      rows.push([element]);
    }
  });
  rows.forEach(
    (row) => row.sort((a, b) => a.getBoundingClientRect().left - b.getBoundingClientRect().left)
  );
  return rows;
}
function groupElementsByColumn(getElementCandidates) {
  const elements = getElementCandidates();
  if (elements.length === 0) return [];
  elements.sort((a, b) => a.getBoundingClientRect().left - b.getBoundingClientRect().left);
  let columns = [];
  elements.forEach((element) => {
    let rect = element.getBoundingClientRect();
    let added = false;
    for (let column of columns) {
      let firstInColumn = column[0].getBoundingClientRect();
      let overlapWidth = Math.min(rect.right, firstInColumn.right) - Math.max(rect.left, firstInColumn.left);
      let elementWidth = rect.right - rect.left;
      let columnWidth = firstInColumn.right - firstInColumn.left;
      if (overlapWidth / elementWidth > 0.5 || overlapWidth / columnWidth > 0.5) {
        column.push(element);
        added = true;
        break;
      }
    }
    if (!added) {
      columns.push([element]);
    }
  });
  columns.forEach(
    (column) => column.sort((a, b) => a.getBoundingClientRect().top - b.getBoundingClientRect().top)
  );
  return columns;
}
function getNavigableElements(container = document) {
  return Array.from(container.querySelectorAll("input:not(.skip-navigation), .navigable")).filter(
    (el) => !el.hasAttribute("disabled")
  );
}
function getNextNonOverlappingRowOrColumn(getElementCandidates, coords, direction) {
  const { x, y } = coords;
  const rows = groupElementsByRow(getElementCandidates);
  const columns = groupElementsByColumn(getElementCandidates);
  if (direction === 1 /* Down */ || direction === 0 /* Up */) {
    let selectedRow = rows.find(
      (row) => row.some((el) => {
        let rect = el.getBoundingClientRect();
        return rect.top <= y && rect.bottom >= y;
      })
    );
    if (direction === 1 /* Down */ && selectedRow) {
      let index = rows.indexOf(selectedRow);
      return index + 1 < rows.length ? rows[index + 1] : null;
    } else if (direction === 0 /* Up */ && selectedRow) {
      let index = rows.indexOf(selectedRow);
      return index - 1 >= 0 ? rows[index - 1] : null;
    }
  } else {
    let selectedColumn = columns.find(
      (column) => column.some((el) => {
        let rect = el.getBoundingClientRect();
        return rect.left <= x && rect.right >= x;
      })
    );
    if (direction === 3 /* Right */ && selectedColumn) {
      let index = columns.indexOf(selectedColumn);
      return index + 1 < columns.length ? columns[index + 1] : null;
    } else if (direction === 2 /* Left */ && selectedColumn) {
      let index = columns.indexOf(selectedColumn);
      return index - 1 >= 0 ? columns[index - 1] : null;
    }
  }
  return null;
}
function findClosestElementInRowOrColumn(coords, axis, group) {
  if (!group || group.length === 0) return null;
  let closest = document;
  let distance = Infinity;
  for (const el of group) {
    let rect = el.getBoundingClientRect();
    let dist = axis === 0 /* X */ ? Math.abs(rect.left + rect.width / 2 - coords.x) : Math.abs(rect.top + rect.height / 2 - coords.y);
    if (dist < distance) {
      distance = dist;
      closest = el;
    }
  }
  if (closest === document) return null;
  return closest;
}
function updateNavigationState(targetCoords, dir) {
  let target = { ...targetCoords };
  let newAxis = axisFromDirection(dir);
  if (newAxis === 2 /* None */) {
    lastAxis = 2 /* None */;
    lastDirection = 4 /* None */;
    lastTargetCoords = { x: Infinity, y: Infinity };
  } else if (newAxis === lastAxis) {
    if (newAxis === 0 /* X */) {
      if (lastTargetCoords.y !== Infinity) target.y = lastTargetCoords.y;
      lastTargetCoords = target;
    } else if (newAxis === 1 /* Y */) {
      if (lastTargetCoords.x !== Infinity) target.x = lastTargetCoords.x;
      lastTargetCoords = target;
    } else {
      lastTargetCoords = { x: Infinity, y: Infinity };
    }
  } else {
    lastTargetCoords = target;
  }
  lastAxis = newAxis;
  lastDirection = dir;
  return target;
}
function getNearestEl(getNavigableElements2, targetCoords, dir) {
  if (dir === 4 /* None */) {
    let elements = getNavigableElements2();
    let closest2 = document;
    let distance = Infinity;
    for (const el of elements) {
      let rect = el.getBoundingClientRect();
      let dist = Math.hypot(
        targetCoords.x - (rect.left + rect.width / 2),
        targetCoords.y - (rect.top + rect.height / 2)
      );
      if (dist < distance) {
        distance = dist;
        closest2 = el;
      }
    }
    if (closest2 === document) return null;
    return closest2;
  }
  {
    if (dir === 2 /* Left */) {
      let elements = getNavigableElements2();
      let closest2 = document;
      let distance = Infinity;
      for (const el of elements) {
        let rect = el.getBoundingClientRect();
        if (rect.right > targetCoords.x) continue;
        if (rect.top > targetCoords.y || rect.bottom < targetCoords.y) continue;
        let dist = targetCoords.x - rect.right;
        if (dist < distance) {
          distance = dist;
          closest2 = el;
        }
      }
      if (closest2 !== document) return closest2;
    } else if (dir === 3 /* Right */) {
      let elements = getNavigableElements2();
      let closest2 = document;
      let distance = Infinity;
      for (const el of elements) {
        let rect = el.getBoundingClientRect();
        if (rect.left < targetCoords.x) continue;
        if (rect.top > targetCoords.y || rect.bottom < targetCoords.y) continue;
        let dist = rect.left - targetCoords.x;
        if (dist < distance) {
          distance = dist;
          closest2 = el;
        }
      }
      if (closest2 !== document) return closest2;
    }
  }
  let rowOrColumn = getNextNonOverlappingRowOrColumn(getNavigableElements2, targetCoords, dir);
  if (!rowOrColumn) return null;
  let closest = findClosestElementInRowOrColumn(
    targetCoords,
    secondaryAxisFromDirection(dir),
    rowOrColumn
  );
  return closest;
}
function navigateEl(el, dir) {
  let elBox = el.getBoundingClientRect();
  let targetCoords = centerFromRect(elBox);
  targetCoords = updateNavigationState(targetCoords, dir);
  let closest = getNearestEl(getNavigableElements, targetCoords, dir);
  if (closest) closest.focus();
}
var SPACE = " ";
var ENTER = "Enter";
var ARROW_UP = "ArrowUp";
var ARROW_DOWN = "ArrowDown";
var ARROW_LEFT = "ArrowLeft";
var ARROW_RIGHT = "ArrowRight";
var styles = {
  task: {
    borderTop: "2px solid transparent",
    borderBottom: "2px solid transparent",
    transition: "all 0.2s ease"
  },
  taskDropTop: {
    borderTop: "2px solid var(--accent)"
  },
  taskDropBottom: {
    borderBottom: "2px solid var(--accent)"
  }
};
function parseHumanReadableTime(hrTime) {
  try {
    let timeStr = hrTime.trim().toLowerCase();
    let time = 0;
    let includesHours = timeStr.includes("h");
    let includesMinutes = timeStr.includes("m");
    let includesSeconds = timeStr.includes("s");
    if (includesHours) {
      const hours = parseInt(timeStr.split("h", 2)[0]);
      if (hours) time += hours * 60 * 60;
      timeStr = timeStr.split("h", 2)[1];
    }
    if (includesMinutes) {
      const minutes = parseInt(timeStr.split("m", 2)[0]);
      if (minutes) time += minutes * 60;
    }
    if (includesSeconds) {
      const seconds = parseInt(timeStr.split("s", 2)[0]);
      if (seconds) time += seconds;
    }
    if (!includesHours && !includesMinutes && !includesSeconds) {
      time = parseInt(timeStr) * 60;
    }
    return time;
  } catch (e) {
    return DEFAULT_TASK_TIME;
  }
}
function partitionTime(time) {
  const hours = Math.floor(time / 3600);
  const minutes = Math.floor(time % 3600 / 60);
  const seconds = Math.floor(time % 60);
  return { hours, minutes, seconds };
}
function formatTime(time, opts = {}) {
  const { hours, minutes, seconds } = time;
  const { pad = 1 } = opts;
  let res = "";
  if (hours > 0 || opts.forceHours) res += `${hours}h`.padStart(pad + 1, "0");
  if (minutes > 0 || opts.forceMinutes) {
    if (res !== "") res += " ";
    res += `${minutes}m`.padStart(pad + 1, "0");
  }
  if (seconds > 0 || opts.forceSeconds) {
    if (res !== "") res += " ";
    res += `${seconds}s`.padStart(pad + 1, "0");
  }
  if (res === "") res = "0m".padStart(pad + 1, "0");
  return res;
}
function formatTimestamp(timestamp, opts = {}) {
  return formatTime(partitionTime(timestamp), opts);
}
function onCreateTask(status, description) {
  if (!description) return;
  const time = Date.now();
  createTask({
    id: 0,
    description,
    status,
    timeEstimate: DEFAULT_TASK_TIME,
    timeRemaining: 0,
    createdAt: time,
    completedAt: 0,
    fridx: ""
  });
}
var audioDropHandlers = {
  ondragover: (e) => {
    e.preventDefault();
    e.dataTransfer.dropEffect = "copy";
  },
  ondragenter: (e) => {
    e.preventDefault();
  },
  ondrop: (e) => {
    e.dataTransfer.dropEffect = "copy";
    e.preventDefault();
    uploadAudioFiles((files) => handleAudioUpload(files))(e);
  }
};
function basicKeydownNavigationHandler(e) {
  console.log("key", e.key);
  if (e.key === ARROW_UP) navigateEl(e.target, 0 /* Up */);
  if (e.key === ARROW_DOWN) navigateEl(e.target, 1 /* Down */);
  if (e.key === ARROW_LEFT) navigateEl(e.target, 2 /* Left */);
  if (e.key === ARROW_RIGHT) navigateEl(e.target, 3 /* Right */);
}
function sessionTaskFromRecurringTask(recurringTask) {
  let description = recurringTask.description;
  if (!description) return;
  const time = Date.now();
  createTask({
    id: 0,
    description,
    status: TASK_SESSION,
    timeEstimate: recurringTask.timeEstimate,
    timeRemaining: 0,
    createdAt: time,
    completedAt: 0,
    fridx: ""
  });
}
function sectionHeaderView({ title, collapsed, oncollapse, onexpand }) {
  return div(
    {},
    button(
      {
        class: "collapse-button navigable",
        onclick: () => {
          if (collapsed) {
            onexpand();
          } else {
            oncollapse();
          }
        },
        onkeydown: (e) => {
          console.log("key", e.key);
          if (e.key === ARROW_LEFT) oncollapse();
          if (e.key === ARROW_RIGHT) onexpand();
          if (e.key === ARROW_UP) navigateEl(e.target, 0 /* Up */);
          if (e.key === ARROW_DOWN) navigateEl(e.target, 1 /* Down */);
        }
      },
      div({ class: "collapse-icon" }, collapsed ? "\u25B8" : "\u25BE"),
      h1({ class: "section-header" }, title)
    )
  );
}
function taskView({ task, active = false }, { dragState = 0 /* None */ }, update) {
  function updateTimeEstimate(e) {
    let time = parseHumanReadableTime(e.target.value);
    updateTask(task, { timeEstimate: time });
  }
  const domId = `task-${task.id}`;
  let resolvedStyles = styles.task;
  if (dragState === 2 /* Bottom */) resolvedStyles = { ...styles.task, ...styles.taskDropBottom };
  if (dragState === 1 /* Top */) resolvedStyles = { ...styles.task, ...styles.taskDropTop };
  let createdAt = new Date(task.createdAt).toLocaleString();
  let daysAgo = Math.floor((Date.now() - task.createdAt) / (1e3 * 60 * 60 * 24));
  let daysAgoLabel = daysAgo === 0 ? "Today" : `${daysAgo} days ago`;
  return div(
    {
      id: domId,
      className: "task",
      style: resolvedStyles,
      title: `
${daysAgoLabel} - ${createdAt}
`,
      draggable: true,
      ondragover: (e) => {
        e.preventDefault();
        e.dataTransfer.dropEffect = "move";
        const taskDiv = document.getElementById(domId);
        const rect = taskDiv.getBoundingClientRect();
        const y = e.clientY - rect.top;
        if (y > rect.height / 2) {
          update({ dragState: 2 /* Bottom */ });
        } else {
          update({ dragState: 1 /* Top */ });
        }
      },
      ondrop: async (e) => {
        e.preventDefault();
        try {
          console.log("drop?", e.dataTransfer.getData("text/plain"), e);
          const taskId = parseInt(e.dataTransfer.getData("text/plain"));
          const taskDiv = document.getElementById(domId);
          const rect = taskDiv.getBoundingClientRect();
          const y = e.clientY - rect.top;
          let { idx, list } = idxFromTask(task.id, task.status);
          let newFridx = "";
          if (y > rect.height / 2) {
            console.log("drop bottom");
            let otherTask = list[idx + 1];
            let nextTaskFridx = (otherTask == null ? void 0 : otherTask.fridx) || null;
            newFridx = generateKeyBetween(task.fridx, nextTaskFridx);
          } else {
            console.log("drop top");
            let prevTask = list[idx - 1];
            let prevTaskFridx = (prevTask == null ? void 0 : prevTask.fridx) || null;
            newFridx = generateKeyBetween(prevTaskFridx, task.fridx);
          }
          console.log("new fridx", newFridx, taskId);
          let droppedTask = await taskFromId(taskId);
          await updateTask(droppedTask, { fridx: newFridx, status: task.status });
        } catch (e2) {
          console.error(e2);
        } finally {
          update({ dragState: 0 /* None */ });
        }
      },
      ondragleave: (e) => {
        e.preventDefault();
        update({ dragState: 0 /* None */ });
      },
      ondragstart: (e) => {
        console.log("drag start");
        e.dataTransfer.setData("text/plain", task.id.toString());
        e.dataTransfer.effectAllowed = "move";
      }
    },
    span({ class: "drag-handle" }, "\u283F"),
    input({
      class: "description-input",
      value: task.description,
      oninput: (e) => {
        updateTask(task, { description: e.target.value });
      },
      onkeydown: (e) => {
        console.log("key", e.key);
        if (e.key === ARROW_UP) navigateEl(e.target, 0 /* Up */);
        if (e.key === ARROW_DOWN) navigateEl(e.target, 1 /* Down */);
        if (e.key === ARROW_RIGHT && e.target.selectionStart === e.target.value.length) {
          navigateEl(e.target, 3 /* Right */);
        }
      }
    }),
    input({
      class: "time-input",
      value: formatTimestamp(task.timeEstimate),
      onblur: (e) => {
        updateTimeEstimate(e);
      },
      onkeydown: (e) => {
        if (e.key === ENTER) updateTimeEstimate(e);
        if (e.key === ARROW_UP) navigateEl(e.target, 0 /* Up */);
        if (e.key === ARROW_DOWN) navigateEl(e.target, 1 /* Down */);
        if (e.key === ARROW_LEFT && e.target.selectionStart === 0) {
          navigateEl(e.target, 2 /* Left */);
        }
        if (e.key === ARROW_RIGHT && e.target.selectionStart === e.target.value.length) {
          navigateEl(e.target, 3 /* Right */);
        }
      }
    }),
    div(
      {},
      active && button(
        {
          class: "navigable",
          onkeydown: (e) => {
            if (e.key === SPACE || e.key === ENTER) {
              e.preventDefault();
              updateTask(task, { status: TASK_COMPLETED });
            } else basicKeydownNavigationHandler(e);
          },
          onclick: () => updateTask(task, { status: TASK_COMPLETED })
        },
        "\u2713"
      ),
      task.status === TASK_RECURRING && button(
        {
          class: "navigable",
          onkeydown: (e) => {
            if (e.key === SPACE || e.key === ENTER) {
              e.preventDefault();
              sessionTaskFromRecurringTask(task);
            } else basicKeydownNavigationHandler(e);
          },
          onclick: () => {
            sessionTaskFromRecurringTask(task);
          }
        },
        "+"
      ),
      button(
        {
          class: "delete-button navigable",
          onkeydown: (e) => {
            if (e.key === SPACE || e.key === ENTER) {
              e.preventDefault();
              deleteTask(task);
            } else basicKeydownNavigationHandler(e);
          },
          onclick: () => deleteTask(task)
        },
        "\u2715"
      )
    )
  );
}
function activeTaskView({ activeTask }) {
  if (!activeTask) {
    return div({ className: "active-task" }, h1({}, "No Active Task"));
  }
  return div(
    { className: "active-task" },
    h1({}, "Active Task"),
    h(taskView, { task: activeTask, key: activeTask.id, active: true })
  );
}
function taskListView(tasks) {
  const taskListDiv = div(
    { className: "task-list" },
    ...tasks.list.map((task) => h(taskView, { task, key: task.id }))
  );
  return taskListDiv;
}
function newTaskInputView({ status }) {
  const inputId = Math.random().toString();
  function createNewTaskFromInput() {
    let inputEl = document.getElementById(inputId);
    let value = inputEl.value;
    if (!value) return;
    onCreateTask(status, value);
    inputEl.value = "";
  }
  return div(
    { class: "new-task" },
    input({
      id: inputId,
      type: "text",
      placeholder: "Add a task",
      onkeydown: (e) => {
        if (e.key === ENTER) {
          onCreateTask(status, e.target.value);
          e.target.value = "";
        }
        if (e.key === ARROW_UP) navigateEl(e.target, 0 /* Up */);
        if (e.key === ARROW_DOWN) navigateEl(e.target, 1 /* Down */);
        if (e.key === ARROW_RIGHT) navigateEl(e.target, 3 /* Right */);
      }
    }),
    div(
      { style: { display: "flex" } },
      button(
        {
          class: "square-button navigable",
          onclick: (e) => {
            createNewTaskFromInput();
          },
          onkeydown: (e) => {
            if (e.key === SPACE || e.key === ENTER) {
              e.preventDefault();
              createNewTaskFromInput();
            } else {
              basicKeydownNavigationHandler(e);
            }
          }
        },
        "+"
      )
    )
  );
}
function sessionTasksView({ sessionTasks: sessionTasks2 }, { collapsed = false }, update) {
  return div(
    { className: "session-tasks" },
    sectionHeaderView({
      title: "Session Tasks",
      collapsed,
      oncollapse: () => update({ collapsed: true }),
      onexpand: () => update({ collapsed: false })
    }),
    collapsed ? null : [h(taskListView, sessionTasks2), h(newTaskInputView, { status: TASK_SESSION })]
  );
}
function recurringTasksView({ recurringTasks: recurringTasks2 }, { collapsed = false }, update) {
  return div(
    { className: "recurring-tasks" },
    sectionHeaderView({
      title: "Recurring Tasks",
      collapsed,
      oncollapse: () => update({ collapsed: true }),
      onexpand: () => update({ collapsed: false })
    }),
    collapsed ? null : [h(taskListView, recurringTasks2), h(newTaskInputView, { status: TASK_RECURRING })]
  );
}
function completedTasksView({ completedTasks: completedTasks2 }, { collapsed = true }, update) {
  return div(
    { className: "completed-tasks" },
    sectionHeaderView({
      title: "Completed Tasks",
      collapsed,
      oncollapse: () => update({ collapsed: true }),
      onexpand: () => update({ collapsed: false })
    }),
    collapsed ? null : h(taskListView, completedTasks2)
  );
}
function sessionButtonView({ onclick, label }) {
  return button(
    {
      class: "session-button navigable",
      onclick,
      onkeydown: basicKeydownNavigationHandler
    },
    label
  );
}
function pomodoroTimerView({ checkpoint, countup, pomodoroDuration, breakDuration, status, speaker }, { renderSignal = 0, prevTimeRemaining = 0, editing = false, editingValue = "" }, update) {
  function updateTimerFromInput(e) {
    let time2 = parseHumanReadableTime(e.target.value);
    update({ editing: false, editingValue: "" });
    if (status === APP_ACTIVE) {
      setPomodoroDuration(time2);
    } else if (status === APP_BREAK) {
      setBreakDuration(time2);
    }
  }
  let now = Date.now();
  let negative = false;
  let duration = status === APP_ACTIVE ? pomodoroDuration : breakDuration;
  let timeElapsed = Math.floor((now - checkpoint) / 1e3);
  let timeRemaining = Math.floor(duration - timeElapsed);
  let time = countup ? timeElapsed : timeRemaining;
  if (time < 0) {
    time = Math.abs(time);
    negative = true;
  }
  let { hours, minutes, seconds } = partitionTime(time);
  setTimeout(() => {
    if (appState.status !== status || appState.checkpoint !== checkpoint || appState.countup !== countup || appState.pomodoroDuration !== pomodoroDuration || appState.breakDuration !== breakDuration || appState.speaker !== speaker)
      return;
    update({ renderSignal: renderSignal + 1, prevTimeRemaining: timeRemaining });
  }, 400);
  if (isLeader()) {
    if (status === APP_BREAK) {
      if (prevTimeRemaining > 0 && timeRemaining <= 0) {
        playSpeech(`public/speech/break_over_${appState.speaker}.mp3`);
      }
    }
    if (status === APP_ACTIVE) {
      if (prevTimeRemaining > 0 && timeRemaining <= 0) {
        playSpeech(`public/speech/break_start_${appState.speaker}.mp3`);
      }
    }
  }
  let className = "pomodoro";
  let label = "";
  if (editing) label = editingValue;
  else {
    if (negative || countup && time > duration) className += " elapsed";
    label = formatTime(
      { hours, minutes, seconds },
      { forceMinutes: true, forceSeconds: true, pad: 2 }
    );
    if (negative) label = "-" + label;
  }
  return div(
    { class: "pomodoro-wrapper" },
    button({ class: "flip-icon", onclick: flipCountDirection }, "\u2B83"),
    input({
      class: className,
      value: label,
      oninput: (e) => {
        update({ editing: true, editingValue: e.target.value });
      },
      onblur: (e) => {
        if (editing) updateTimerFromInput(e);
      },
      onkeydown: (e) => {
        if (e.key === ENTER && editing) updateTimerFromInput(e);
        if (e.key === ARROW_UP) navigateEl(e.target, 0 /* Up */);
        if (e.key === ARROW_DOWN) navigateEl(e.target, 1 /* Down */);
      }
    })
  );
}
var audioUploadView = (props) => {
  if (props.audioUploadState === 1) {
    return div(
      {
        className: "audio-controls",
        ...audioDropHandlers
      },
      h("label", { for: "audio-upload" }, "Upload Audio"),
      input({
        id: "audio-upload",
        type: "file",
        multiple: true,
        accept: "audio/*",
        onchange: (e) => {
          console.log("change", e);
          uploadAudioFiles((files) => handleAudioUpload(files))(e);
        },
        ...audioDropHandlers
      }),
      button(
        {
          onclick: () => {
            audioStore.clear();
          },
          ...audioDropHandlers
        },
        "Delete Audio"
      )
    );
  } else {
    return div(
      {
        className: "audio-controls"
      },
      div({ className: "progress", style: { width: props.audioUploadState * 100 + "%" } })
    );
  }
};
function appView(props) {
  console.log("ui", appState.tabs);
  if (props.status === APP_IDLE || props.sessionTasks.list.length === 0) {
    return div(
      { className: "tasks-bar" },
      // props.tabs.map((tab) => p({}, tab)),
      h(sessionButtonView, {
        onclick: () => {
          playShuffledAudio();
          startSession();
        },
        label: "Start Session"
      }),
      h(sessionTasksView, { key: "session", ...props }),
      h(recurringTasksView, { key: "recurring", ...props }),
      h(completedTasksView, { key: "completed", ...props }),
      h(audioUploadView, props)
    );
  } else {
    return div(
      { className: "tasks-bar" },
      // div({}, isLeader() ? 'Leader' : 'Follower'),
      // pomodoro timer
      h(pomodoroTimerView, props),
      // buttons
      props.status === APP_ACTIVE ? h(sessionButtonView, {
        onclick: () => {
          stopMusic();
          breakSession();
        },
        label: "Take Break"
      }) : h(sessionButtonView, {
        onclick: () => {
          playShuffledAudio();
          resumeSession();
        },
        label: "Resume"
      }),
      span({}, " "),
      h(sessionButtonView, {
        onclick: () => {
          stopMusic();
          endSession();
        },
        label: "End Session"
      }),
      // active task
      h(activeTaskView, { key: "active", activeTask: props.sessionTasks.list[0] }),
      // task lists
      h(sessionTasksView, {
        key: "session",
        ...props,
        sessionTasks: { list: props.sessionTasks.list.slice(1) }
      }),
      h(recurringTasksView, { key: "recurring", ...props }),
      h(completedTasksView, { key: "completed", ...props }),
      h(audioUploadView, props)
    );
  }
}
var root = document.getElementById("app");
render(h(appView, appState), root);
function redraw() {
  console.log("redraw");
  diff(h(appView, appState), root, root._vnode);
}
callback.onChange = redraw;
//# sourceMappingURL=index.js.map
