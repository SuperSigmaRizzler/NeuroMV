// =========================
// NEUROMV FINAL STABLE
// =========================

let chats = JSON.parse(localStorage.getItem("neuromv_chats") || "[]");
let privateChats = JSON.parse(localStorage.getItem("neuromv_private") || "[]");
let current = localStorage.getItem("neuromv_current") || null;

let renameTarget = null;
let deleteTarget = null;
let selectedFile = null;
let pinMode = "create";

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
          ${c.private ? "🔒 " : ""}
          ${esc(c.title)}
        </div>

        <button class="icon-btn">
          ⋮
        </button>

      </div>
    `;

    div.onclick = ()=>{
      current = c.id;
      saveData();
      renderChat();
    };

    const btn = div.querySelector(".icon-btn");

    btn.onclick = (e)=>{
      e.stopPropagation();
      toggleMenu(c.id, btn);
    };

    historyBox.appendChild(div);
  });

  updatePrivateCount();
}

// =========================
// MENU
// =========================
function closeMenus(){
  document.querySelectorAll(".mini-menu")
    .forEach(x=>x.remove());
}

function toggleMenu(id, btn){

  const old = btn.parentElement.querySelector(".mini-menu");

  closeMenus();

  if(old) return;

  const menu = document.createElement("div");

  menu.className = "mini-menu";

  menu.innerHTML = `
    <button class="rename-btn">✏ Rename</button>
    <button class="private-btn">🔒 Private</button>
    <button class="delete-btn">🗑 Delete</button>
  `;

  btn.parentElement.appendChild(menu);

  menu.querySelector(".rename-btn").onclick = (e)=>{
    e.stopPropagation();
    openRename(id);
  };

  menu.querySelector(".private-btn").onclick = (e)=>{
    e.stopPropagation();
    movePrivate(id);
  };

  menu.querySelector(".delete-btn").onclick = (e)=>{
    e.stopPropagation();
    askDelete(id);
  };
}

document.addEventListener("click",(e)=>{
  if(!e.target.closest(".mini-menu") &&
     !e.target.closest(".icon-btn")){
    closeMenus();
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

  c.msg.forEach(m=>{

    if(m.type === "image"){
      bubbleImage(m.url, m.role, false);
    }else{
      bubble(m.text, m.role, false, false);
    }

  });

  scrollBottom();
}

function bubble(text, role="bot", save=true, typing=true){

  const row = document.createElement("div");

  row.className =
    role === "user"
      ? "user-row"
      : "bot-row";

  const box = document.createElement("div");

  box.className =
    role === "user"
      ? "user-bubble"
      : "bot-bubble";

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

      c.msg.push({
        role,
        text,
        type:"text"
      });

      if(c.msg.length===1 && role==="user"){
        c.title = text.slice(0,30);
      }

      saveData();
      renderHistory();
    }
  }
}

// =========================
// IMAGE
// =========================
function bubbleImage(url, role="bot", save=true){

  const row = document.createElement("div");

  row.className =
    role==="user"
      ? "user-row"
      : "bot-row";

  const box = document.createElement("div");

  box.className =
    role==="user"
      ? "user-bubble"
      : "bot-bubble";

  box.innerHTML = `
    <img src="${url}" class="chat-img">
  `;

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
}

// =========================
// SEND
// =========================
form.addEventListener("submit", async(e)=>{

  e.preventDefault();

  const msg = input.value.trim();

  if(!msg && !selectedFile) return;

  if(!current){
    newChat();
  }

  if(msg){
    bubble(msg,"user",true,false);
  }

  input.value = "";

  const fd = new FormData();

  fd.append("message", msg);
  fd.append("chat_id", current);

  if(selectedFile){
    fd.append("file", selectedFile);
  }

  try{

    const res = await fetch("/chat",{
      method:"POST",
      body:fd
    });

    const data = await res.json();

    if(data.type==="image"){
      bubbleImage(data.url);
    }else{
      bubble(data.reply || "No response");
    }

  }catch{
    bubble("Connection error.","bot",true,false);
  }

});

// =========================
// PRIVATE
// =========================
function movePrivate(id){

  const pin = localStorage.getItem("neuromv_pin");

  if(!pin){

    alert("Create PIN first");

    setPinPrompt();

    return;
  }

  const ask = prompt("Enter PIN");

  if(ask !== pin){
    alert("Wrong PIN");
    return;
  }

  const index = chats.findIndex(
    x => x.id === id
  );

  if(index === -1) return;

  const chat = chats[index];

  chat.private = true;

  privateChats.unshift(chat);

  chats.splice(index,1);

  if(current === id){
    current = null;
  }

  saveData();

  renderHistory();
  renderChat();
  updatePrivateCount();
}

// OPEN PRIVATE LIST
function openPrivate(){

  const pin = localStorage.getItem("neuromv_pin");

  if(!pin){
    alert("No PIN set");
    return;
  }

  const ask = prompt("Enter PIN");

  if(ask !== pin){
    alert("Wrong PIN");
    return;
  }

  historyBox.innerHTML = "";

  if(privateChats.length === 0){

    historyBox.innerHTML = `
      <div class="history-item">
        No private chats
      </div>
    `;

    return;
  }

  privateChats.forEach(c => {

    const item = document.createElement("div");

    item.className = "history-item";

    item.innerHTML = `
      <div class="history-top">

        <div class="history-title">
          🔒 ${esc(c.title)}
        </div>

        <button class="icon-btn">
          ⋮
        </button>

      </div>
    `;

    // OPEN CHAT
    item.onclick = ()=>{

      current = c.id;

      renderPrivateChat(c);
    };

    // MENU
    const btn = item.querySelector(".icon-btn");

    btn.onclick = (e)=>{

      e.stopPropagation();

      togglePrivateMenu(c.id, btn);
    };

    historyBox.appendChild(item);
  });
}

// PRIVATE CHAT VIEW
function renderPrivateChat(chat){

  chatBox.innerHTML = "";

  chat.msg.forEach(m=>{

    if(m.type === "image"){
      bubbleImage(m.url, m.role, false);
    }else{
      bubble(m.text, m.role, false, false);
    }

  });

  scrollBottom();
}

// PRIVATE MENU
function togglePrivateMenu(id, btn){

  closeMenus();

  const menu = document.createElement("div");

  menu.className = "mini-menu";

  menu.innerHTML = `
    <button class="restore-btn">
      🔓 Unprivate
    </button>

    <button class="delete-btn">
      🗑 Delete
    </button>
  `;

  btn.parentElement.appendChild(menu);

  menu.querySelector(".restore-btn").onclick = (e)=>{

    e.stopPropagation();

    restorePrivate(id);
  };

  menu.querySelector(".delete-btn").onclick = (e)=>{

    e.stopPropagation();

    askDelete(id);
  };
}

// RESTORE
function restorePrivate(id){

  const pin = localStorage.getItem("neuromv_pin");

  const ask = prompt("Enter PIN");

  if(ask !== pin){
    alert("Wrong PIN");
    return;
  }

  const index = privateChats.findIndex(
    x => x.id === id
  );

  if(index === -1) return;

  const chat = privateChats[index];

  chat.private = false;

  chats.unshift(chat);

  privateChats.splice(index,1);

  saveData();

  renderHistory();
  updatePrivateCount();
}

// =========================
// PIN
// =========================
function setPinPrompt(){

  pinModal.classList.remove("hidden");

  pinInput.value = "";

  pinText.innerText = "Create New PIN";
}

function submitPin(){

  const val = pinInput.value.trim();

  if(!val) return;

  localStorage.setItem("neuromv_pin", val);

  alert("PIN saved");

  closePin();
}

function closePin(){
  pinModal.classList.add("hidden");
}

// =========================
// RENAME
// =========================
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

  privateChats = privateChats.filter(
    x=>x.id!==deleteTarget
  );

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

// =========================
// MORE MENU
// =========================
function toggleMoreMenu(){

  moreMenu.classList.toggle("hidden");
}

function updatePrivateCount(){

  const el = document.querySelector(".private-chats");

  if(el){
    el.innerText =
      `Private Chats: ${privateChats.length}`;
  }
}

// =========================
// INIT
// =========================
renderHistory();
renderChat();
updatePrivateCount();
