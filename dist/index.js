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
    const h = String.fromCharCode(head.charCodeAt(0) + 1);
    if (h > "a") {
      digs.push(digits[0]);
    } else {
      digs.pop();
    }
    return h + digs.join("");
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
    const h = String.fromCharCode(head.charCodeAt(0) - 1);
    if (h < "Z") {
      digs.push(digits.slice(-1));
    } else {
      digs.pop();
    }
    return h + digs.join("");
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
var EASE_STORE = "ease_store";
var maxId = 0;
function getId() {
  return ++maxId;
}
function getMaxIdForStore(db, storeName) {
  return new Promise((resolve, reject) => {
    let store;
    try {
      const transaction = db.transaction(storeName, "readonly");
      store = transaction.objectStore(storeName);
    } catch (e) {
      console.warn(e);
      resolve(0);
    }
    const request = store.openCursor(null, "prev");
    request.onsuccess = (event) => {
      const cursor = event.target.result;
      if (cursor) {
        resolve(cursor.key);
      } else {
        resolve(0);
      }
    };
    request.onerror = () => reject("Error retrieving max ID");
  });
}
var ListStore = class {
  constructor(dbName, storeName) {
    __publicField(this, "db", null);
    __publicField(this, "dbName");
    __publicField(this, "storeName");
    this.dbName = dbName;
    this.storeName = storeName;
  }
  async connect() {
    if (this.db) return this.db;
    return new Promise((resolve, reject) => {
      const request = indexedDB.open(this.dbName, 1);
      request.onerror = () => reject(request.error);
      request.onsuccess = () => {
        this.db = request.result;
        resolve(request.result);
      };
      request.onupgradeneeded = (event) => {
        const db = event.target.result;
        if (!db.objectStoreNames.contains(this.storeName)) {
          db.createObjectStore(this.storeName, {
            keyPath: "id",
            autoIncrement: true
          });
        }
      };
    });
  }
  async add(record) {
    const db = await this.connect();
    return new Promise((resolve, reject) => {
      const tx = db.transaction(this.storeName, "readwrite");
      const store = tx.objectStore(this.storeName);
      store.add(record);
      tx.oncomplete = () => resolve();
      tx.onerror = () => reject(tx.error);
    });
  }
  async bulkAdd(records) {
    const db = await this.connect();
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
  async get(id) {
    const db = await this.connect();
    return new Promise((resolve, reject) => {
      const tx = db.transaction(this.storeName, "readonly");
      const store = tx.objectStore(this.storeName);
      const request = store.get(id);
      request.onerror = () => reject(request.error);
      request.onsuccess = () => resolve(request.result || null);
    });
  }
  async getAll() {
    const db = await this.connect();
    return new Promise((resolve, reject) => {
      const tx = db.transaction(this.storeName, "readonly");
      const store = tx.objectStore(this.storeName);
      const request = store.getAll();
      request.onerror = () => reject(request.error);
      request.onsuccess = () => resolve(request.result);
    });
  }
  async delete(id) {
    const db = await this.connect();
    return new Promise((resolve, reject) => {
      const tx = db.transaction(this.storeName, "readwrite");
      const store = tx.objectStore(this.storeName);
      store.delete(id);
      tx.oncomplete = () => resolve();
      tx.onerror = () => reject(tx.error);
    });
  }
  async upsert(record) {
    const db = await this.connect();
    return new Promise((resolve, reject) => {
      const tx = db.transaction(this.storeName, "readwrite");
      const store = tx.objectStore(this.storeName);
      store.put(record);
      tx.oncomplete = () => resolve();
      tx.onerror = () => reject(tx.error);
    });
  }
  async *iterate() {
    const db = await this.connect();
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
var taskStore = new ListStore(EASE_STORE, "tasks");
var audioStore = new ListStore(EASE_STORE, "audio");
async function setupStore() {
  await taskStore.connect();
  await audioStore.connect();
  let id = await getMaxIdForStore(taskStore.db, "tasks");
  if (id > maxId) maxId = id;
  id = await getMaxIdForStore(audioStore.db, "audio");
  if (id > maxId) maxId = id;
}

// src/tiny.ts
var assignDeep = (elm, props) => {
  Object.entries(props).forEach(([key, value]) => {
    if (typeof value === "object" && value !== null) {
      assignDeep(elm[key], value);
    } else {
      Object.assign(elm, { [key]: value });
    }
  });
};
var tags = [
  "a",
  "abbr",
  "address",
  "area",
  "article",
  "aside",
  "audio",
  "b",
  "base",
  "bdi",
  "bdo",
  "blockquote",
  "body",
  "br",
  "button",
  "canvas",
  "caption",
  "cite",
  "code",
  "col",
  "colgroup",
  "data",
  "datalist",
  "dd",
  "del",
  "details",
  "dfn",
  "dialog",
  "div",
  "dl",
  "dt",
  "em",
  "embed",
  "fieldset",
  "figcaption",
  "figure",
  "footer",
  "form",
  "h1",
  "h2",
  "h3",
  "h4",
  "h5",
  "h6",
  "head",
  "header",
  "hr",
  "html",
  "i",
  "iframe",
  "img",
  "input",
  "ins",
  "kbd",
  "label",
  "legend",
  "li",
  "link",
  "main",
  "map",
  "mark",
  "meta",
  "meter",
  "nav",
  "noscript",
  "object",
  "ol",
  "optgroup",
  "option",
  "output",
  "p",
  "param",
  "picture",
  "pre",
  "progress",
  "q",
  "rp",
  "rt",
  "ruby",
  "s",
  "samp",
  "script",
  "section",
  "select",
  "small",
  "source",
  "span",
  "strong",
  "style",
  "sub",
  "summary",
  "sup",
  "table",
  "tbody",
  "td",
  "template",
  "textarea",
  "tfoot",
  "th",
  "thead",
  "time",
  "title",
  "tr",
  "track",
  "u",
  "ul",
  "var",
  "video",
  "wbr"
];
var dom = {};
tags.forEach((tag) => {
  dom[tag] = (...args) => {
    const props = typeof args[0] === "object" && !(args[0] instanceof Node) ? args.shift() : {};
    const elm = document.createElement(tag);
    assignDeep(elm, props);
    elm.append(...args.map((a) => typeof a === "string" ? document.createTextNode(a) : a));
    return elm;
  };
});
var $ = (selector) => document.querySelector(selector);
function createState(state) {
  const appState = {
    ...state,
    _updates: Object.fromEntries(Object.keys(state).map((s) => [s, []])),
    _update: (s) => appState._updates[s].forEach((u) => u()),
    addUpdate: (s, u) => appState._updates[s].push(u)
  };
  return new Proxy(appState, {
    set(o, p2, v) {
      o[p2] = v;
      o._update(p2);
      return true;
    }
  });
}

// src/types.ts
var TASK_SESSION = 0;
var TASK_RECURRING = 2;
var TASK_COMPLETED = 3;

// src/tasks.ts
var windowId = Math.random().toString(36);
var channel = new BroadcastChannel("ease");
function postTaskMessage(data) {
  channel.postMessage({ data, windowId });
}
channel.addEventListener("message", async (e) => {
  let data = e.data.data;
  console.log("received message", data);
  if (data.type === "deleteTask") {
    removeTaskFromList(data.id, sessionTasks);
    removeTaskFromList(data.id, recurringTasks);
    removeTaskFromList(data.id, completedTasks);
  }
  if (data.type === "createTask") {
    onCreateTask(data.id);
  }
  if (data.type === "updateTask") {
  }
  if (data.type === "updateTaskField") {
    if (data.field === "status") {
      let prevStatus = data.prev;
      if (prevStatus === TASK_SESSION) removeTaskFromList(data.id, sessionTasks);
      if (prevStatus === TASK_RECURRING) removeTaskFromList(data.id, recurringTasks);
      if (prevStatus === TASK_COMPLETED) removeTaskFromList(data.id, completedTasks);
      await onCreateTask(data.id);
    } else if (data.field === "fridx") {
      console.log("fridx update", data);
      let res = await taskFromId(data.id);
      if (!res) return;
      let { task, config } = res;
      let tasks;
      if (config.status === TASK_SESSION) tasks = sessionTasks;
      if (config.status === TASK_RECURRING) tasks = recurringTasks;
      if (config.status === TASK_COMPLETED) tasks = completedTasks;
      tasks.list.sort((a, b) => a.fridx.localeCompare(b.fridx));
      tasks.list = tasks.list;
    } else {
      let res = await taskFromId(data.id);
      if (!res) return;
      let { task, config } = res;
      task[data.field] = config[data.field];
    }
  }
  if (data.type === "resetTasks") {
    populateTasks();
  }
  if (data.type === "resetAudio") {
  }
});
function taskFromTaskConfig(config) {
  return createState(config);
}
async function storeTask(config) {
  config.id = getId();
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
  return taskFromTaskConfig(config);
}
var sessionTasks = createState({ list: [] });
var recurringTasks = createState({ list: [] });
var completedTasks = createState({ list: [] });
async function onCreateTask(id) {
  const taskConfig = await taskStore.get(id);
  if (taskConfig === null) return;
  const task = taskFromTaskConfig(taskConfig);
  if (taskConfig.status === TASK_SESSION) addTaskToList(task, sessionTasks);
  if (taskConfig.status === TASK_RECURRING) addTaskToList(task, recurringTasks);
  if (taskConfig.status === TASK_COMPLETED) addTaskToList(task, completedTasks);
}
function idxFromTask(id, status) {
  let list = [];
  if (status === TASK_SESSION) list = sessionTasks.list;
  if (status === TASK_RECURRING) list = recurringTasks.list;
  if (status === TASK_COMPLETED) list = completedTasks.list;
  return { idx: list.findIndex((t) => t.id === id), list };
}
async function taskFromId(id) {
  const taskConfig = await taskStore.get(id);
  if (taskConfig === null) return;
  let { idx, list } = idxFromTask(id, taskConfig.status);
  if (idx === -1) return;
  let task = list[idx];
  return { task, config: taskConfig };
}
function addTaskToList(task, list) {
  list.list.push(task);
  list.list.sort((a, b) => a.fridx.localeCompare(b.fridx));
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
  for await (const taskConfig of taskStore.iterate()) {
    const task = taskFromTaskConfig(taskConfig);
    if (taskConfig.status === TASK_SESSION) addTaskToList(task, sessionTasks);
    if (taskConfig.status === TASK_RECURRING) addTaskToList(task, recurringTasks);
    if (taskConfig.status === TASK_COMPLETED) addTaskToList(task, completedTasks);
  }
}
async function createTask(taskConfig) {
  const task = await storeTask(taskConfig);
  if (taskConfig.status === TASK_SESSION) addTaskToList(task, sessionTasks);
  if (taskConfig.status === TASK_RECURRING) addTaskToList(task, recurringTasks);
  if (taskConfig.status === TASK_COMPLETED) addTaskToList(task, completedTasks);
  postTaskMessage({ type: "createTask", id: task.id });
}
async function deleteTask(task) {
  await taskStore.delete(task.id);
  if (task.status === TASK_SESSION) removeTaskFromList(task.id, sessionTasks);
  if (task.status === TASK_RECURRING) removeTaskFromList(task.id, recurringTasks);
  if (task.status === TASK_COMPLETED) removeTaskFromList(task.id, completedTasks);
  postTaskMessage({ type: "deleteTask", id: task.id });
}
async function updateTaskField(task, field, value) {
  let newConfig = {
    description: task.description,
    status: task.status,
    timeEstimate: task.timeEstimate,
    timeRemaining: task.timeRemaining,
    createdAt: task.createdAt,
    completedAt: task.completedAt,
    fridx: task.fridx,
    id: task.id,
    [field]: value
  };
  await taskStore.upsert(newConfig);
  postTaskMessage({ type: "updateTaskField", id: task.id, field, prev: task[field] });
}

// src/index.ts
var { div, h1, button, p, input, span } = dom;
var DEFAULT_TASK_TIME = 25 * 60;
setupStore().then(() => {
  populateTasks();
});
var commonTaskStyles = {
  display: "flex",
  justifyContent: "space-between",
  padding: "0.5rem"
};
var styles = {
  task: {
    ...commonTaskStyles,
    borderTop: "1px solid #ccc",
    borderBottom: "1px solid #ccc"
  },
  taskDropTop: {
    ...commonTaskStyles,
    borderTop: "1px solid #f00",
    borderBottom: "1px solid #ccc"
  },
  taskDropBottom: {
    ...commonTaskStyles,
    borderTop: "1px solid #ccc",
    borderBottom: "1px solid #f00"
  },
  taskDeleteButton: {
    marginLeft: "1rem"
  }
};
function parseHumanReadableTime(hrTime) {
  try {
    let timeStr = hrTime.trim().toLowerCase();
    let time = 0;
    let includesHours = timeStr.includes("h");
    let includesMinutes = timeStr.includes("m");
    if (includesHours) {
      const hours = parseInt(timeStr.split("h", 2)[0]);
      if (hours) time += hours * 60 * 60;
      timeStr = timeStr.split("h", 2)[1];
    }
    if (includesMinutes) {
      const minutes = parseInt(timeStr.split("m", 2)[0]);
      if (minutes) time += minutes * 60;
    }
    if (!includesHours && !includesMinutes) {
      time = parseInt(timeStr) * 60;
    }
    return time;
  } catch (e) {
    return DEFAULT_TASK_TIME;
  }
}
function formatTime(time) {
  const hours = Math.floor(time / 3600);
  const minutes = Math.floor(time % 3600 / 60);
  let res = "";
  if (hours > 0) res += `${hours}h `;
  if (minutes > 0) res += `${minutes}m`;
  if (res === "") res = "0m";
  return res;
}
function taskView(task) {
  const descriptionInput = input({
    value: task.description,
    oninput: (e) => {
      updateTaskField(task, "description", e.target.value);
    }
  });
  task.addUpdate("description", () => {
    descriptionInput.value = task.description;
  });
  const timeEstimateInput = input({
    value: formatTime(task.timeEstimate),
    onblur: (e) => {
      updateTimeEstimate(e);
    },
    onkeydown: (e) => {
      if (e.key === "Enter") {
        updateTimeEstimate(e);
      }
    }
  });
  task.addUpdate("timeEstimate", () => {
    timeEstimateInput.value = formatTime(task.timeEstimate);
  });
  function updateTimeEstimate(e) {
    let time = parseHumanReadableTime(e.target.value);
    updateTaskField(task, "timeEstimate", time);
    timeEstimateInput.value = formatTime(time);
  }
  const buttonContainer = div();
  const DndHandle = span(
    {
      style: { cursor: "grab", userSelect: "none" },
      ondrag: (e) => {
        console.log("dragging");
      },
      ondragstart: (e) => {
        console.log("drag start");
        e.dataTransfer.setData("text/plain", task.id.toString());
        e.dataTransfer.effectAllowed = "move";
      }
    },
    "\u{1F532}"
  );
  const taskDiv = div({
    className: "task",
    style: styles.task,
    draggable: true,
    ondragover: (e) => {
      e.preventDefault();
      e.dataTransfer.dropEffect = "move";
      console.log("drag over", e);
      const rect = taskDiv.getBoundingClientRect();
      const y = e.clientY - rect.top;
      if (y > rect.height / 2) {
        Object.assign(taskDiv.style, styles.taskDropBottom);
      } else {
        Object.assign(taskDiv.style, styles.taskDropTop);
      }
    },
    ondrop: async (e) => {
      e.preventDefault();
      try {
        console.log("drop?", e.dataTransfer.getData("text/plain"), e);
        const taskId = parseInt(e.dataTransfer.getData("text/plain"));
        const rect = taskDiv.getBoundingClientRect();
        const y = e.clientY - rect.top;
        let { idx, list } = idxFromTask(task.id, task.status);
        let newFridx = null;
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
        updateTaskField(droppedTask.task, "fridx", newFridx);
      } catch (e2) {
        console.error(e2);
      } finally {
        Object.assign(taskDiv.style, styles.task);
      }
    },
    ondragleave: (e) => {
      e.preventDefault();
      Object.assign(taskDiv.style, styles.task);
    }
  });
  const update = () => {
    taskDiv.innerHTML = "";
    taskDiv.append(DndHandle);
    taskDiv.append(descriptionInput);
    taskDiv.append(timeEstimateInput);
    taskDiv.append(buttonContainer);
  };
  update();
  const deleteButton = button(
    { style: styles.taskDeleteButton, onclick: () => deleteTask(task) },
    "X"
  );
  const promoteButton = button(
    {
      onclick: () => {
        let description = task.description;
        if (!description) return;
        const time = Date.now();
        createTask({
          id: 0,
          description,
          status: TASK_SESSION,
          timeEstimate: task.timeEstimate,
          timeRemaining: 0,
          createdAt: time,
          completedAt: 0,
          fridx: ""
        });
      }
    },
    "Queue"
  );
  const updateButtons = () => {
    buttonContainer.innerHTML = "";
    if (task.status === TASK_RECURRING) buttonContainer.append(promoteButton);
    if (task.status !== TASK_COMPLETED) buttonContainer.append(deleteButton);
  };
  updateButtons();
  task.addUpdate("status", updateButtons);
  return taskDiv;
}
function taskListView(tasks) {
  const taskListDiv = div({ className: "task-list" });
  const update = () => {
    taskListDiv.innerHTML = "";
    tasks.list.forEach((t) => taskListDiv.append(taskView(t)));
  };
  tasks.addUpdate("list", update);
  return taskListDiv;
}
function newTaskInput({ status }) {
  return input({
    type: "text",
    placeholder: "Add a task",
    onkeydown: (e) => {
      if (e.key === "Enter") {
        const description = e.target.value;
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
        e.target.value = "";
      }
    }
  });
}
function sessionTasksView() {
  return div(
    { className: "session-tasks" },
    h1("Session Tasks"),
    taskListView(sessionTasks),
    newTaskInput({ status: TASK_SESSION })
  );
}
function recurringTasksView() {
  return div(
    { className: "recurring-tasks" },
    h1("Recurring Tasks"),
    taskListView(recurringTasks),
    newTaskInput({ status: TASK_RECURRING })
  );
}
function completedTasksView() {
  return div(
    { className: "completed-tasks" },
    h1("Completed Tasks"),
    taskListView(completedTasks)
  );
}
function ui() {
  const tasksBar = div(
    { className: "tasks-bar" },
    sessionTasksView(),
    recurringTasksView(),
    completedTasksView()
  );
  return tasksBar;
}
var _a;
(_a = $("#app")) == null ? void 0 : _a.append(ui());
//# sourceMappingURL=index.js.map
