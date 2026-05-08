// static/script.js
// FULL FINAL TITAN POLISH

let chats = JSON.parse(localStorage.getItem("neuromv_chats") || "[]");
let current = localStorage.getItem("neuromv_current") || null;
let privateChats = JSON.parse(localStorage.getItem("neuromv_private") || "[]");

let renameTarget = null;
let deleteTarget = null;
let selectedFile = null;
let pinStep = 0;

// ELEMENTS
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

// SAVE
function saveData(){
  localStorage.setItem("neuromv_chats", JSON.stringify(chats));
  localStorage.setItem("neuromv_private", JSON.stringify(privateChats));
  localStorage.setItem("neuromv_current", current || "");
}

// HELPERS
function uid(){
  return "c" + Date.now() + Math.floor(Math.random()*9999);
}

function esc(t){
  return String(t)
    .replace(/&/g,"&amp;")
    .replace(/</g,"&lt;")
    .replace(/>/g,"&gt;");
}

function smartTitle(t){
  t=(t||"").trim();
  if(!t) return "New Chat";
  return t.length>28 ? t.slice(0,28)+"..." : t;
}

function scrollBottom(){
  setTimeout(()=>{
    chatBox.scrollTop = chatBox.scrollHeight;
  },50);
}

function currentChat(){
  return chats.find(x=>x.id===current);
}

// NEW CHAT
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

// HISTORY
function renderHistory(){

  historyBox.innerHTML = "";

  chats.forEach(c=>{

    const item = document.createElement("div");
    item.className = "history-item";

    item.innerHTML = `
      <div class="history-top">
        <div class="history-title">${esc(c.title)}</div>

        <button class="icon-btn"
        onclick="event.stopPropagation();toggleChatMenu('${c.id}',this)">
        ⋮
        </button>
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

// MINI MENU
function toggleChatMenu(id,btn){

  closeMiniMenus();

  const menu = document.createElement("div");
  menu.className = "more-menu";
  menu.style.position = "absolute";
  menu.style.right = "10px";
  menu.style.width = "170px";
  menu.innerHTML = `
    <button onclick="openRename('${id}')">✏ Rename</button>
    <button onclick="movePrivate('${id}')">🔒 Private</button>
    <button onclick="askDelete('${id}')">🗑 Delete</button>
  `;

  btn.parentElement.style.position="relative";
  btn.parentElement.appendChild(menu);
}

function closeMiniMenus(){
  document.querySelectorAll(".history-top .more-menu").forEach(x=>x.remove());
}

document.addEventListener("click",(e)=>{
  if(!e.target.closest(".icon-btn")){
    closeMiniMenus();
  }
});

// CHAT
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
      bubble(m.text,m.role,false,false);
    }

  });

  scrollBottom();
}

// BUBBLE
function bubble(text,role="bot",save=true,type=true){

  const row = document.createElement("div");
  row.className = role==="user" ? "user-row":"bot-row";

  const box = document.createElement("div");
  box.className = role==="user" ? "user-bubble":"bot-bubble";

  row.appendChild(box);
  chatBox.appendChild(row);

  if(type && role==="bot"){

    let i=0;

    function typing(){
      if(i<text.length){
        box.innerHTML += esc(text[i]);
        i++;
        scrollBottom();
        setTimeout(typing,10);
      }
    }

    typing();

  }else{
    box.innerText = text;
  }

  if(save){
    const c = currentChat();
    if(!c) return;

    c.msg.push({
      role,text,type:"text"
    });

    if(c.msg.length===1 && role==="user"){
      c.title = smartTitle(text);
    }

    saveData();
    renderHistory();
  }

  scrollBottom();
}

function bubbleImage(url,role="bot",save=true){

  const row = document.createElement("div");
  row.className = role==="user" ? "user-row":"bot-row";

  const box = document.createElement("div");
  box.className = role==="user" ? "user-bubble":"bot-bubble";

  box.innerHTML = `<img src="${url}" class="chat-img">`;

  row.appendChild(box);
  chatBox.appendChild(row);

  if(save){
    const c=currentChat();
    if(c){
      c.msg.push({
        role,url,type:"image"
      });
      saveData();
    }
  }

  scrollBottom();
}

// SEND
form.addEventListener("submit",async(e)=>{

  e.preventDefault();

  const msg = input.value.trim();

  if(!msg && !selectedFile) return;

  if(!current) newChat();

  if(msg) bubble(msg,"user",true,false);

  if(selectedFile){
    bubbleImage(URL.createObjectURL(selectedFile),"user",true);
  }

  input.value="";
  input.style.height="auto";
  previewBox.innerHTML="";

  const think = document.createElement("div");
  think.className="bot-row";
  think.innerHTML=`<div class="bot-bubble">NeuroMV is thinking...</div>`;
  chatBox.appendChild(think);

  scrollBottom();

  try{

    const fd = new FormData();
    fd.append("message",msg);
    fd.append("chat_id",current);

    if(selectedFile){
      fd.append("file",selectedFile);
    }

    selectedFile=null;

    const res = await fetch("/chat",{
      method:"POST",
      body:fd
    });

    const data = await res.json();

    think.remove();

    if(data.type==="image"){
      bubbleImage(data.url,"bot",true);
    }else{
      bubble(data.reply || "No response","bot",true,true);
    }

  }catch(err){
    think.remove();
    bubble("NeuroMV connection error.","bot",true,false);
  }

});

// ENTER
input.addEventListener("keydown",(e)=>{
  if(e.key==="Enter" && !e.shiftKey){
    e.preventDefault();
    form.requestSubmit();
  }
});

// AUTO HEIGHT
input.addEventListener("input",()=>{
  input.style.height="auto";
  input.style.height=input.scrollHeight+"px";
});

// FILE
fileInput.addEventListener("change",()=>{

  const f=fileInput.files[0];
  if(!f) return;

  selectedFile=f;

  previewBox.innerHTML=`
    <div class="history-item">
      ${esc(f.name)}
    </div>
  `;
});

// RENAME
function openRename(id){
  renameTarget=id;
  renameInput.value="";
  renameModal.classList.remove("hidden");
}

function closeRename(){
  renameModal.classList.add("hidden");
}

function saveRename(){

  const val=renameInput.value.trim();
  if(!val) return;

  const c=chats.find(x=>x.id===renameTarget);
  if(c) c.title=val;

  saveData();
  renderHistory();
  closeRename();
}

// DELETE
function askDelete(id){
  deleteTarget=id;
  deleteModal.classList.remove("hidden");
}

function closeDelete(){
  deleteModal.classList.add("hidden");
}

function confirmDelete(){

  chats = chats.filter(x=>x.id!==deleteTarget);

  if(current===deleteTarget){
    current=chats[0]?.id || null;
  }

  saveData();
  renderHistory();
  renderChat();
  closeDelete();
}

// PRIVATE
function movePrivate(id){

  const c=chats.find(x=>x.id===id);
  if(!c) return;

  privateChats.push(c);
  chats=chats.filter(x=>x.id!==id);

  if(current===id){
    current=chats[0]?.id || null;
  }

  saveData();
  renderHistory();
  renderChat();
}

function openPrivate(){
  alert("Private Chats: "+privateChats.length);
}

// PIN
function setPinPrompt(){

  pinInput.value="";

  if(localStorage.getItem("neuromv_pin")){
    pinStep=1;
    pinText.innerText="Enter Current PIN";
  }else{
    pinStep=2;
    pinText.innerText="Create New PIN";
  }

  pinModal.classList.remove("hidden");
}

function submitPin(){

  const val = pinInput.value.trim();
  if(!val) return;

  const oldPin = localStorage.getItem("neuromv_pin");

  if(pinStep===1){

    if(val===oldPin){
      pinStep=2;
      pinInput.value="";
      pinText.innerText="Enter New PIN";
      return;
    }else{
      alert("Wrong PIN");
      return;
    }

  }

  if(pinStep===2){
    localStorage.setItem("neuromv_pin",val);
    alert("PIN Updated");
    closePin();
  }
}

function closePin(){
  pinModal.classList.add("hidden");
}

// MENU
function toggleMoreMenu(){
  moreMenu.classList.toggle("hidden");
}

// SIDEBAR
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

overlay.onclick = closeSidebarMobile;

// INIT
renderHistory();
renderChat();
