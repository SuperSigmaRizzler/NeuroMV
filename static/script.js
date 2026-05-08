// ========================================
// NeuroMV V3 GOD MODE FINAL
// static/script.js
// ========================================

// --------------------
// STORAGE
// --------------------
let chats = JSON.parse(localStorage.getItem("neuromv_chats") || "[]");
let current = localStorage.getItem("neuromv_current") || null;

let privateChats =
JSON.parse(localStorage.getItem("neuromv_private") || "[]");

let renameTarget = null;
let deleteTarget = null;
let selectedFile = null;

// --------------------
// ELEMENTS
// --------------------
const chatBox    = document.getElementById("chat");
const historyBox = document.getElementById("history");
const input      = document.getElementById("input");
const form       = document.getElementById("form");
const fileInput  = document.getElementById("file");
const previewBox = document.getElementById("preview");
const sendBtn    = document.getElementById("sendBtn");
const sidebar    = document.getElementById("sidebar");
const overlay    = document.getElementById("overlay");

const pinModal   = document.getElementById("pinModal");
const pinInput   = document.getElementById("pinInput");

const renameModal = document.getElementById("renameModal");
const renameInput = document.getElementById("renameInput");

const deleteModal = document.getElementById("deleteModal");

const moreMenu = document.getElementById("moreMenu");

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
  return "c" + Date.now() + Math.floor(Math.random()*999);
}

function escapeHtml(text){
  return text
    .replace(/&/g,"&amp;")
    .replace(/</g,"&lt;")
    .replace(/>/g,"&gt;");
}

function smartTitle(text){
  if(!text) return "New Chat";
  text = text.trim();
  return text.length > 26 ? text.slice(0,26)+"..." : text;
}

function scrollBottom(){
  setTimeout(()=>{
    chatBox.scrollTop = chatBox.scrollHeight;
  },50);
}

// --------------------
// CHAT SYSTEM
// --------------------
function currentChat(){
  return chats.find(x=>x.id===current);
}

function newChat(){
  const c = {
    id: uid(),
    title: "New Chat",
    msg:[]
  };

  chats.unshift(c);
  current = c.id;

  saveData();
  renderHistory();
  renderChat();
  closeSidebarMobile();
}

// --------------------
// RENDER HISTORY
// --------------------
function renderHistory(){

  historyBox.innerHTML = "";

  chats.forEach(c=>{

    const item = document.createElement("div");
    item.className = "history-item";

    item.innerHTML = `
      <div class="history-top">
        <div class="history-title">${escapeHtml(c.title)}</div>

        <div class="history-actions">
          <button class="icon-btn"
          onclick="openRename('${c.id}')">✏</button>

          <button class="icon-btn"
          onclick="askDelete('${c.id}')">✕</button>
        </div>
      </div>
    `;

    item.onclick = (e)=>{
      if(e.target.tagName==="BUTTON") return;

      current = c.id;
      saveData();
      renderChat();
      closeSidebarMobile();
    };

    historyBox.appendChild(item);

  });

}

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

    if(m.type==="image"){
      bubbleImage(m.url,m.role,false);
    }else{
      bubble(m.text,m.role,false);
    }

  });

  scrollBottom();
}

// --------------------
// MESSAGE BUBBLE
// --------------------
function bubble(text,role,save=true){

  const wrap = document.createElement("div");
  wrap.className = role==="user" ? "user-row":"bot-row";

  const box = document.createElement("div");
  box.className = role==="user" ? "user-bubble":"bot-bubble";

  wrap.appendChild(box);
  chatBox.appendChild(wrap);

  let i = 0;

  function type(){
    if(i < text.length){
      box.innerHTML += escapeHtml(text[i]);
      i++;
      scrollBottom();
      setTimeout(type,12);
    }
  }

  type();

  if(save){
    const c = currentChat();
    if(!c) return;

    c.msg.push({
      role,
      text,
      type:"text"
    });

    if(c.msg.length===1){
      c.title = smartTitle(text);
    }

    saveData();
    renderHistory();
  }
}

function bubbleImage(url,role="bot",save=true){

  const wrap = document.createElement("div");
  wrap.className = role==="user" ? "user-row":"bot-row";

  const box = document.createElement("div");
  box.className = role==="user" ? "user-bubble":"bot-bubble";

  box.innerHTML = `
    <img src="${url}" class="chat-img">
  `;

  wrap.appendChild(box);
  chatBox.appendChild(wrap);

  if(save){
    const c = currentChat();
    c.msg.push({
      role,
      url,
      type:"image"
    });
    saveData();
  }

  scrollBottom();
}

// --------------------
// SEND MESSAGE
// --------------------
form.onsubmit = async(e)=>{
  e.preventDefault();

  let msg = input.value.trim();

  if(!msg && !selectedFile) return;

  if(!current){
    newChat();
  }

  if(msg){
    bubble(msg,"user",true);
  }

  if(selectedFile){

    const url = URL.createObjectURL(selectedFile);
    bubbleImage(url,"user",true);

  }

  input.value = "";
  input.style.height = "auto";

  previewBox.innerHTML = "";

  const thinking = document.createElement("div");
  thinking.className = "bot-row";
  thinking.innerHTML = `
    <div class="bot-bubble thinking">
      NeuroMV is thinking<span class="dots">...</span>
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

    if(data.type==="image"){

      const loading = document.createElement("div");
      loading.className = "bot-row";
      loading.innerHTML = `
        <div class="bot-bubble">
          🎨 Creating Image...
        </div>
      `;

      chatBox.appendChild(loading);
      scrollBottom();

      setTimeout(()=>{
        loading.remove();
        bubble("✅ Image Created","bot",false);
        bubbleImage(data.url,"bot",true);
      },10000);

    }else{
      bubble(data.reply || "No response","bot",true);
    }

  }catch(err){

    thinking.remove();
    bubble("NeuroMV encountered an error.","bot",true);

  }

};

// --------------------
// ENTER SEND
// --------------------
input.addEventListener("keydown",(e)=>{

  if(e.key==="Enter" && !e.shiftKey){
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
// FILE PREVIEW
// --------------------
fileInput.onchange = ()=>{

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

};

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

  chats = chats.filter(x=>x.id!==deleteTarget);

  if(current===deleteTarget){
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
function openPrivate(){
  alert("Private Mode Ready 🔒");
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

// swipe
let startX = 0;

sidebar.addEventListener("touchstart",(e)=>{
  startX = e.changedTouches[0].screenX;
});

sidebar.addEventListener("touchend",(e)=>{
  let endX = e.changedTouches[0].screenX;

  if(startX - endX > 70){
    closeSidebarMobile();
  }
});

// --------------------
// MORE MENU
// --------------------
function toggleMoreMenu(){
  moreMenu.classList.toggle("hidden");
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
// INIT
// --------------------
renderHistory();
renderChat();
