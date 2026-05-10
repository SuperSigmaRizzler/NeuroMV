// =========================
// NEUROMV CLEAN STABLE V1
// =========================

// =========================
// STORAGE
// =========================
let chats = JSON.parse(localStorage.getItem("neuromv_chats") || "[]");
let privateChats = JSON.parse(localStorage.getItem("neuromv_private") || "[]");
let current = localStorage.getItem("neuromv_current") || "";

let selectedFile = null;
let renameTarget = null;
let deleteTarget = null;

let savedPin = localStorage.getItem("neuromv_pin") || "";
let pinMode = "";
let pendingPrivateId = null;

let chatLocked = false;
let fileLocked = false;
let imageLocked = false;

// =========================
// ELEMENTS
// =========================
const chatBox = document.getElementById("chat");
const historyBox = document.getElementById("history");
const form = document.getElementById("form");
const input = document.getElementById("input");
const fileInput = document.getElementById("file");
const preview = document.getElementById("preview");

const sidebar = document.getElementById("sidebar");
const overlay = document.getElementById("overlay");

const renameModal = document.getElementById("renameModal");
const renameInput = document.getElementById("renameInput");

const deleteModal = document.getElementById("deleteModal");
const pinModal = document.getElementById("pinModal");
const pinInput = document.getElementById("pinInput");

const sendBtn = document.getElementById("sendBtn");
const uploadBtn = document.querySelector(".upload-btn");

// =========================
// HELPERS
// =========================
function uid(){
  return "c" + Date.now() + Math.floor(Math.random()*99999);
}

function esc(t){
  return String(t)
    .replace(/&/g,"&amp;")
    .replace(/</g,"&lt;")
    .replace(/>/g,"&gt;");
}

function saveData(){
  localStorage.setItem("neuromv_chats", JSON.stringify(chats));
  localStorage.setItem("neuromv_private", JSON.stringify(privateChats));
  localStorage.setItem("neuromv_current", current || "");
}

function currentChat(){
  return chats.find(x => x.id === current);
}

function scrollBottom(){
  setTimeout(()=>{
    chatBox.scrollTop = chatBox.scrollHeight;
  },50);
}

function dim(el){
  if(!el) return;
  el.style.opacity = "0.5";
  el.style.pointerEvents = "none";
}

// =========================
// CHAT SYSTEM
// =========================
function newChat(){
  const c = {
    id: uid(),
    title: "New Chat",
    msg: [],
    private:false
  };

  chats.unshift(c);
  current = c.id;

  saveData();
  renderHistory();
  renderChat();
}

// =========================
// HISTORY
// =========================
function renderHistory(){
  historyBox.innerHTML = "";

  chats.forEach(c=>{

    const div = document.createElement("div");
    div.className = "history-item";

    if(c.id === current) div.classList.add("active");

    div.innerHTML = `
      <div class="history-top">
        <div class="history-title">${esc(c.title)}</div>
        <button class="icon-btn">⋮</button>
      </div>
    `;

    div.onclick = ()=>{
      current = c.id;
      saveData();
      renderHistory();
      renderChat();
      closeSidebarMobile();
    };

    div.querySelector(".icon-btn").onclick = (e)=>{
      e.stopPropagation();
      toggleChatMenu(c.id, e.target);
    };

    historyBox.appendChild(div);
  });

  updatePrivateCount();
}

// =========================
// MENUS
// =========================
function closeMenus(){
  document.querySelectorAll(".mini-menu, #topMenu").forEach(x=>x.remove());
}

function toggleChatMenu(id, btn){
  closeMenus();

  const menu = document.createElement("div");
  menu.className = "mini-menu";

  menu.innerHTML = `
    <button onclick="openRename('${id}')">✏ Rename</button>
    <button onclick="movePrivate('${id}')">🔒 Private</button>
    <button onclick="askDelete('${id}')">🗑 Delete</button>
  `;

  btn.parentElement.appendChild(menu);
}

function toggleMoreMenu(){
  closeMenus();

  const menu = document.createElement("div");
  menu.id = "topMenu";
  menu.className = "mini-menu";

  menu.innerHTML = `
    <button onclick="openRename('${current}')">✏ Rename</button>
    <button onclick="movePrivate('${current}')">🔒 Private</button>
    <button onclick="askDelete('${current}')">🗑 Delete</button>
  `;

  document.body.appendChild(menu);

  const btn = document.querySelector(".dots-btn");

  if(btn){
    const r = btn.getBoundingClientRect();
    menu.style.position = "fixed";
    menu.style.top = r.bottom + "px";
    menu.style.right = "10px";
  }
}

document.addEventListener("click",(e)=>{
  if(!e.target.closest(".mini-menu")){
    closeMenus();
  }
});

// =========================
// CHAT VIEW
// =========================
function renderChat(){
  chatBox.innerHTML = "";

  const c = currentChat();
  if(!c) return;

  if(c.msg.length === 0){
    chatBox.innerHTML = `
      <div class="welcome">
        <h2>NeuroMV</h2>
        <p>Your AI Assistant</p>
      </div>
    `;
    return;
  }

  c.msg.forEach(m=>{
    if(m.type === "image"){
      bubbleImage(m.url, m.role, false);
    }else{
      bubble(m.text, m.role, false, false);
    }
  });

  scrollBottom();
}

// =========================
// BUBBLE
// =========================
function bubble(text, role="bot", save=true, typing=true){

  const row = document.createElement("div");
  row.className = role==="user" ? "user-row" : "bot-row";

  const box = document.createElement("div");
  box.className = role==="user" ? "user-bubble" : "bot-bubble";

  row.appendChild(box);
  chatBox.appendChild(row);

  if(role==="bot" && typing){

    let i = 0;

    function run(){
      if(i <= text.length){
        box.innerHTML = esc(text.slice(0,i)) + `<span class="typing-cursor"></span>`;
        i++;
        scrollBottom();
        setTimeout(run,10);
      } else {
        box.innerText = text;
      }
    }
    run();

  } else {
    box.innerText = text;
  }

  if(save){
    const c = currentChat();
    if(c){
      c.msg.push({ role, text, type:"text" });

      if(c.msg.length === 1 && role==="user"){
        c.title = text.slice(0,30);
      }

      saveData();
      renderHistory();
    }
  }

  scrollBottom();
}

// =========================
// SEND (IMPORTANT FIX)
// =========================
form.addEventListener("submit",(e)=>{
  e.preventDefault(); // 🔥 FIX RELOAD PAGE

  if(chatLocked) return;

  const msg = input.value.trim();
  if(!msg && !selectedFile) return;

  if(!current) newChat();

  if(msg){
    bubble(msg,"user",true,false);
  }

  input.value = "";
  preview.innerHTML = "";
  selectedFile = null;

  const loading = document.createElement("div");
  loading.className = "bot-row";
  loading.innerHTML = `<div class="bot-bubble">Thinking...</div>`;
  chatBox.appendChild(loading);

  setTimeout(()=>{
    loading.remove();
    bubble("AI response placeholder","bot",true,true);
  },1000);
});

// =========================
// ENTER SEND
// =========================
input.addEventListener("keydown",(e)=>{
  if(e.key==="Enter" && !e.shiftKey){
    e.preventDefault();
    form.requestSubmit();
  }
});

// =========================
// FILE
// =========================
fileInput.addEventListener("change",()=>{
  const f = fileInput.files[0];
  if(!f) return;

  selectedFile = f;

  preview.innerHTML = `
    <div class="preview-card">📎 ${esc(f.name)}</div>
  `;
});

// =========================
// PRIVATE SYSTEM CLEAN
// =========================
function movePrivate(id){
  pendingPrivateId = id;

  if(!savedPin){
    pinMode = "create_private";
    pinInput.placeholder = "Create PIN";
  } else {
    pinMode = "verify_private";
    pinInput.placeholder = "Enter PIN";
  }

  pinInput.value = "";
  pinModal.classList.remove("hidden");
}

function openPrivate(){
  if(!savedPin){
    pinMode = "create_access";
  } else {
    pinMode = "open_private";
  }

  pinInput.value = "";
  pinModal.classList.remove("hidden");
}

function submitPin(){
  const val = pinInput.value.trim();
  if(!val) return;

  if(pinMode.includes("create")){
    savedPin = val;
    localStorage.setItem("neuromv_pin", savedPin);

    if(pinMode === "create_private"){
      doMovePrivate();
    }

    pinModal.classList.add("hidden");
    return;
  }

  if(val !== savedPin){
    alert("Wrong PIN");
    return;
  }

  if(pinMode === "open_private"){
    showPrivateChats();
  }

  if(pinMode === "verify_private"){
    doMovePrivate();
  }

  pinModal.classList.add("hidden");
}

function doMovePrivate(){
  const i = chats.findIndex(x=>x.id===pendingPrivateId);
  if(i===-1) return;

  const chat = chats[i];

  privateChats.unshift({...chat, private:true});
  chats.splice(i,1);

  saveData();
  renderHistory();
}

function showPrivateChats(){
  historyBox.innerHTML = "";

  privateChats.forEach(c=>{
    const div = document.createElement("div");
    div.className = "history-item";

    div.innerHTML = `
      <div class="history-top">
        <div class="history-title">🔒 ${esc(c.title)}</div>
        <button class="icon-btn">⋮</button>
      </div>
    `;

    div.onclick = ()=>{
      current = c.id;
      renderChat();
    };

    historyBox.appendChild(div);
  });
}

// =========================
// UI
// =========================
function toggleSidebar(){
  sidebar.classList.toggle("show");
  overlay.classList.toggle("hidden");
}

function closeSidebarMobile(){
  sidebar.classList.remove("show");
  overlay.classList.add("hidden");
}

// =========================
// INIT
// =========================
renderHistory();
renderChat();
