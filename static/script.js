// =========================
// NEUROMV ULTRA FINAL V3
// FULL STABLE SCRIPT.JS
// KEEP ALL FEATURES + SMART CURSOR AI
// =========================

// =========================
// STORAGE
// =========================
let chats = JSON.parse(localStorage.getItem("neuromv_chats") || "[]");
let privateChats = JSON.parse(localStorage.getItem("neuromv_private") || "[]");
let current = localStorage.getItem("neuromv_current") || "";

let renameTarget = null;
let deleteTarget = null;
let selectedFile = null;

let savedPin = localStorage.getItem("neuromv_pin") || "";
let pinMode = "";
let pendingPrivateId = null;
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
  },40);
}

function dimButton(el){
  if(!el) return;
  el.style.opacity = ".45";
  el.style.pointerEvents = "none";
}

// =========================
// CHAT SYSTEM
// =========================
function newChat(){

  closeMenus();

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

function ensureChat(){
  if(chats.length === 0){
    newChat();
  }else if(!current){
    current = chats[0].id;
    saveData();
  }
}

// =========================
// HISTORY
// =========================
function renderHistory(){

  historyBox.innerHTML = "";

  chats.forEach(c=>{

    const div = document.createElement("div");
    div.className = "history-item";

    if(c.id === current){
      div.classList.add("active");
    }

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
      toggleMenu(c.id, e.target);
    };

    historyBox.appendChild(div);
  });

  updatePrivateCount();
}

// =========================
// MENUS
// =========================
function toggleSidebarMenu(e){

  e.stopPropagation();

  const old = document.getElementById("sidebarFooterMenu");

  if(old){
    old.remove();
    return;
  }

  closeMenus();

  const menu = document.createElement("div");

  menu.id = "sidebarFooterMenu";
  menu.className = "more-menu";

  menu.innerHTML = `
    <div class="private-chats" onclick="openPrivate()">
      Private Chats: ${privateChats.length}
    </div>

    <button onclick="setPinPrompt()">
      🔑 Change PIN
    </button>

    <button onclick="document.getElementById('sidebarFooterMenu').remove()">
      ✕ Close
    </button>
  `;

  const footer = document.querySelector(".sidebar-footer");

  footer.appendChild(menu);
}

function closeMenus(){

  document
    .querySelectorAll(".mini-menu, #sidebarFooterMenu")
    .forEach(x=>x.remove());
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

function togglePrivateMenu(id, btn){

  closeMenus();

  const menu = document.createElement("div");

  menu.className = "mini-menu";

  menu.innerHTML = `
    <button onclick="unPrivate('${id}')">
      🔓 Un-Private
    </button>

    <button onclick="askDelete('${id}')">
      🗑 Delete
    </button>
  `;

  btn.parentElement.appendChild(menu);
}

function unPrivate(id){

  const val = prompt("Enter PIN");

  if(val !== savedPin){
    alert("Wrong PIN");
    return;
  }

  const i = privateChats.findIndex(x=>x.id===id);

  if(i===-1) return;

  const chat = privateChats[i];

  chat.private = false;

  chats.unshift(chat);

  privateChats.splice(i,1);

  saveData();

  renderHistory();
}

function toggleMoreMenu(){

  closeMenus();

  const old = document.getElementById("chatTopMenu");
  if(old){
    old.remove();
    return;
  }

  const menu = document.createElement("div");
  menu.id = "chatTopMenu";
  menu.className = "mini-menu";

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
    !e.target.closest(".more-menu") &&
    !e.target.closest(".icon-btn") &&
    !e.target.closest(".dots-btn")
  ){
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
        <p>Your intelligent AI assistant</p>
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
// TEXT BUBBLE
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

    function stream(){

      if(i <= text.length){

        box.innerHTML =
          esc(text.slice(0,i)) +
          `<span class="ai-cursor"></span>`;

        i++;
        scrollBottom();
        setTimeout(stream,12);

      }else{
        box.innerText = text;
      }
    }

    stream();

  }else{
    box.innerText = text;
  }

  if(save){

    const c = currentChat();

    if(c){

      c.msg.push({
        role,
        text,
        type:"text"
      });

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
// THINKING DOT
// =========================
function thinkingBubble(){

  const row = document.createElement("div");
  row.className = "bot-row thinking-row";

  row.innerHTML = `
    <div class="bot-bubble">
      <span class="thinking-dot"></span>
    </div>
  `;

  chatBox.appendChild(row);
  scrollBottom();

  return row;
}

// =========================
// IMAGE BUBBLE
// =========================
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
      c.msg.push({
        role,
        url,
        type:"image"
      });

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
    <div class="bot-bubble">Creating Image...</div>
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
    c.msg.push({
      role:"bot",
      url:url,
      type:"image"
    });

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

  const welcome = chatBox.querySelector(".welcome");
  if(welcome) welcome.remove();

  if(msg){
    bubble(msg,"user",true,false);
  }

  const fd = new FormData();
  fd.append("message", msg);
  fd.append("chat_id", current);

  if(selectedFile){
    fd.append("file", selectedFile);
  }

  input.value = "";
  preview.innerHTML = "";
  selectedFile = null;

  const loading = thinkingBubble();

  try{

    const res = await fetch("/chat",{
      method:"POST",
      body:fd
    });

    const data = await res.json();

    loading.remove();

    if(data.type==="limit_chat"){
      chatLocked = true;
      dimButton(sendBtn);
      bubble("Daily chat limit reached.","bot",true,false);
      return;
    }

    if(data.type==="limit_file"){
      fileLocked = true;
      dimButton(uploadBtn);
      bubble("Daily file upload limit reached.","bot",true,false);
      return;
    }

    if(data.type==="limit_image"){
      imageLocked = true;
      bubble("Daily image generation limit reached.","bot",true,false);
      return;
    }

    if(data.type==="image"){

      const imgLoad = creatingImageBubble();

      setTimeout(()=>{
        imgLoad.remove();
        imageDoneBubble(data.url);
      },4000);

      return;
    }

    bubble(data.reply || "No response","bot",true,true);

  }catch(err){

    loading.remove();
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
// PRIVATE
// =========================
function movePrivate(id){

  pendingPrivateId = id;

  if(!savedPin){

    pinMode = "create_private";

    document.getElementById("pinText").innerText =
      "Create PIN for Private Chats";

  }else{

    pinMode = "verify_private";

    document.getElementById("pinText").innerText =
      "Enter PIN to move chat";
  }

  pinInput.value = "";
  pinModal.classList.remove("hidden");
}

function openPrivate(){

  if(!savedPin){

    pinMode = "create_access";
    document.getElementById("pinText").innerText =
      "Create a new PIN";

    pinInput.value = "";
    pinModal.classList.remove("hidden");

    return;
  }

  pinMode = "open_private";

  document.getElementById("pinText").innerText =
    "Enter your PIN";

  pinInput.value = "";
  pinModal.classList.remove("hidden");
}

// =========================
// RENAME
// =========================
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

  if(c){
    c.title = val;
  }

  saveData();
  renderHistory();
  closeRename();
}

// =========================
// DELETE
// =========================
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

  if(current===deleteTarget){
    current = chats[0]?.id || "";
  }

  saveData();

  ensureChat();
  renderHistory();
  renderChat();

  closeDelete();
}

// =========================
// PIN
// =========================
function setPinPrompt(){
  pinModal.classList.remove("hidden");
}

function submitPin(){

  const val = pinInput.value.trim();

  if(!val) return;

  // =====================
  // CREATE PIN
  // =====================
  if(pinMode === "create_private" ||
     pinMode === "create_access"){

    savedPin = val;

    localStorage.setItem(
      "neuromv_pin",
      savedPin
    );

    // lanjut private
    if(pinMode === "create_private"){
      doMovePrivate();
    }

    pinModal.classList.add("hidden");
    return;
  }
function doMovePrivate(){

  const id = pendingPrivateId;

  const i = chats.findIndex(x=>x.id===id);

  if(i===-1) return;

  const chat = chats[i];

  chat.private = true;

  privateChats.unshift(chat);

  chats.splice(i,1);

  if(current===id){
    current = chats[0]?.id || "";
  }

  saveData();

  renderHistory();
  renderChat();
}
  // =====================
  // VERIFY
  // =====================
  if(val !== savedPin){
    alert("Wrong PIN");
    return;
  }

  // open private
  if(pinMode === "open_private"){
    showPrivateChats();
  }

  // verify private move
  if(pinMode === "verify_private"){
    doMovePrivate();
  }

  pinModal.classList.add("hidden");
}

function showPrivateChats(){

  historyBox.innerHTML = "";

  privateChats.forEach(c=>{

    const div = document.createElement("div");

    div.className = "history-item";

    div.innerHTML = `
      <div class="history-top">
        <div class="history-title">
          🔒 ${esc(c.title)}
        </div>

        <button class="icon-btn">⋮</button>
      </div>
    `;

    div.onclick = ()=>{

      chats.unshift(c);

      privateChats =
        privateChats.filter(x=>x.id!==c.id);

      current = c.id;

      saveData();

      renderHistory();
      renderChat();
    };

    div.querySelector(".icon-btn").onclick = (e)=>{
      e.stopPropagation();

      togglePrivateMenu(c.id, e.target);
    };

    historyBox.appendChild(div);
  });
}

function closePin(){ pinModal.classList.add("hidden");
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
// PRIVATE COUNT
// =========================
function updatePrivateCount(){

  const el = document.querySelector(".private-chats");

  if(el){
    el.innerText = `Private Chats: ${privateChats.length}`;
  }
}

// =========================
// INIT
// =========================
ensureChat();
renderHistory();
renderChat();
updatePrivateCount();
