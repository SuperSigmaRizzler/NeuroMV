// ========================================
// NeuroMV V3 GOD MODE
// static/script.js
// ========================================

// -----------------------------
// STATE
// -----------------------------
let chats = JSON.parse(localStorage.getItem("neuromv_chats") || "[]");
let current = localStorage.getItem("neuromv_current") || null;

let renameTarget = null;
let deleteTarget = null;

let privateChats = JSON.parse(localStorage.getItem("neuromv_private") || "[]");

let selectedFile = null;
let isTyping = false;

// -----------------------------
// ELEMENTS
// -----------------------------
const chatBox     = document.getElementById("chat");
const historyBox  = document.getElementById("history");
const input       = document.getElementById("input");
const form        = document.getElementById("form");
const fileInput   = document.getElementById("file");
const previewBox  = document.getElementById("preview");
const sendBtn     = document.getElementById("sendBtn");
const sidebar     = document.getElementById("sidebar");

const pinModal    = document.getElementById("pinModal");
const pinInput    = document.getElementById("pinInput");

const renameModal = document.getElementById("renameModal");
const renameInput = document.getElementById("renameInput");

const deleteModal = document.getElementById("deleteModal");

const moreMenu    = document.getElementById("moreMenu");

// -----------------------------
// SAVE
// -----------------------------
function saveData(){
  localStorage.setItem("neuromv_chats", JSON.stringify(chats));
  localStorage.setItem("neuromv_private", JSON.stringify(privateChats));
  localStorage.setItem("neuromv_current", current || "");
}

// -----------------------------
// HELPERS
// -----------------------------
function uid(){
  return "c" + Date.now() + Math.floor(Math.random()*999);
}

function smartTitle(text){
  text = text.trim();
  if(!text) return "New Chat";

  if(text.length <= 26) return text;

  return text.slice(0,26) + "...";
}

function scrollBottom(){
  chatBox.scrollTop = chatBox.scrollHeight;
}

// -----------------------------
// CHAT CREATE
// -----------------------------
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
}

function currentChat(){
  return chats.find(x=>x.id===current);
}

// -----------------------------
// RENDER HISTORY
// -----------------------------
function renderHistory(){
  historyBox.innerHTML = "";

  chats.forEach(c=>{

    const item = document.createElement("div");
    item.className = "history-item";

    item.innerHTML = `
      <div class="history-top">
        <div class="history-title">${escapeHtml(c.title)}</div>

        <div class="history-actions">
          <button class="icon-btn" onclick="openRename('${c.id}')">✏</button>
          <button class="icon-btn" onclick="askDelete('${c.id}')">✕</button>
        </div>
      </div>
    `;

    item.onclick = (e)=>{
      if(e.target.tagName === "BUTTON") return;
      current = c.id;
      saveData();
      renderChat();
      closeSidebarMobile();
    };

    historyBox.appendChild(item);
  });
}

// -----------------------------
// RENDER CHAT
// -----------------------------
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
      addImageBubble(m.url,false);
    }else{
      addBubble(m.role,m.text,false);
    }
  });

  scrollBottom();
}

// -----------------------------
// BUBBLE
// -----------------------------
function addBubble(role,text,save=true){

  const wrap = document.createElement("div");
  wrap.className = "msg " + role;

  const bubble = document.createElement("div");
  bubble.className = "bubble";

  wrap.appendChild(bubble);
  chatBox.appendChild(wrap);

  if(role === "bot"){
    typeWriter(bubble,text);
  }else{
    bubble.textContent = text;
  }

  if(save){
    const c = currentChat();
    c.msg.push({
      role,text,type:"text"
    });

    if(c.msg.length === 1){
      c.title = smartTitle(text);
      renderHistory();
    }

    saveData();
  }

  scrollBottom();
}

function addImageBubble(url,save=true){

  const wrap = document.createElement("div");
  wrap.className = "msg bot";

  const bubble = document.createElement("div");
  bubble.className = "bubble";

  bubble.innerHTML = `
    <div>✅ Image Created</div>
    <img src="${url}">
  `;

  wrap.appendChild(bubble);
  chatBox.appendChild(wrap);

  if(save){
    const c = currentChat();
    c.msg.push({
      type:"image",
      url
    });
    saveData();
  }

  scrollBottom();
}

// -----------------------------
// TYPE WRITER
// -----------------------------
function typeWriter(el,text){

  let i = 0;
  isTyping = true;

  const cursor = document.createElement("span");
  cursor.textContent = " ●";
  cursor.style.opacity = ".7";
  el.appendChild(cursor);

  function step(){

    if(i < text.length){
      cursor.remove();

      el.textContent += text[i];
      i++;

      el.appendChild(cursor);
      scrollBottom();

      setTimeout(step,16);
    }else{
      cursor.remove();
      isTyping = false;
    }
  }

  step();
}

// -----------------------------
// THINKING
// -----------------------------
function thinkingBubble(mode="think"){

  const wrap = document.createElement("div");
  wrap.className = "msg bot";

  const bubble = document.createElement("div");
  bubble.className = "bubble";

  if(mode==="image"){
    bubble.innerHTML = `
      <div class="typing">
        <span>🎨 Creating Image...</span>
      </div>
    `;
  }else{
    bubble.innerHTML = `
      <div class="typing">
        <span class="dot"></span>
        <span class="dot"></span>
        <span class="dot"></span>
      </div>
    `;
  }

  wrap.appendChild(bubble);
  chatBox.appendChild(wrap);

  scrollBottom();

  return wrap;
}

// -----------------------------
// SEND
// -----------------------------
form.onsubmit = async(e)=>{
  e.preventDefault();

  if(isTyping) return;

  let msg = input.value.trim();

  if(!msg && !selectedFile) return;

  // auto new chat if no current
  if(!current){
    newChat();
  }

  // user bubble
  if(msg){
    addBubble("user",msg,true);
  }

  // preview sent file
  if(selectedFile){
    addBubble("user","📎 File uploaded",true);
  }

  input.value = "";
  autoResize();
  clearPreview();

  let imageMode = detectImagePrompt(msg);

  let loader = thinkingBubble(
    imageMode ? "image" : "think"
  );

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

    if(imageMode){
      setTimeout(()=>{
        loader.remove();

        if(data.type==="image"){
          addImageBubble(data.url,true);
        }else{
          addBubble("bot",data.reply || "Failed to generate image.",true);
        }

      },10000);

    }else{

      loader.remove();

      addBubble(
        "bot",
        data.reply || "NeuroMV encountered an error.",
        true
      );
    }

  }catch(err){

    loader.remove();

    addBubble(
      "bot",
      "Network error. Please try again.",
      true
    );
  }
};

// -----------------------------
// DETECT IMAGE PROMPT
// -----------------------------
function detectImagePrompt(t){

  t = t.toLowerCase();

  const words = [
    "image","gambar","foto","draw","anime",
    "generate","create image","wallpaper",
    "logo","art","painting","render",
    "portrait","landscape","3d"
  ];

  return words.some(w=>t.includes(w));
}

// -----------------------------
// FILE
// -----------------------------
fileInput.onchange = ()=>{

  const f = fileInput.files[0];
  if(!f) return;

  selectedFile = f;

  const url = URL.createObjectURL(f);

  previewBox.innerHTML = `
    <div class="preview-card">
      <img src="${url}">
      <button class="preview-remove" onclick="clearPreview()">✕</button>
    </div>
  `;
};

function clearPreview(){
  selectedFile = null;
  fileInput.value = "";
  previewBox.innerHTML = "";
}

// -----------------------------
// ENTER SEND
// -----------------------------
input.addEventListener("keydown",(e)=>{
  if(e.key==="Enter" && !e.shiftKey){
    e.preventDefault();
    form.requestSubmit();
  }
});

function autoResize(){
  input.style.height="auto";
  input.style.height=input.scrollHeight+"px";
}

input.addEventListener("input",autoResize);

// -----------------------------
// RENAME
// -----------------------------
function openRename(id){
  renameTarget = id;
  renameModal.classList.remove("hidden");

  const c = chats.find(x=>x.id===id);
  renameInput.value = c?.title || "";
}

function closeRename(){
  renameModal.classList.add("hidden");
}

function saveRename(){

  const c = chats.find(x=>x.id===renameTarget);
  if(c){
    c.title = renameInput.value.trim() || "Untitled";
  }

  saveData();
  renderHistory();
  closeRename();
}

// -----------------------------
// DELETE
// -----------------------------
function askDelete(id){
  deleteTarget = id;
  deleteModal.classList.remove("hidden");
}

function closeDelete(){
  deleteModal.classList.add("hidden");
}

function confirmDelete(){

  chats = chats.filter(x=>x.id!==deleteTarget);

  if(current === deleteTarget){
    current = chats[0]?.id || null;
  }

  saveData();
  renderHistory();
  renderChat();
  closeDelete();
}

// -----------------------------
// PRIVATE
// -----------------------------
async function openPrivate(){

  const res = await fetch("/check_unlock");
  const data = await res.json();

  if(!data.unlocked){
    pinModal.classList.remove("hidden");
    return;
  }

  if(privateChats.length===0){
    alert("No private chats.");
    return;
  }

  chats = privateChats.concat(chats);
  privateChats = [];

  saveData();
  renderHistory();
}

function closePin(){
  pinModal.classList.add("hidden");
}

async function submitPin(){

  const pin = pinInput.value.trim();

  if(!pin) return;

  const res = await fetch("/verify_pin",{
    method:"POST",
    headers:{
      "Content-Type":"application/json"
    },
    body:JSON.stringify({pin})
  });

  const data = await res.json();

  if(data.ok){
    closePin();
    openPrivate();
  }else{
    alert("Wrong PIN");
  }
}

async function setPinPrompt(){

  const pin = prompt("Create PIN:");

  if(!pin) return;

  await fetch("/set_pin",{
    method:"POST",
    headers:{
      "Content-Type":"application/json"
    },
    body:JSON.stringify({pin})
  });

  alert("PIN saved.");
}

// -----------------------------
// SIDEBAR
// -----------------------------
function toggleSidebar(){

  sidebar.classList.add("show");

document.getElementById("overlay").classList.remove("hidden");
}

function closeSidebarMobile(){
  if(window.innerWidth < 900){
    sidebar.classList.remove("show");
  }
}

// -----------------------------
// MENU
// -----------------------------
function toggleMoreMenu(){
  moreMenu.classList.toggle("hidden");
}

// -----------------------------
// SAFE HTML
// -----------------------------
function escapeHtml(text){
  return text
    .replaceAll("&","&amp;")
    .replaceAll("<","&lt;")
    .replaceAll(">","&gt;");
}

// -----------------------------
// INIT
// -----------------------------
renderHistory();
renderChat();



// swipe close sidebar
let touchStartX = 0;

sidebar.addEventListener("touchstart",(e)=>{
  touchStartX = e.touches[0].clientX;
});

sidebar.addEventListener("touchmove",(e)=>{
  let moveX = e.touches[0].clientX;

  if(moveX - touchStartX < -70){
    closeSidebarMobile();
  }
});
