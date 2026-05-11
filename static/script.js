// =========================
// NEUROMV FINAL SCRIPT.JS
// FULL PREMIUM + PRIVATE + MARKDOWN + COPY
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
const pinText = document.getElementById("pinText");

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
  },30);
}

function closeMenus(){
  document.querySelectorAll(".mini-menu").forEach(x=>x.remove());
}

// =========================
// MARKDOWN PREMIUM
// =========================
function parseMarkdown(text){
  let html = esc(text);

  html = html.replace(/```(\w+)?\n([\s\S]*?)```/g, (_,lang,code)=>{
    const language = lang || "text";
    const id = "c" + Math.random().toString(36).slice(2,8);

    return `
      <div class="code-wrap">
        <div class="code-head">
          <span>${language}</span>
          <button class="copy-btn" onclick="copyCode('${id}',this)">📋</button>
        </div>
        <pre><code id="${id}" class="language-${language}">${esc(code.trim())}</code></pre>
      </div>
    `;
  });

  html = html.replace(/\*\*(.*?)\*\*/g,"<strong>$1</strong>");
  html = html.replace(/\*(.*?)\*/g,"<em>$1</em>");
  html = html.replace(/`([^`]+)`/g,"<code>$1</code>");
  html = html.replace(/\n/g,"<br>");

  return html;
}

function applyHighlight(){
  if(window.hljs){
    document.querySelectorAll("pre code").forEach(el=>{
      hljs.highlightElement(el);
    });
  }
}

function copyCode(id,btn){
  const code = document.getElementById(id).innerText;

  navigator.clipboard.writeText(code).then(()=>{
    btn.innerText = "✓";
    setTimeout(()=>btn.innerText="📋",1200);
  });
}

// =========================
// INIT
// =========================
function ensureChat(){
  if(chats.length===0){
    newChat();
  }else if(!current){
    current = chats[0].id;
  }
}

function newChat(){
  const c = {
    id: uid(),
    title:"New Chat",
    msg:[]
  };

  chats.unshift(c);
  current = c.id;

  saveData();
  renderHistory();
  renderChat();
  closeSidebarMobile();
}

// =========================
// HISTORY
// =========================
function renderHistory(){
  historyBox.innerHTML = "";

  chats.forEach(c=>{
    const div = document.createElement("div");
    div.className = "history-item";

    if(c.id===current) div.classList.add("active");

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
      openChatMenu(c.id,e.target);
    };

    historyBox.appendChild(div);
  });
}

// =========================
// MENUS
// =========================
function openChatMenu(id,btn){
  closeMenus();

  const menu = document.createElement("div");
  menu.className = "mini-menu";

  menu.innerHTML = `
    <button onclick="openRename('${id}',false)">✏ Rename</button>
    <button onclick="movePrivate('${id}')">🔒 Private</button>
    <button onclick="askDelete('${id}',false)">🗑 Delete</button>
  `;

  btn.parentElement.appendChild(menu);
}

function openPrivateMenu(id,btn){
  closeMenus();

  const menu = document.createElement("div");
  menu.className = "mini-menu";

  menu.innerHTML = `
    <button onclick="openRename('${id}',true)">✏ Rename</button>
    <button onclick="prepareUnprivate('${id}')">🔓 Unprivate</button>
    <button onclick="askDelete('${id}',true)">🗑 Delete</button>
  `;

  btn.parentElement.appendChild(menu);
}

function toggleMoreMenu(){
  closeMenus();

  const btn = document.querySelector(".dots-btn");
  if(!btn) return;

  const r = btn.getBoundingClientRect();

  const menu = document.createElement("div");
  menu.className = "mini-menu";
  menu.style.position = "fixed";
  menu.style.top = (r.bottom+8)+"px";
  menu.style.right = "10px";

  menu.innerHTML = `
    <button onclick="openRename('${current}',false)">✏ Rename</button>
    <button onclick="movePrivate('${current}')">🔒 Private</button>
    <button onclick="askDelete('${current}',false)">🗑 Delete</button>
  `;

  document.body.appendChild(menu);
}

// =========================
// CHAT VIEW
// =========================
function renderChat(){
  chatBox.innerHTML = "";

  const c = currentChat();
  if(!c) return;

  if(c.msg.length===0){
    chatBox.innerHTML = `
      <div class="welcome">
        <h2>NeuroMV</h2>
        <p>Your intelligent AI assistant</p>
      </div>
    `;
    return;
  }

  c.msg.forEach(m=>{
    if(m.type==="image"){
      bubbleImage(m.url,false);
    }else{
      bubble(m.text,m.role,false,false);
    }
  });

  applyHighlight();
  scrollBottom();
}

// =========================
// BUBBLE
// =========================
function bubble(text,role="bot",save=true,typing=false){
  const row = document.createElement("div");
  row.className = role==="user" ? "user-row":"bot-row";

  const box = document.createElement("div");
  box.className = role==="user" ? "user-bubble":"bot-bubble";

  row.appendChild(box);
  chatBox.appendChild(row);

  if(typing && role==="bot"){
    let i=0;

    function run(){
      if(i<=text.length){
        box.innerHTML = parseMarkdown(text.slice(0,i)) +
        `<span class="typing-cursor"></span>`;
        i++;
        scrollBottom();
        setTimeout(run,8);
      }else{
        box.innerHTML = parseMarkdown(text);
        applyHighlight();
      }
    }

    run();
  }else{
    box.innerHTML = role==="bot" ? parseMarkdown(text) : esc(text);
    applyHighlight();
  }

  if(save){
    const c = currentChat();
    if(c){
      c.msg.push({role,text,type:"text"});
      if(c.msg.length===1 && role==="user"){
        c.title = text.slice(0,30);
      }
      saveData();
      renderHistory();
    }
  }

  scrollBottom();
}

function bubbleImage(url,save=true){
  const row = document.createElement("div");
  row.className = "bot-row";

  row.innerHTML = `
    <div class="bot-bubble">
      <img src="${url}" class="chat-img">
    </div>
  `;

  chatBox.appendChild(row);

  if(save){
    const c = currentChat();
    if(c){
      c.msg.push({type:"image",url});
      saveData();
    }
  }

  scrollBottom();
}

// =========================
// SEND
// =========================
form.addEventListener("submit", async(e)=>{
  e.preventDefault();

  const msg = input.value.trim();
  if(!msg && !selectedFile) return;

  if(!current) newChat();

  const welcome = chatBox.querySelector(".welcome");
  if(welcome) welcome.remove();

  if(msg) bubble(msg,"user",true,false);

  const fd = new FormData();
  fd.append("message",msg);
  fd.append("chat_id",current);

  if(selectedFile) fd.append("file",selectedFile);

  input.value = "";
  selectedFile = null;
  preview.innerHTML = "";

  const load = document.createElement("div");
  load.className = "bot-row";
  load.innerHTML = `<div class="bot-bubble"><span class="typing-cursor"></span></div>`;
  chatBox.appendChild(load);

  scrollBottom();

  try{
    const res = await fetch("/chat",{method:"POST",body:fd});
    const data = await res.json();

    load.remove();

    if(data.type==="image"){
      bubbleImage(data.url,true);
      return;
    }

    bubble(data.reply || "No response.","bot",true,true);

  }catch{
    load.remove();
    bubble("Connection error.","bot");
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
// ENTER SEND
// =========================
input.addEventListener("keydown",(e)=>{
  if(e.key==="Enter" && !e.shiftKey){
    e.preventDefault();
    form.requestSubmit();
  }
});

// =========================
// RENAME / DELETE
// =========================
function openRename(id,isPrivate=false){
  renameTarget = {id,isPrivate};
  renameInput.value = "";
  renameModal.classList.remove("hidden");
}

function closeRename(){
  renameModal.classList.add("hidden");
}

function saveRename(){
  const val = renameInput.value.trim();
  if(!val) return;

  let arr = renameTarget.isPrivate ? privateChats : chats;
  const c = arr.find(x=>x.id===renameTarget.id);
  if(c) c.title = val;

  saveData();
  renderHistory();
  closeRename();
}

function askDelete(id,isPrivate=false){
  deleteTarget = {id,isPrivate};
  deleteModal.classList.remove("hidden");
}

function closeDelete(){
  deleteModal.classList.add("hidden");
}

function confirmDelete(){
  if(deleteTarget.isPrivate){
    privateChats = privateChats.filter(x=>x.id!==deleteTarget.id);
  }else{
    chats = chats.filter(x=>x.id!==deleteTarget.id);
    if(current===deleteTarget.id){
      current = chats[0]?.id || "";
    }
  }

  saveData();
  ensureChat();
  renderHistory();
  renderChat();
  closeDelete();
}

// =========================
// PRIVATE
// =========================
function movePrivate(id){
  pendingPrivateId = id;

  if(!savedPin){
    pinMode = "create";
    pinText.innerText = "Create PIN";
  }else{
    pinMode = "verify";
    pinText.innerText = "Enter PIN";
  }

  pinInput.value = "";
  pinModal.classList.remove("hidden");
}

function openPrivate(){
  if(!savedPin){
    pinMode = "createOpen";
    pinText.innerText = "Create PIN";
  }else{
    pinMode = "open";
    pinText.innerText = "Enter PIN";
  }

  pinInput.value = "";
  pinModal.classList.remove("hidden");
}

function prepareUnprivate(id){
  pendingPrivateId = id;
  pinMode = "unprivate";
  pinText.innerText = "Enter PIN";
  pinInput.value = "";
  pinModal.classList.remove("hidden");
}

function closePin(){
  pinModal.classList.add("hidden");
}

function submitPin(){
  const val = pinInput.value.trim();
  if(!val) return;

  if(pinMode==="create" || pinMode==="createOpen"){
    savedPin = val;
    localStorage.setItem("neuromv_pin",savedPin);

    if(pinMode==="create") doPrivate();
    if(pinMode==="createOpen") showPrivate();

    closePin();
    return;
  }

  if(val!==savedPin){
    alert("Wrong PIN");
    return;
  }

  if(pinMode==="verify") doPrivate();
  if(pinMode==="open") showPrivate();
  if(pinMode==="unprivate") doUnprivate();

  closePin();
}

function doPrivate(){
  const i = chats.findIndex(x=>x.id===pendingPrivateId);
  if(i===-1) return;

  privateChats.unshift(chats[i]);
  chats.splice(i,1);

  current = chats[0]?.id || "";

  saveData();
  renderHistory();
  renderChat();
}

function doUnprivate(){
  const i = privateChats.findIndex(x=>x.id===pendingPrivateId);
  if(i===-1) return;

  chats.unshift(privateChats[i]);
  privateChats.splice(i,1);

  current = chats[0].id;

  saveData();
  renderHistory();
  renderChat();
}

function showPrivate(){
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
      chats.unshift(c);
      privateChats = privateChats.filter(x=>x.id!==c.id);
      current = c.id;

      saveData();
      renderHistory();
      renderChat();
    };

    div.querySelector(".icon-btn").onclick = (e)=>{
      e.stopPropagation();
      openPrivateMenu(c.id,e.target);
    };

    historyBox.appendChild(div);
  });
}

// =========================
// MOBILE
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
// GLOBAL CLICK
// =========================
document.addEventListener("click",(e)=>{
  if(
    !e.target.closest(".mini-menu") &&
    !e.target.closest(".icon-btn") &&
    !e.target.closest(".dots-btn")
  ){
    closeMenus();
  }
});

// =========================
// START
// =========================
ensureChat();
renderHistory();
renderChat();
