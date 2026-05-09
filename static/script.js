// static/script.js
// NEUROMV ULTRA FINAL STABLE VERSION

let chats = JSON.parse(localStorage.getItem("neuromv_chats") || "[]");
let privateChats = JSON.parse(localStorage.getItem("neuromv_private") || "[]");
let current = localStorage.getItem("neuromv_current") || null;

let renameTarget = null;
let deleteTarget = null;
let selectedFile = null;
let pinStep = 0;

// ======================
// ELEMENTS
// ======================
const chatBox = document.getElementById("chat");
const historyBox = document.getElementById("history");
const input = document.getElementById("input");
const form = document.getElementById("form");
const fileInput = document.getElementById("file");
const previewBox = document.getElementById("preview");

const sidebar = document.getElementById("sidebar");
const overlay = document.getElementById("overlay");

const moreMenu = document.getElementById("moreMenu");

const renameModal = document.getElementById("renameModal");
const renameInput = document.getElementById("renameInput");

const deleteModal = document.getElementById("deleteModal");

const pinModal = document.getElementById("pinModal");
const pinInput = document.getElementById("pinInput");
const pinText = document.getElementById("pinText");

// ======================
// SAVE SYSTEM
// ======================
function saveData() {
  localStorage.setItem("neuromv_chats", JSON.stringify(chats));
  localStorage.setItem("neuromv_private", JSON.stringify(privateChats));
  localStorage.setItem("neuromv_current", current || "");
}

// ======================
// HELPERS
// ======================
function uid() {
  return "c" + Date.now() + Math.floor(Math.random() * 9999);
}

function esc(t) {
  return String(t)
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;");
}

function smartTitle(t) {
  t = (t || "").trim();
  return t ? (t.length > 28 ? t.slice(0, 28) + "..." : t) : "New Chat";
}

function scrollBottom() {
  setTimeout(() => {
    chatBox.scrollTop = chatBox.scrollHeight;
  }, 50);
}

function currentChat() {
  return chats.find(x => x.id === current);
}

// ======================
// NEW CHAT
// ======================
function newChat() {
  const c = {
    id: uid(),
    title: "New Chat",
    msg: [],
    private: false
  };

  chats.unshift(c);
  current = c.id;

  saveData();
  renderHistory();
  renderChat();
  closeSidebarMobile();
}

// ======================
// HISTORY RENDER (FIXED)
// ======================
function renderHistory() {
  historyBox.innerHTML = "";

  chats.forEach(c => {
    const item = document.createElement("div");
    item.className = "history-item";

    item.innerHTML = `
      <div class="history-top">
        <div class="history-title">
          ${c.private ? "🔒 " : ""}
          ${esc(c.title)}
        </div>

        <button class="icon-btn"
          onclick="event.stopPropagation();toggleChatMenu('${c.id}',this)">
          ⋮
        </button>
      </div>
    `;

    item.onclick = () => {
      current = c.id;
      saveData();
      renderChat();
      closeSidebarMobile();
    };

    historyBox.appendChild(item);
  });

  updatePrivateCount();
}

// ======================
// MINI MENU
// ======================
function toggleChatMenu(id, btn) {
  const old = btn.parentElement.querySelector(".mini-menu");
  closeMiniMenus();
  if (old) return;

  const menu = document.createElement("div");
  menu.className = "mini-menu";

  menu.innerHTML = `
    <button onclick="event.stopPropagation();openRename('${id}')">✏ Rename</button>
    <button onclick="event.stopPropagation();movePrivate('${id}')">🔒 Private</button>
    <button onclick="event.stopPropagation();askDelete('${id}')">🗑 Delete</button>
  `;

  btn.parentElement.appendChild(menu);
}

function closeMiniMenus() {
  document.querySelectorAll(".mini-menu").forEach(x => x.remove());
}

document.addEventListener("click", (e) => {
  if (!e.target.closest(".icon-btn") && !e.target.closest(".mini-menu")) {
    closeMiniMenus();
  }
});

// ======================
// CHAT RENDER
// ======================
function renderChat() {
  chatBox.innerHTML = "";

  const c = currentChat();

  if (!c) {
    chatBox.innerHTML = `
      <div class="welcome">
        <h2>NeuroMV</h2>
        <p>Your intelligent AI assistant</p>
      </div>
    `;
    return;
  }

  c.msg.forEach(m => {
    if (m.type === "image") {
      bubbleImage(m.url, m.role, false);
    } else {
      bubble(m.text, m.role, false, false);
    }
  });

  scrollBottom();
}

// ======================
// TEXT BUBBLE
// ======================
function bubble(text, role = "bot", save = true, typing = true) {

  const row = document.createElement("div");
  row.className = role === "user" ? "user-row" : "bot-row";

  const box = document.createElement("div");
  box.className = role === "user" ? "user-bubble" : "bot-bubble";

  row.appendChild(box);
  chatBox.appendChild(row);

  if (typing && role === "bot") {
    let i = 0;

    function type() {
      if (i < text.length) {
        box.innerHTML += esc(text[i]);
        i++;
        scrollBottom();
        setTimeout(type, 10);
      }
    }

    type();
  } else {
    box.innerText = text;
  }

  if (save) {
    const c = currentChat();
    if (!c) return;

    c.msg.push({ role, text, type: "text" });

    if (c.msg.length === 1 && role === "user") {
      c.title = smartTitle(text);
    }

    saveData();
    renderHistory();
  }

  scrollBottom();
}

// ======================
// IMAGE BUBBLE
// ======================
function bubbleImage(url, role = "bot", save = true) {

  const row = document.createElement("div");
  row.className = role === "user" ? "user-row" : "bot-row";

  const box = document.createElement("div");
  box.className = role === "user" ? "user-bubble" : "bot-bubble";

  box.innerHTML = `<img src="${url}" class="chat-img">`;

  row.appendChild(box);
  chatBox.appendChild(row);

  if (save) {
    const c = currentChat();
    if (c) {
      c.msg.push({ role, url, type: "image" });
      saveData();
    }
  }

  scrollBottom();
}

// ======================
// SEND MESSAGE
// ======================
form.addEventListener("submit", async (e) => {
  e.preventDefault();

  const msg = input.value.trim();
  if (!msg && !selectedFile) return;

  if (!current) newChat();

  if (msg) bubble(msg, "user", true, false);

  if (selectedFile) {
    bubbleImage(URL.createObjectURL(selectedFile), "user", true);
  }

  input.value = "";
  previewBox.innerHTML = "";

  const loading = document.createElement("div");
  loading.className = "bot-row";
  loading.innerHTML = `<div class="bot-bubble">NeuroMV is thinking...</div>`;
  chatBox.appendChild(loading);

  scrollBottom();

  try {
    const fd = new FormData();
    fd.append("message", msg);
    fd.append("chat_id", current);

    if (selectedFile) fd.append("file", selectedFile);
    selectedFile = null;

    const res = await fetch("/chat", { method: "POST", body: fd });
    const data = await res.json();

    loading.remove();

    if (data.type === "image") {
      bubbleImage(data.url, "bot", true);
    } else {
      bubble(data.reply, "bot", true, true);
    }

  } catch (err) {
    loading.remove();
    bubble("Connection error.", "bot", true, false);
  }
});

// ======================
// FILE UPLOAD
// ======================
fileInput.addEventListener("change", () => {
  const f = fileInput.files[0];
  if (!f) return;

  selectedFile = f;

  previewBox.innerHTML = `
    <div class="preview-card">📎 ${esc(f.name)}</div>
  `;
});

// ======================
// INPUT AUTO HEIGHT
// ======================
input.addEventListener("input", () => {
  input.style.height = "auto";
  input.style.height = input.scrollHeight + "px";
});

// ======================
// ENTER SEND
// ======================
input.addEventListener("keydown", (e) => {
  if (e.key === "Enter" && !e.shiftKey) {
    e.preventDefault();
    form.requestSubmit();
  }
});

// ======================
// PRIVATE SYSTEM (FIXED)
// ======================
function movePrivate(id) {
  let c = chats.find(x => x.id === id);
  if (!c) return;

  c.private = true;

  privateChats.unshift(c);
  chats = chats.filter(x => x.id !== id);

  if (current === id) current = null;

  saveData();
  renderHistory();
  renderChat();
}

function openPrivate() {
  historyBox.innerHTML = "";

  if (!privateChats.length) {
    historyBox.innerHTML = `<div class="empty-private">No private chats</div>`;
    return;
  }

  privateChats.forEach(c => {
    const item = document.createElement("div");
    item.className = "history-item";

    item.innerHTML = `🔒 ${esc(c.title)}`;

    item.onclick = () => {
      current = c.id;
      chats.unshift(c);
      privateChats = privateChats.filter(x => x.id !== c.id);

      saveData();
      renderHistory();
      renderChat();
    };

    historyBox.appendChild(item);
  });
}

// ======================
// SIDEBAR
// ======================
function toggleSidebar() {
  sidebar.classList.toggle("show");
  overlay.classList.toggle("hidden");
}

function closeSidebarMobile() {
  sidebar.classList.remove("show");
  overlay.classList.add("hidden");
}

overlay.onclick = closeSidebarMobile;

// ======================
// INIT
// ======================
renderHistory();
renderChat();
updatePrivateCount();

document.addEventListener("click", (e) => {
  if (!e.target.closest("#moreMenu")) {
    moreMenu.classList.add("hidden");
  }
});
