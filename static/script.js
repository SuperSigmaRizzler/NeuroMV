// =========================
// NEUROMV FINAL ULTRA STABLE
// =========================

let chats = JSON.parse(localStorage.getItem("neuromv_chats") || "[]");
let privateChats = JSON.parse(localStorage.getItem("neuromv_private") || "[]");
let current = localStorage.getItem("neuromv_current") || null;

let renameTarget = null;
let deleteTarget = null;
let selectedFile = null;

let chatLocked = false;
let imageLocked = false;
let fileLocked = false;

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

const moreMenu = document.getElementById("moreMenu");

const sendBtn = document.getElementById("sendBtn");
const uploadBtn = document.querySelector(".upload-btn");

// =========================
// SAVE
// =========================
function saveData(){
  localStorage.setItem("neuromv_chats", JSON.stringify(chats));
  localStorage.setItem("neuromv_private", JSON.stringify(privateChats));
  localStorage.setItem("neuromv_current", current || "");
}

// =========================
// HELPERS
// =========================
function uid(){
  return "c" + Date.now() + Math.floor(Math.random()*9999);
}

function esc(t){
  return String(t)
    .replace(/&/g,"&amp;")
    .replace(/</g,"&lt;")
    .replace(/>/g,"&gt;");
}

function currentChat(){
  return chats.find(x => x.id === current);
}

function scrollBottom(){
  setTimeout(()=>{
    chatBox.scrollTop = chatBox.scrollHeight;
  },50);
}

function dimButton(el){
  if(!el) return;
  el.style.opacity = ".45";
  el.style.pointerEvents = "none";
}

function normalButton(el){
  if(!el) return;
  el.style.opacity = "1";
  el.style.pointerEvents = "auto";
}

// =========================
// NEW CHAT
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

    div.innerHTML = `
      <div class="history-top">
        <div class="history-title">
          ${c.private ? "🔒 " : ""}${esc(c.title)}
        </div>
        <button class="icon-btn">⋮</button>
      </div>
    `;

    div.onclick = ()=>{
      current = c.id;
      saveData();
      renderChat();
      closeSidebarMobile();
    };

    div.querySelector(".icon-btn").onclick = (e)=>{
      e.stopPropagation();
      toggleMenu(c.id, e.target);
    };

    historyBox.appendChild(div);
  });

  updatePrivateCount();
}

// =========================
// MENU
// =========================
function closeMenus(){
  document.querySelectorAll(".mini-menu").forEach(x=>x.remove());
}

function toggleMenu(id, btn){

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

// =========================
// TOP RIGHT CHAT MENU
// sinkron dengan chat aktif
// =========================
function toggleMoreMenu(){

  closeMenus();

  if(!current){
    moreMenu.classList.toggle("hidden");
    return;
  }

  const old = document.getElementById("chatTopMenu");
  if(old){
    old.remove();
    return;
  }

  const menu = document.createElement("div");
  menu.id = "chatTopMenu";
  menu.className = "mini-menu top-chat-menu";

  menu.innerHTML = `
    <button onclick="openRename('${current}')">✏ Rename Chat</button>
    <button onclick="movePrivate('${current}')">🔒 Private Chat</button>
    <button onclick="askDelete('${current}')">🗑 Delete Chat</button>
  `;

  document.body.appendChild(menu);

  const btn = document.querySelector(".dots-btn");
  if(btn){
    const r = btn.getBoundingClientRect();
    menu.style.position = "fixed";
    menu.style.top = (r.bottom + 8) + "px";
    menu.style.right = "12px";
    menu.style.zIndex = "9999";
  }
}

document.addEventListener("click",(e)=>{
  if(
    !e.target.closest(".mini-menu") &&
    !e.target.closest(".icon-btn") &&
    !e.target.closest(".dots-btn")
  ){
    closeMenus();

    const x = document.getElementById("chatTopMenu");
    if(x) x.remove();
  }
});

// =========================
// CHAT
// =========================
function renderChat(){

  chatBox.innerHTML = "";

  const c = currentChat();

  if(!c){
    chatBox.innerHTML = `
      <div class="welcome">
        <h2>NeuroMV</h2>
        <p>Your intelligent AI assistant</p>
      </div>
    `;
    return;
  }

  if(c.msg.length === 0){
    chatBox.innerHTML = `
      <div class="welcome">
        <h2>NeuroMV</h2>
        <p>Your intelligent AI assistant</p>
      </div>
    `;
    return;
  }

  c.msg.forEach(m=>{
    if(m.type === "image"){
      bubbleImage(m.url,m.role,false);
    }else{
      bubble(m.text,m.role,false,false);
    }
  });

  scrollBottom();
}

function bubble(text, role="bot", save=true, typing=true){

  const row = document.createElement("div");
  row.className = role==="user" ? "user-row" : "bot-row";

  const box = document.createElement("div");
  box.className = role==="user" ? "user-bubble" : "bot-bubble";

  row.appendChild(box);
  chatBox.appendChild(row);

  if(typing && role==="bot"){

    let i=0;

    function type(){
      if(i<text.length){
        box.innerHTML += esc(text[i]);
        i++;
        scrollBottom();
        setTimeout(type,10);
      }
    }

    type();

  }else{
    box.innerText = text;
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

function bubbleImage(url, role="bot", save=true){

  const row = document.createElement("div");
  row.className = role==="user" ? "user-row" : "bot-row";

  const box = document.createElement("div");
  box.className = role==="user" ? "user-bubble" : "bot-bubble";

  box.innerHTML = `<img src="${url}" class="chat-img">`;

  row.appendChild(box);
  chatBox.appendChild(row);

  if(save){
    const c = currentChat();
    if(c){
      c.msg.push({role,url,type:"image"});
      saveData();
    }
  }

  scrollBottom();
}

// =========================
// IMAGE STATUS
// =========================
function creatingImageBubble(){

  const row = document.createElement("div");
  row.className = "bot-row";

  row.innerHTML = `
    <div class="bot-bubble">🎨 Creating Image...</div>
  `;

  chatBox.appendChild(row);
  scrollBottom();

  return row;
}

function imageDoneBubble(url){

  const row = document.createElement("div");
  row.className = "bot-row";

  row.innerHTML = `
    <div class="bot-bubble">
      <div style="margin-bottom:10px;">✅ Image Created</div>
      <img src="${url}" class="chat-img">
    </div>
  `;

  chatBox.appendChild(row);

  const c = currentChat();
  if(c){
    c.msg.push({role:"bot",url,type:"image"});
    saveData();
  }

  scrollBottom();
}

// =========================
// SEND
// =========================
form.addEventListener("submit", async(e)=>{

  e.preventDefault();

  if(chatLocked) return;

  const msg = input.value.trim();
  if(!msg && !selectedFile) return;

  if(!current) newChat();

  if(msg) bubble(msg,"user",true,false);

  const fd = new FormData();
  fd.append("message",msg);
  fd.append("chat_id",current);

  if(selectedFile){
    fd.append("file",selectedFile);
  }

  input.value = "";
  preview.innerHTML = "";
  selectedFile = null;

  try{

    const res = await fetch("/chat",{
      method:"POST",
      body:fd
    });

    const data = await res.json();

    if(data.type==="limit_chat"){
      chatLocked = true;
      dimButton(sendBtn);
      return;
    }

    if(data.type==="limit_file"){
      fileLocked = true;
      dimButton(uploadBtn);
      return;
    }

    if(data.type==="limit_image"){
      imageLocked = true;
      bubble("Daily image generation limit reached.","bot",true,false);
      return;
    }

    if(data.type==="image"){
      const loading = creatingImageBubble();

      setTimeout(()=>{
        loading.remove();
        imageDoneBubble(data.url);
      },10000);

      return;
    }

    bubble(data.reply || "No response");

  }catch{
    bubble("Connection error.","bot",true,false);
  }

});

// =========================
// ENTER SEND
// =========================
input.addEventListener("keydown",(e)=>{
  if(e.key==="Enter" && !e.shiftKey){
    e.preventDefault();
    if(chatLocked) return;
    form.requestSubmit();
  }
});

// =========================
// FILE
// =========================
fileInput.addEventListener("change",()=>{

  if(fileLocked) return;

  const f = fileInput.files[0];
  if(!f) return;

  selectedFile = f;

  preview.innerHTML = `
    <div class="preview-card">📎 ${esc(f.name)}</div>
  `;
});

// =========================
// PRIVATE / PIN / RENAME / DELETE
// =========================
function movePrivate(id){ alert("Private enabled"); }
function openPrivate(){ alert("Open private chats"); }
function restorePrivate(id){}
function setPinPrompt(){ pinModal.classList.remove("hidden"); }
function submitPin(){ closePin(); }
function closePin(){ pinModal.classList.add("hidden"); }

function openRename(id){
  renameTarget = id;
  renameModal.classList.remove("hidden");
}

function closeRename(){
  renameModal.classList.add("hidden");
}

function saveRename(){

  const val = renameInput.value.trim();
  if(!val) return;

  const c = chats.find(x=>x.id===renameTarget);
  if(c) c.title = val;

  saveData();
  renderHistory();
  closeRename();
}

function askDelete(id){
  deleteTarget = id;
  deleteModal.classList.remove("hidden");
}

function closeDelete(){
  deleteModal.classList.add("hidden");
}

function confirmDelete(){

  chats = chats.filter(x=>x.id!==deleteTarget);
  privateChats = privateChats.filter(x=>x.id!==deleteTarget);

  if(current===deleteTarget) current=null;

  saveData();
  renderHistory();
  renderChat();
  closeDelete();
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

function updatePrivateCount(){
  const el = document.querySelector(".private-chats");
  if(el) el.innerText = `Private Chats: ${privateChats.length}`;
}

// =========================
// INIT
// =========================
renderHistory();
renderChat();
updatePrivateCount();
