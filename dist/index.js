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

// src/state.ts
var sessionTasks = { list: [] };
var recurringTasks = { list: [] };
var completedTasks = { list: [] };
var appState = {
  status: Number(localStorage.getItem("appStatus")),
  sessionTasks,
  recurringTasks,
  completedTasks
};

// src/types.ts
var TASK_SESSION = 0;
var TASK_RECURRING = 2;
var TASK_COMPLETED = 3;
var APP_IDLE = 0;
var APP_ACTIVE = 1;
var APP_PAUSED = 2;

// src/events.ts
var callback = {
  onChange: () => {
    console.log("callback onChange");
  }
};
var windowId = Math.random().toString(36);
var channel = new BroadcastChannel("ease");
function postTaskMessage(data) {
  channel.postMessage({ data, windowId });
}
channel.addEventListener("message", async (e) => {
  let data = e.data.data;
  console.log("received message", data);
  if (data.type === "startSession") {
    localStorage.setItem("appStatus", APP_ACTIVE.toString());
    appState.status = APP_ACTIVE;
    callback.onChange();
  }
  if (data.type === "pauseSession") {
    localStorage.setItem("appStatus", APP_PAUSED.toString());
    appState.status = APP_PAUSED;
    callback.onChange();
  }
  if (data.type === "endSession") {
    localStorage.setItem("appStatus", APP_IDLE.toString());
    appState.status = APP_IDLE;
    callback.onChange();
  }
  if (data.type === "updateTask") {
    removeTaskFromLists(data.id);
    const task = await taskStore.get(data.id);
    if (task !== null) addTaskToLists(task);
    callback.onChange();
  }
  if (data.type === "resetTasks") {
    await populateTasks();
  }
  if (data.type === "resetAudio") {
  }
});
function startSession() {
  appState.status = APP_ACTIVE;
  callback.onChange();
  postTaskMessage({ type: "startSession", id: 0 });
}
function pauseSession() {
  appState.status = APP_PAUSED;
  callback.onChange();
  postTaskMessage({ type: "pauseSession", id: 0 });
}
function endSession() {
  appState.status = APP_IDLE;
  callback.onChange();
  postTaskMessage({ type: "endSession", id: 0 });
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
  const task = await storeTask(taskConfig);
  addTaskToLists(task);
  callback.onChange();
  postTaskMessage({ type: "updateTask", id: task.id });
}
async function deleteTask(task) {
  await taskStore.delete(task.id);
  removeTaskFromLists(task);
  callback.onChange();
  postTaskMessage({ type: "updateTask", id: task.id });
}
async function updateTask(task, update) {
  removeTaskFromLists(task);
  const updatedTask = { ...task, ...update };
  await taskStore.upsert(updatedTask);
  addTaskToLists(updatedTask);
  callback.onChange();
  postTaskMessage({ type: "updateTask", id: task.id });
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
              console.log(name, value, newVNode._props);
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
var tags = ["div", "h1", "button", "p", "input", "span"];
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
var commonTaskStyles = {
  display: "flex",
  justifyContent: "space-between",
  alignItems: "center",
  padding: "0 1rem",
  gap: "1rem",
  backgroundColor: "var(--bg-task)"
};
var styles = {
  task: {
    ...commonTaskStyles,
    borderTop: "2px solid transparent",
    borderBottom: "2px solid transparent",
    transition: "all 0.2s ease"
  },
  taskDropTop: {
    ...commonTaskStyles,
    borderTop: "2px solid var(--accent)"
  },
  taskDropBottom: {
    ...commonTaskStyles,
    borderBottom: "2px solid var(--accent)"
  },
  taskDeleteButton: {
    padding: "0.5rem 1rem",
    backgroundColor: "var(--bg-danger)",
    color: "var(--text)",
    border: "none",
    borderRadius: "4px",
    cursor: "pointer"
  },
  taskDragHandle: {
    cursor: "grab",
    userSelect: "none",
    color: "var(--text-muted)"
  },
  collapseButton: {
    display: "flex",
    alignItems: "center",
    backgroundColor: "transparent",
    border: "none",
    color: "var(--text-muted)",
    cursor: "pointer",
    padding: "0",
    fontSize: "1.2rem",
    marginRight: "0.5rem"
  },
  sectionHeader: {}
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
function sectionHeader({ title, collapsed, oncollapse, onexpand }) {
  return div(
    {},
    button(
      {
        style: styles.collapseButton,
        onclick: () => {
          if (collapsed) {
            onexpand();
          } else {
            oncollapse();
          }
        },
        onkeydown: (e) => {
          console.log("key", e.key);
          if (e.key === "ArrowLeft") oncollapse();
          if (e.key === "ArrowRight") onexpand();
        }
      },
      // collapsed ? '▸' : '▾',
      h1({ style: styles.sectionHeader }, title)
    )
  );
}
function taskView(task, { dragState = 0 /* None */ }, update) {
  function updateTimeEstimate(e) {
    let time = parseHumanReadableTime(e.target.value);
    updateTask(task, { timeEstimate: time });
  }
  const domId = `task-${task.id}`;
  let resolvedStyles = styles.task;
  if (dragState === 2 /* Bottom */) resolvedStyles = { ...styles.task, ...styles.taskDropBottom };
  if (dragState === 1 /* Top */) resolvedStyles = { ...styles.task, ...styles.taskDropTop };
  return div(
    {
      id: domId,
      className: "task",
      style: resolvedStyles,
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
    span({ style: styles.taskDragHandle }, "\u283F"),
    input({
      value: task.description,
      oninput: (e) => {
        updateTask(task, { description: e.target.value });
      }
    }),
    input({
      value: formatTime(task.timeEstimate),
      onblur: (e) => {
        updateTimeEstimate(e);
      },
      onkeydown: (e) => {
        if (e.key === "Enter") {
          updateTimeEstimate(e);
        }
      }
    }),
    div(
      {},
      task.status === TASK_RECURRING && button(
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
      ),
      task.status !== TASK_COMPLETED && button({ style: styles.taskDeleteButton, onclick: () => deleteTask(task) }, "X")
    )
  );
}
function activeTaskView({ activeTask }) {
  if (!activeTask) {
    return div({ className: "active-task" }, h1({}, "No Active Task"));
  }
  return div({ className: "active-task" }, h1({}, "Active Task"), h(taskView, activeTask));
}
function taskListView(tasks) {
  const taskListDiv = div({ className: "task-list" }, ...tasks.list.map((t) => h(taskView, t)));
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
function sessionTasksView({ sessionTasks: sessionTasks2 }, { collapsed = false }, update) {
  return div(
    { className: "session-tasks" },
    sectionHeader({
      title: "Session Tasks",
      collapsed,
      oncollapse: () => update({ collapsed: true }),
      onexpand: () => update({ collapsed: false })
    }),
    collapsed ? null : [h(taskListView, sessionTasks2), h(newTaskInput, { status: TASK_SESSION })]
  );
}
function recurringTasksView({ recurringTasks: recurringTasks2 }, { collapsed = false }, update) {
  return div(
    { className: "recurring-tasks" },
    sectionHeader({
      title: "Recurring Tasks",
      collapsed,
      oncollapse: () => update({ collapsed: true }),
      onexpand: () => update({ collapsed: false })
    }),
    collapsed ? null : [h(taskListView, recurringTasks2), h(newTaskInput, { status: TASK_RECURRING })]
  );
}
function completedTasksView({ completedTasks: completedTasks2 }, { collapsed = true }, update) {
  return div(
    { className: "completed-tasks" },
    sectionHeader({
      title: "Completed Tasks",
      collapsed,
      oncollapse: () => update({ collapsed: true }),
      onexpand: () => update({ collapsed: false })
    }),
    collapsed ? null : h(taskListView, completedTasks2)
  );
}
function sessionButton({ onclick, label }) {
  return button({ onclick }, label);
}
function ui(props) {
  if (props.status === APP_IDLE || props.sessionTasks.list.length === 0) {
    return div(
      { className: "tasks-bar" },
      h(sessionButton, { onclick: startSession, label: "Start Session" }),
      h(sessionTasksView, { key: "session", ...props }),
      h(recurringTasksView, { key: "recurring", ...props }),
      h(completedTasksView, { key: "completed", ...props })
    );
  } else {
    return div(
      { className: "tasks-bar" },
      props.status === APP_ACTIVE ? h(sessionButton, { onclick: pauseSession, label: "Pause Session" }) : h(sessionButton, { onclick: startSession, label: "Resume Session" }),
      h(sessionButton, { onclick: endSession, label: "End Session" }),
      h(activeTaskView, { key: "active", activeTask: props.sessionTasks.list[0] }),
      h(sessionTasksView, {
        key: "session",
        ...props,
        sessionTasks: { list: props.sessionTasks.list.slice(1) }
      }),
      h(recurringTasksView, { key: "recurring", ...props }),
      h(completedTasksView, { key: "completed", ...props })
    );
  }
}
var root = document.getElementById("app");
render(h(ui, appState), root);
function redraw() {
  diff(h(ui, appState), root, root._vnode);
}
callback.onChange = redraw;
//# sourceMappingURL=index.js.map
