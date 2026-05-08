// ========================================
// NeuroMV TITAN MODE
// static/script.js
// FULL CLEAN VERSION
// ========================================

// --------------------
// STORAGE
// --------------------
let chats = JSON.parse(localStorage.getItem("neuromv_chats") || "[]");
let current = localStorage.getItem("neuromv_current") || null;
let privateChats = JSON.parse(localStorage.getItem("neuromv_private") || "[]");

let renameTarget = null;
let deleteTarget = null;
let selectedFile = null;

// --------------------
// ELEMENTS
// --------------------
const chatBox      = document.getElementById("chat");
const historyBox   = document.getElementById("history");
const input        = document.getElementById("input");
const form         = document.getElementById("form");
const fileInput    = document.getElementById("file");
const previewBox   = document.getElementById("preview");
const sendBtn      = document.getElementById("sendBtn");

const sidebar      = document.getElementById("sidebar");
const overlay      = document.getElementById("overlay");

const pinModal     = document.getElementById("pinModal");
const pinInput     = document.getElementById("pinInput");

const renameModal  = document.getElementById("renameModal");
const renameInput  = document.getElementById("renameInput");

const deleteModal  = document.getElementById("deleteModal");

const moreMenu     = document.getElementById("moreMenu");

// --------------------
// SAVE
// --------------------
function saveData(){
  localStorage.setItem("neuromv_chats", JSON.stringify(chats));
  localStorage.setItem("neuromv_private", JSON.stringify(privateChats));
  localStorage.setItem("neuromv_current", current || "");
}

// --------------------
// HELPERS
// --------------------
function uid(){
  return "c" + Date.now() + Math.floor(Math.random() * 9999);
}

function escapeHtml(text){
  return String(text)
    .replace(/&/g,"&amp;")
    .replace(/</g,"&lt;")
    .replace(/>/g,"&gt;");
}

function smartTitle(text){
  text = (text || "").trim();
  if(!text) return "New Chat";
  return text.length > 28 ? text.slice(0,28) + "..." : text;
}

function scrollBottom(){
  setTimeout(()=>{
    chatBox.scrollTop = chatBox.scrollHeight;
  },50);
}

// --------------------
// CHAT CORE
// --------------------
function currentChat(){
  return chats.find(x => x.id === current);
}

function newChat(){
  const c = {
    id: uid(),
    title: "New Chat",
    msg: []
  };

  chats.unshift(c);
  current = c.id;

  saveData();
  renderHistory();
  renderChat();
  closeSidebarMobile();
}

// --------------------
// HISTORY
// --------------------
function renderHistory(){

  historyBox.innerHTML = "";

  chats.forEach(c => {

    const item = document.createElement("div");
    item.className = "history-item";

    item.innerHTML = `
      <div class="history-top">

        <div class="history-title">
          ${escapeHtml(c.title)}
        </div>

        <div class="history-actions">

          <button class="icon-btn"
          onclick="event.stopPropagation();toggleChatMenu('${c.id}',this)">
            ⋮
          </button>

        </div>

      </div>
    `;

    item.onclick = ()=>{
      current = c.id;
      saveData();
      renderChat();
      closeSidebarMobile();
    };

    historyBox.appendChild(item);

  });

}

// --------------------
// CHAT MENU
// --------------------
function toggleChatMenu(id, btn){

  closeAllMiniMenus();

  const menu = document.createElement("div");
  menu.className = "mini-menu";
  menu.innerHTML = `
    <button onclick="openRename('${id}')">✏ Rename</button>
    <button onclick="movePrivate('${id}')">🔒 Private</button>
    <button onclick="askDelete('${id}')">🗑 Delete</button>
  `;

  btn.parentElement.appendChild(menu);
}

function closeAllMiniMenus(){
  document.querySelectorAll(".mini-menu").forEach(x=>x.remove());
}

document.addEventListener("click",(e)=>{
  if(!e.target.closest(".mini-menu") &&
     !e.target.closest(".icon-btn")){
    closeAllMiniMenus();
  }
});

// --------------------
// RENDER CHAT
// --------------------
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

  c.msg.forEach(m=>{

    if(m.type === "image"){
      bubbleImage(m.url,m.role,false);
    }else{
      bubble(m.text,m.role,false,false);
    }

  });

  scrollBottom();
}

// --------------------
// BUBBLE
// --------------------
function bubble(text,role="bot",save=true,typing=true){

  const row = document.createElement("div");
  row.className = role === "user" ? "user-row" : "bot-row";

  const box = document.createElement("div");
  box.className = role === "user" ? "user-bubble" : "bot-bubble";

  row.appendChild(box);
  chatBox.appendChild(row);

  if(typing && role === "bot"){

    let i = 0;

    function type(){
      if(i < text.length){
        box.innerHTML += escapeHtml(text[i]);
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
    if(!c) return;

    c.msg.push({
      role: role,
      text: text,
      type: "text"
    });

    if(c.msg.length === 1 && role === "user"){
      c.title = smartTitle(text);
    }

    saveData();
    renderHistory();
  }

  scrollBottom();
}

// --------------------
// IMAGE BUBBLE
// --------------------
function bubbleImage(url,role="bot",save=true){

  const row = document.createElement("div");
  row.className = role === "user" ? "user-row" : "bot-row";

  const box = document.createElement("div");
  box.className = role === "user" ? "user-bubble" : "bot-bubble";

  box.innerHTML = `
    <img src="${url}" class="chat-img">
  `;

  row.appendChild(box);
  chatBox.appendChild(row);

  if(save){
    const c = currentChat();
    if(c){
      c.msg.push({
        role: role,
        url: url,
        type: "image"
      });
      saveData();
    }
  }

  scrollBottom();
}

// --------------------
// SEND
// --------------------
form.addEventListener("submit", async function(e){

  e.preventDefault();

  const msg = input.value.trim();

  if(!msg && !selectedFile) return;

  if(!current){
    newChat();
  }

  if(msg){
    bubble(msg,"user",true,false);
  }

  if(selectedFile){
    const localUrl = URL.createObjectURL(selectedFile);
    bubbleImage(localUrl,"user",true);
  }

  input.value = "";
  input.style.height = "auto";
  previewBox.innerHTML = "";

  const thinking = document.createElement("div");
  thinking.className = "bot-row";
  thinking.innerHTML = `
    <div class="bot-bubble">
      NeuroMV is thinking...
    </div>
  `;
  chatBox.appendChild(thinking);
  scrollBottom();

  try{

    const fd = new FormData();
    fd.append("message", msg);
    fd.append("chat_id", current);

    if(selectedFile){
      fd.append("file", selectedFile);
    }

    selectedFile = null;

    const res = await fetch("/chat",{
      method:"POST",
      body:fd
    });

    const data = await res.json();

    thinking.remove();

    if(data.type === "image"){
      bubbleImage(data.url,"bot",true);
    }else{
      bubble(data.reply || "No response","bot",true,true);
    }

  }catch(err){

    thinking.remove();
    bubble("NeuroMV error occurred.","bot",true,false);

  }

});

// --------------------
// ENTER SEND
// --------------------
input.addEventListener("keydown",(e)=>{
  if(e.key === "Enter" && !e.shiftKey){
    e.preventDefault();
    form.requestSubmit();
  }
});

// --------------------
// AUTO HEIGHT
// --------------------
input.addEventListener("input",()=>{
  input.style.height = "auto";
  input.style.height = input.scrollHeight + "px";
});

// --------------------
// FILE
// --------------------
fileInput.addEventListener("change",()=>{

  const f = fileInput.files[0];
  if(!f) return;

  selectedFile = f;

  const url = URL.createObjectURL(f);

  previewBox.innerHTML = `
    <div class="preview-card">
      <img src="${url}" class="preview-img">
      <button class="remove-preview"
      onclick="removeFile()">✕</button>
    </div>
  `;
});

function removeFile(){
  selectedFile = null;
  fileInput.value = "";
  previewBox.innerHTML = "";
}

// --------------------
// RENAME
// --------------------
function openRename(id){
  renameTarget = id;
  renameInput.value = "";
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

// --------------------
// DELETE
// --------------------
function askDelete(id){
  deleteTarget = id;
  deleteModal.classList.remove("hidden");
}

function closeDelete(){
  deleteModal.classList.add("hidden");
}

function confirmDelete(){

  chats = chats.filter(x=>x.id !== deleteTarget);

  if(current === deleteTarget){
    current = chats[0]?.id || null;
  }

  saveData();
  renderHistory();
  renderChat();
  closeDelete();
}

// --------------------
// PRIVATE
// --------------------
function movePrivate(id){

  const c = chats.find(x=>x.id===id);
  if(!c) return;

  privateChats.push(c);
  chats = chats.filter(x=>x.id!==id);

  if(current===id){
    current = chats[0]?.id || null;
  }

  saveData();
  renderHistory();
  renderChat();
}

function openPrivate(){
  alert("Private Chats: " + privateChats.length);
}

// --------------------
// PIN
// --------------------
function submitPin(){
  pinModal.classList.add("hidden");
}

function closePin(){
  pinModal.classList.add("hidden");
}

function setPinPrompt(){
  pinModal.classList.remove("hidden");
}

// --------------------
// MORE MENU
// --------------------
function toggleMoreMenu(){
  moreMenu.classList.toggle("hidden");
}

// --------------------
// SIDEBAR
// --------------------
function toggleSidebar(){

  if(sidebar.classList.contains("show")){
    closeSidebarMobile();
  }else{
    sidebar.classList.add("show");
    overlay.classList.remove("hidden");
  }

}

function closeSidebarMobile(){
  sidebar.classList.remove("show");
  overlay.classList.add("hidden");
}

overlay?.addEventListener("click", closeSidebarMobile);

// swipe close
let startX = 0;

sidebar?.addEventListener("touchstart",(e)=>{
  startX = e.touches[0].clientX;
});

sidebar?.addEventListener("touchend",(e)=>{
  let endX = e.changedTouches[0].clientX;

  if(startX - endX > 60){
    closeSidebarMobile();
  }
});

// --------------------
// INIT
// --------------------
renderHistory();
renderChat();
