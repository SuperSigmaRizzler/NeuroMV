// =========================
// NEUROMV ULTRA FINAL SCRIPT.JS
// BACKEND-FIRST HISTORY + BACKEND MEMORY DELETE
// STREAMING + PRIVATE + PREVIEW + EDIT + REGEN + LIMIT POPUP
// =========================

// =========================
// WIPE LEGACY LOCAL CHAT STORAGE
// =========================
localStorage.removeItem("neuromv_chats");
localStorage.removeItem("neuromv_private");

// =========================
// BACKEND STATE
// =========================
let chats = [];
let privateChats = [];
let current = localStorage.getItem("neuromv_current") || "";

// =========================
// DEVICE ID + META
// =========================
function getDeviceId(){
  let id = localStorage.getItem("neuromv_device_id");

  if(!id){
    if(window.crypto && crypto.randomUUID){
      id = "dev_" + crypto.randomUUID();
    }else{
      id = "dev_" + Date.now() + "_" + Math.random().toString(36).slice(2);
    }

    localStorage.setItem("neuromv_device_id", id);
  }

  return id;
}

const DEVICE_ID = getDeviceId();

function getDeviceMeta(){
  let screenText = "";

  try{
    screenText = `${screen.width}x${screen.height}x${screen.colorDepth}`;
  }catch{}

  return {
    tz: Intl.DateTimeFormat().resolvedOptions().timeZone || "",
    lang: navigator.language || "",
    platform: navigator.platform || "",
    screen: screenText,
    memory: navigator.deviceMemory || "",
    touch: String(navigator.maxTouchPoints || 0)
  };
}

function appendIdentity(fd){
  fd.append("user_id", DEVICE_ID);
  fd.append("device_meta", JSON.stringify(getDeviceMeta()));
}

// =========================
// STATE
// =========================
let selectedFile = null;
let selectedFileMeta = null;

let renameTarget = null;
let deleteTarget = null;

let savedPin = localStorage.getItem("neuromv_pin") || "";
let pinMode = "";
let pendingPrivateId = null;

let aiMode = localStorage.getItem("neuromv_mode") || "thinking";

let activeController = null;
let isGenerating = false;
const generators = {};

let editingIndex = null;
let showingPrivate = false;
let currentPrivate = false;

const STREAM_TOKEN_DELAY = Number(localStorage.getItem("neuromv_stream_delay") || "35");
let limitState = JSON.parse(localStorage.getItem("neuromv_limit_state") || "{}");

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

const sendBtn =
  form?.querySelector("button[type='submit']") ||
  form?.querySelector("button");

const uploadBtn = document.querySelector(".upload-btn");

let sendBtnOriginalHTML = sendBtn ? sendBtn.innerHTML : "Send";
let sendBtnOriginalTitle = sendBtn ? (sendBtn.title || "Send") : "Send";

// =========================
// BASIC HELPERS
// =========================
function sleep(ms){
  return new Promise(resolve => setTimeout(resolve, ms));
}

function esc(t){
  return String(t ?? "")
    .replace(/&/g,"&amp;")
    .replace(/</g,"&lt;")
    .replace(/>/g,"&gt;");
}

function escAttr(t){
  return String(t ?? "")
    .replace(/&/g,"&amp;")
    .replace(/"/g,"&quot;")
    .replace(/</g,"&lt;")
    .replace(/>/g,"&gt;");
}

function safeLang(lang){
  const x = String(lang || "text")
    .trim()
    .replace(/[^\w+#.-]/g,"")
    .slice(0,30);

  return x || "text";
}

function saveCurrent(){
  localStorage.setItem("neuromv_current", current || "");
}

function getListByPrivacy(isPrivate=false){
  return isPrivate ? privateChats : chats;
}

function getChatById(id,isPrivate=false){
  return getListByPrivacy(isPrivate).find(x => x.id === id);
}

function getAnyChatById(id){
  return chats.find(x => x.id === id) || privateChats.find(x => x.id === id);
}

function isPrivateChatId(id){
  return privateChats.some(x => x.id === id);
}

function currentChat(){
  return currentPrivate ? privateChats.find(x => x.id === current) : chats.find(x => x.id === current);
}

function renderSidebarList(){
  if(showingPrivate || currentPrivate){
    renderPrivateHistory();
  }else{
    renderHistory();
  }
}

function scrollBottom(){
  setTimeout(()=>{
    if(chatBox) chatBox.scrollTop = chatBox.scrollHeight;
  },30);
}

function closeMenus(){
  document.querySelectorAll(".mini-menu").forEach(x => x.remove());
}

function isValidHttpUrl(url){
  try{
    const u = new URL(String(url).replace(/&amp;/g,"&"));
    return u.protocol === "http:" || u.protocol === "https:";
  }catch{
    return false;
  }
}

function formatSize(bytes){
  if(!bytes) return "";
  if(bytes < 1024) return bytes + " B";
  if(bytes < 1024 * 1024) return (bytes / 1024).toFixed(1) + " KB";
  return (bytes / (1024 * 1024)).toFixed(1) + " MB";
}

function removeEmojis(text){
  return String(text || "").replace(/[\u{1F300}-\u{1FAFF}\u{2600}-\u{27BF}]/gu,"");
}

// =========================
// BACKEND API
// =========================
async function apiForm(url, data={}){
  const fd = new FormData();

  Object.entries(data).forEach(([k,v])=>{
    fd.append(k, v);
  });

  appendIdentity(fd);

  const res = await fetch(url,{
    method:"POST",
    body:fd
  });

  return await res.json();
}

async function loadBackendChats(privateMode=false){
  try{
    const data = await apiForm("/chats",{
      private: privateMode ? "1" : "0"
    });

    if(privateMode){
      privateChats = data.chats || [];
    }else{
      chats = data.chats || [];
    }

    if(current){
      const exists = chats.some(c => c.id === current) || privateChats.some(c => c.id === current);
      if(!exists){
        current = "";
        currentPrivate = false;
        saveCurrent();
      }
    }
  }catch{
    if(privateMode) privateChats = [];
    else chats = [];
  }
}

async function createBackendChat(title="New Chat",privateMode=false){
  const data = await apiForm("/chat/create",{
    title,
    private: privateMode ? "1" : "0"
  });

  if(data.ok && data.chat){
    const c = {
      ...data.chat,
      msg: data.chat.messages || []
    };

    if(privateMode){
      privateChats.unshift(c);
    }else{
      chats.unshift(c);
    }

    return c;
  }

  return null;
}

async function loadBackendMessages(chatId,isPrivate=false){
  if(!chatId) return null;

  try{
    const data = await apiForm("/chat/messages",{
      chat_id: chatId
    });

    if(!data.ok || !data.chat) return null;

    const c = {
      ...data.chat,
      msg: normalizeBackendMessages(data.messages || [])
    };

    const arr = isPrivate ? privateChats : chats;
    const i = arr.findIndex(x => x.id === chatId);

    if(i >= 0){
      arr[i] = {...arr[i], ...c};
    }else{
      arr.unshift(c);
    }

    return c;
  }catch{
    return null;
  }
}

function normalizeBackendMessages(messages){
  return messages.map(m=>{
    if(m.type === "attachment"){
      return {type:"attachment", meta:m.meta || {}, role:m.role || "user"};
    }

    if(m.type === "image"){
      if(m.url){
        return {type:"image", url:m.url, role:m.role || "bot", text:m.text || ""};
      }
      return {role:m.role || "bot", text:m.text || "", type:"text"};
    }

    return {
      role:m.role || "bot",
      text:m.text || "",
      type:"text"
    };
  });
}

async function deleteBackendChatMemory(chatId){
  try{
    await apiForm("/chat/delete",{chat_id:chatId});
  }catch{}
}

async function deleteAllBackendMemory(){
  try{
    await apiForm("/chats/delete_all",{});
  }catch{}
}

async function renameBackendChat(chatId,title){
  try{
    await apiForm("/chat/rename",{chat_id:chatId,title});
  }catch{}
}

async function setBackendPrivate(chatId,privateMode){
  try{
    await apiForm("/chat/private",{
      chat_id:chatId,
      private: privateMode ? "1" : "0"
    });
  }catch{}
}

async function truncateBackendChat(chatId,index){
  try{
    await apiForm("/chat/truncate",{
      chat_id:chatId,
      index:String(index)
    });
  }catch{}
}

async function updateBackendUserMessage(chatId,index,text){
  try{
    await apiForm("/chat/update_user_message",{
      chat_id:chatId,
      index:String(index),
      text
    });
  }catch{}
}

// Bisa dipakai dari console: clearNeuroMVAll()
async function clearNeuroMVAll(){
  chats = [];
  privateChats = [];
  current = "";
  currentPrivate = false;
  showingPrivate = false;
  localStorage.removeItem("neuromv_current");
  localStorage.removeItem("neuromv_limit_state");
  await deleteAllBackendMemory();
  renderHistory();
  renderChat();
  fetchLimits();
}

// =========================
// LIMIT UI
// =========================
function saveLimitState(){
  localStorage.setItem("neuromv_limit_state", JSON.stringify(limitState || {}));
}

function updateLimitStateFromPayload(payload){
  if(!payload) return;

  if(payload.remaining){
    limitState = payload.remaining;
    saveLimitState();
    applyLimitUI();
  }
}

function getRemain(kind){
  if(!limitState || (!limitState[kind] && limitState[kind] !== 0)){
    return null;
  }
  return Number(limitState[kind]);
}

function isChatLimitReached(){
  const r = getRemain("chat");
  return r !== null && r <= 0;
}

function isFileLimitReached(){
  const r = getRemain("file");
  return r !== null && r <= 0;
}

function isImageLimitReached(){
  const r = getRemain("image");
  return r !== null && r <= 0;
}

function styleDisabled(el,on){
  if(!el) return;

  if(on){
    el.classList.add("limit-disabled");
    el.style.opacity = ".38";
    el.style.pointerEvents = "none";
    el.style.filter = "grayscale(1)";
    el.style.cursor = "not-allowed";
  }else{
    el.classList.remove("limit-disabled");
    el.style.opacity = "";
    el.style.pointerEvents = "";
    el.style.filter = "";
    el.style.cursor = "";
  }
}

function applyLimitUI(){
  const chatBlocked = isChatLimitReached();
  const fileBlocked = isFileLimitReached();

  if(uploadBtn){
    styleDisabled(uploadBtn,fileBlocked);
    uploadBtn.title = fileBlocked ? "Upload limit reached" : "";
  }

  if(fileInput){
    fileInput.disabled = fileBlocked;
  }

  if(sendBtn && !chatIsGenerating(current)){
    if(chatBlocked){
      sendBtn.classList.add("limit-disabled");
      sendBtn.disabled = true;
      sendBtn.innerHTML = "➤";
      sendBtn.title = "Daily chat limit reached";
      sendBtn.style.opacity = ".38";
      sendBtn.style.filter = "grayscale(1)";
      sendBtn.style.cursor = "not-allowed";
    }else{
      sendBtn.disabled = false;
      sendBtn.classList.remove("limit-disabled");
      sendBtn.innerHTML = sendBtnOriginalHTML;
      sendBtn.title = sendBtnOriginalTitle;
      sendBtn.style.opacity = "";
      sendBtn.style.filter = "";
      sendBtn.style.cursor = "";
    }
  }
}

async function fetchLimits(){
  try{
    const data = await apiForm("/limits",{});
    updateLimitStateFromPayload(data);
  }catch{}
}

function showLimitBubble(kind="chat"){
  let title = "You've reached your daily limit";
  let desc = "Please try again tomorrow.";

  if(kind === "chat"){
    title = "You've reached your daily chat limit";
    desc = "Come back again tomorrow.";
  }

  if(kind === "file"){
    title = "You've reached your daily upload limit";
    desc = "Come back again for more.";
  }

  if(kind === "image"){
    title = "You've reached your daily image generation limit";
    desc = "You can generate more images after the daily reset.";
  }

  showLimitPopup(title, desc);
}

function showLimitPopup(title, desc){
  document.querySelectorAll(".limit-popup").forEach(x => x.remove());

  const pop = document.createElement("div");
  pop.className = "limit-popup";

  pop.innerHTML = `
    <div class="limit-popup-card">
      <button class="limit-popup-x" type="button" aria-label="Close">×</button>
      <div class="limit-popup-icon">!</div>
      <div class="limit-popup-content">
        <strong>${esc(title)}</strong>
        <p>${esc(desc)}</p>
      </div>
    </div>
  `;

  document.body.appendChild(pop);

  pop.querySelector(".limit-popup-x").onclick = ()=>{
    pop.remove();
  };

  setTimeout(()=>{
    pop.classList.add("show");
  },10);

  setTimeout(()=>{
    pop.classList.remove("show");
    setTimeout(()=>pop.remove(),250);
  },4500);
}

// =========================
// SMART TITLE
// =========================
function titleCase(text){
  return String(text || "")
    .split(" ")
    .filter(Boolean)
    .map(w => w.charAt(0).toUpperCase() + w.slice(1))
    .join(" ");
}

function makeSmartTitle(text,file){
  let t = String(text || "").trim();

  if(!t && file){
    t = file.name || "Uploaded file";
  }

  t = t
    .replace(/https?:\/\/\S+/gi,"Link")
    .replace(/[`*_#>\[\]{}()]/g," ")
    .replace(/\s+/g," ")
    .trim();

  t = removeEmojis(t);

  const low = t.toLowerCase();

  if(!t && file) return "Uploaded File";
  if(!t) return "New Chat";

  const apaItu = low.match(/^apa itu\s+(.+?)[?.!]*$/i);

  if(apaItu && apaItu[1]){
    const topic = titleCase(apaItu[1].replace(/[?.!]/g,"").trim()).slice(0,28);
    return "Penjelasan " + topic;
  }

  if(low.includes("python")) return "Penjelasan Python";
  if(low.includes("javascript") || low.includes("script.js")) return "JavaScript Help";
  if(low.includes("app.py")) return "Editing app.py";
  if(low.includes("style.css")) return "Styling NeuroMV UI";
  if(low.includes("index.html")) return "Editing HTML";
  if(low.includes("flask")) return "Flask Backend Help";
  if(low.includes("github") || low.includes("git ")) return "GitHub Workflow";
  if(low.includes("error") || low.includes("traceback")) return "Fixing Code Error";
  if(low.includes("ocr")) return "OCR Image Reading";
  if(low.includes("gambar") || low.includes("image") || low.includes("foto")) return "Image Analysis";
  if(low.includes("matematika") || low.includes("persamaan") || low.includes("luas")) return "Solving Math Problem";
  if(low.includes("presiden") || low.includes("sekarang") || low.includes("hari ini")) return "Live Web Search";
  if(low.includes("ingat") || low.includes("chat sebelumnya") || low.includes("barusan")) return "Memory Recall";

  t = t.replace(/^(tolong|please|pls|coba|bisa|bisakah|mohon|bang|bro)\s+/i,"").trim();

  const words = t.split(" ").filter(Boolean);
  let title = words.slice(0,5).join(" ");

  if(!title) title = "New Chat";

  return title.length > 38 ? title.slice(0,38).trim() + "..." : title;
}

async function updateChatTitleSmart(chatId,msg,reply,file){
  const c = getAnyChatById(chatId);
  if(!c) return;

  if(c.autoTitleDone){
    return;
  }

  const userCount = (c.msg || []).filter(m => m.role === "user").length;

  if(userCount > 1){
    c.autoTitleDone = true;
    return;
  }

  c.title = makeSmartTitle(msg || file?.name || "",file);
  c.autoTitleDone = true;
  renderSidebarList();

  try{
    const data = await apiForm("/title",{
      chat_id: chatId,
      message: msg || "",
      reply: reply || "",
      file: file?.name || ""
    });

    const title = String(data.title || "").trim();

    if(title && getAnyChatById(chatId)){
      c.title = title.slice(0,42);
      c.autoTitleDone = true;
      renderSidebarList();
    }
  }catch{}
}

async function createChatFromFirstMessage(msg,file){
  const title = makeSmartTitle(msg,file);
  const c = await createBackendChat(title,false);

  if(!c) return null;

  c.msg = [];
  c.autoTitleDone = false;

  current = c.id;
  currentPrivate = false;
  showingPrivate = false;
  saveCurrent();

  await loadBackendChats(false);
  renderHistory();

  return c;
}

// =========================
// GENERATING / STOP BUTTON
// =========================
function chatIsGenerating(chatId=current){
  return !!generators[chatId];
}

function setGeneratingState(on){
  isGenerating = Object.keys(generators).length > 0;

  if(!sendBtn) return;

  if(on){
    sendBtn.disabled = false;
    sendBtn.classList.remove("limit-disabled");
    sendBtn.style.opacity = "";
    sendBtn.style.filter = "";
    sendBtn.style.cursor = "";
    sendBtn.classList.add("stop-mode");
    sendBtn.innerHTML = "■";
    sendBtn.title = "Stop generating";
  }else{
    sendBtn.classList.remove("stop-mode");
    sendBtn.innerHTML = sendBtnOriginalHTML;
    sendBtn.title = sendBtnOriginalTitle;
    applyLimitUI();
  }
}

function refreshSendButton(){
  setGeneratingState(chatIsGenerating(current));
}

function stopGenerating(){
  const gen = generators[current];

  if(!gen){
    refreshSendButton();
    return;
  }

  gen.stopped = true;

  try{
    gen.controller.abort();
  }catch{}

  delete generators[current];
  refreshSendButton();
}

// =========================
// STATUS / HTML CLEANER
// =========================
function cleanBackendStatus(text){
  return String(text || "")
    .replace(/^🔎\s*Searching\.\.\.<br><br>/i,"")
    .replace(/^🖼️\s*Analyzing Image\.\.\.<br><br>/i,"")
    .replace(/^🌐\s*Reading URL\.\.\.<br><br>/i,"")
    .replace(/^🎨\s*Creating Image\.\.\.<br><br>/i,"")
    .replace(/^Thinking\.\.\.<br><br>/i,"")
    .replace(/^Instant\.\.\.<br><br>/i,"")
    .trim();
}

function cleanHtmlStyleLeaks(text){
  text = String(text || "");

  text = text.replace(/<\s*h[1-6][^>]*>([\s\S]*?)<\s*\/\s*h[1-6]\s*>/gi, (_,inner)=>{
    inner = inner.replace(/<[^>]+>/g,"").trim();
    return inner ? "\n## " + inner + "\n" : "";
  });

  text = text.replace(/<\s*span[^>]*>([\s\S]*?)<\s*\/\s*span\s*>/gi, "$1");
  text = text.replace(/<\s*br\s*\/?\s*>/gi, "\n");
  text = text.replace(/<\s*\/\s*p\s*>/gi, "\n\n");
  text = text.replace(/<\/?(div|p|section|article|main|header|footer|h[1-6]|span)[^>]*>/gi, "");

  return text.trim();
}

// =========================
// LINKS + MARKDOWN
// =========================
function isValidUrlForLink(url){
  return isValidHttpUrl(url);
}

function linkifyHtml(html){
  const root = document.createElement("div");
  root.innerHTML = html;

  const walker = document.createTreeWalker(
    root,
    NodeFilter.SHOW_TEXT,
    {
      acceptNode(node){
        if(!/https?:\/\//i.test(node.nodeValue || "")){
          return NodeFilter.FILTER_REJECT;
        }

        let p = node.parentElement;

        while(p){
          const tag = (p.tagName || "").toLowerCase();
          if(["a","code","pre","script","style","button"].includes(tag)){
            return NodeFilter.FILTER_REJECT;
          }
          p = p.parentElement;
        }

        return NodeFilter.FILTER_ACCEPT;
      }
    }
  );

  const nodes = [];

  while(walker.nextNode()){
    nodes.push(walker.currentNode);
  }

  nodes.forEach(node=>{
    const text = node.nodeValue || "";
    const regex = /https?:\/\/[^\s<>"']+/gi;

    let match;
    let last = 0;
    const frag = document.createDocumentFragment();

    while((match = regex.exec(text)) !== null){
      let url = match[0];
      let trailing = "";

      while(/[),.!?;:]$/.test(url)){
        trailing = url.slice(-1) + trailing;
        url = url.slice(0,-1);
      }

      frag.appendChild(document.createTextNode(text.slice(last, match.index)));

      const realUrl = url.replace(/&amp;/g,"&");

      if(isValidUrlForLink(realUrl)){
        const a = document.createElement("a");
        a.href = realUrl;
        a.target = "_blank";
        a.rel = "noopener noreferrer";
        a.textContent = url;
        frag.appendChild(a);
      }else{
        frag.appendChild(document.createTextNode(url));
      }

      if(trailing){
        frag.appendChild(document.createTextNode(trailing));
      }

      last = match.index + match[0].length;
    }

    frag.appendChild(document.createTextNode(text.slice(last)));

    if(node.parentNode){
      node.parentNode.replaceChild(frag,node);
    }
  });

  return root.innerHTML;
}

function formatUserText(text){
  const html = esc(text).replace(/\n/g,"<br>");
  return linkifyHtml(html);
}

function protectMathBlocks(text){
  const math = [];

  text = String(text || "").replace(/\$\$([\s\S]*?)\$\$/g,(_,body)=>{
    const id = math.length;
    math.push(`<div class="math-block">\\[${esc(body.trim())}\\]</div>`);
    return `@@MATH_BLOCK_${id}@@`;
  });

  text = text.replace(/\\\[([\s\S]*?)\\\]/g,(_,body)=>{
    const id = math.length;
    math.push(`<div class="math-block">\\[${esc(body.trim())}\\]</div>`);
    return `@@MATH_BLOCK_${id}@@`;
  });

  text = text.replace(/\\\(([\s\S]*?)\\\)/g,(_,body)=>{
    const id = math.length;
    math.push(`<span class="math-inline">\\(${esc(body.trim())}\\)</span>`);
    return `@@MATH_BLOCK_${id}@@`;
  });

  return {text,math};
}

function restoreSafeBackendHtml(html){
  html = html.replace(/&lt;br\s*\/?&gt;/gi,"<br>");

  html = html.replace(
    /&lt;span style='opacity:\.85'&gt;([\s\S]*?)&lt;\/span&gt;/gi,
    "<span style='opacity:.85'>$1</span>"
  );

  html = html.replace(
    /&lt;a href='([^']+)' target='_blank' title='([^']*)'&gt;&lt;img src='([^']+)' style='([^']*)'&gt;&lt;\/a&gt;/gi,
    (_,href,title,src,style)=>{
      const cleanHref = href.replace(/&amp;/g,"&");
      const cleanSrc = src.replace(/&amp;/g,"&");

      if(!isValidHttpUrl(cleanHref)) return "";
      if(!isValidHttpUrl(cleanSrc)) return "";

      return `
        <a href="${escAttr(cleanHref)}" target="_blank" rel="noopener noreferrer" title="${escAttr(title)}" class="source-icon">
          <img src="${escAttr(cleanSrc)}" style="${escAttr(style)}">
        </a>
      `;
    }
  );

  html = html.replace(
    /&lt;a href='([^']+)' target='_blank'&gt;([\s\S]*?)&lt;\/a&gt;/gi,
    (_,href,label)=>{
      const cleanHref = href.replace(/&amp;/g,"&");
      if(!isValidHttpUrl(cleanHref)) return esc(label);
      return `<a href="${escAttr(cleanHref)}" target="_blank" rel="noopener noreferrer">${label}</a>`;
    }
  );

  return html;
}

function parseMarkdown(text){
  text = cleanBackendStatus(text);
  text = cleanHtmlStyleLeaks(text);

  const protectedMath = protectMathBlocks(text);
  text = protectedMath.text;

  const blocks = [];

  text = String(text).replace(/```([a-zA-Z0-9_+\-.#]*)?\n([\s\S]*?)```/g, (_,lang,code)=>{
    const language = safeLang(lang);
    const id = "code_" + Math.random().toString(36).slice(2,10);

    const block = `
      <div class="code-wrap chatgpt-code-wrap">
        <div class="code-head chatgpt-code-head">
          <span class="code-lang">${esc(language)}</span>
          <button class="copy-btn code-copy-btn" onclick="copyCode('${id}',this)" type="button" aria-label="Copy code">
            <span class="copy-icon"></span>
            <span class="copy-label">Copy</span>
          </button>
        </div>
        <pre class="code-pre chatgpt-code-pre"><code id="${id}" class="language-${esc(language)}">${esc(code.trim())}</code></pre>
      </div>
    `;

    blocks.push(block);
    return `@@NEUROMV_CODEBLOCK_${blocks.length - 1}@@`;
  });

  let html = esc(text);

  html = html.replace(/^### (.*)$/gm,"<h3>$1</h3>");
  html = html.replace(/^## (.*)$/gm,"<h2>$1</h2>");
  html = html.replace(/^# (.*)$/gm,"<h1>$1</h1>");
  html = html.replace(/\*\*(.*?)\*\*/g,"<strong>$1</strong>");
  html = html.replace(/\*(.*?)\*/g,"<em>$1</em>");
  html = html.replace(/`([^`]+)`/g,"<code class='inline-code'>$1</code>");
  html = html.replace(/^\- (.*)$/gm,"• $1");
  html = html.replace(/\n/g,"<br>");

  blocks.forEach((block,i)=>{
    html = html.replace(`@@NEUROMV_CODEBLOCK_${i}@@`, block);
  });

  protectedMath.math.forEach((block,i)=>{
    html = html.replace(`@@MATH_BLOCK_${i}@@`, block);
  });

  html = restoreSafeBackendHtml(html);
  html = linkifyHtml(html);

  return html;
}

function renderMath(){
  try{
    if(window.MathJax && window.MathJax.typesetPromise){
      window.MathJax.typesetPromise();
    }
  }catch{}
}

function applyHighlight(){
  if(window.hljs){
    document.querySelectorAll("pre code").forEach(el=>{
      try{
        hljs.highlightElement(el);
      }catch{}
    });
  }

  renderMath();
}

function copyCode(id,btn){
  const el = document.getElementById(id);
  const code = el ? el.innerText : "";
  const label = btn.querySelector(".copy-label");

  navigator.clipboard.writeText(code).then(()=>{
    btn.classList.add("copied");

    if(label){
      label.innerText = "Copied";
    }else{
      btn.innerText = "Copied";
    }

    setTimeout(()=>{
      btn.classList.remove("copied");

      if(label){
        label.innerText = "Copy";
      }else{
        btn.innerText = "Copy";
      }
    },1200);
  }).catch(()=>{
    if(label){
      label.innerText = "Failed";
      setTimeout(()=>label.innerText = "Copy",1200);
    }
  });
}

// =========================
// USER MESSAGE ACTIONS
// =========================
function copyUserMessage(text,btn){
  navigator.clipboard.writeText(text || "").then(()=>{
    const old = btn.innerHTML;
    btn.innerHTML = "✓";
    setTimeout(()=>btn.innerHTML = old,1000);
  });
}

function addUserActions(row,text,index){
  if(index === null || index === undefined) return;

  const actions = document.createElement("div");
  actions.className = "message-actions user-message-actions";

  actions.innerHTML = `
    <button type="button" title="Copy message" onclick="copyUserMessage(${JSON.stringify(text)}, this)">
      <span class="mini-copy-icon"></span>
    </button>
    <button type="button" title="Edit message" onclick="editUserMessage(${index})">Edit</button>
    <button type="button" title="Regenerate response" onclick="regenerateFromUser(${index})">Regenerate</button>
  `;

  row.appendChild(actions);
}

function editUserMessage(index){
  if(chatIsGenerating(current)) return;

  const c = currentChat();
  if(!c || !c.msg[index] || c.msg[index].role !== "user") return;

  editingIndex = index;
  input.value = c.msg[index].text || "";
  input.focus();
  input.classList.add("editing-message");
}

async function regenerateFromUser(index){
  if(chatIsGenerating(current)) return;

  if(isChatLimitReached()){
    showLimitBubble("chat");
    return;
  }

  const c = currentChat();
  if(!c || !c.msg[index] || c.msg[index].role !== "user") return;

  const msg = c.msg[index].text || "";
  const chatIdForTitle = current;
  const targetPrivate = currentPrivate;

  c.msg = c.msg.slice(0,index + 1);
  await truncateBackendChat(current,index);

  renderChat();

  await sendStreamingMessage(msg,chatIdForTitle,false,targetPrivate,false);
}

// =========================
// MODE TOGGLE
// =========================
function initModeToggle(){
  let wrap = document.getElementById("modeToggle");

  if(!wrap){
    wrap = document.createElement("div");
    wrap.id = "modeToggle";
    wrap.className = "mode-toggle mode-toggle-top";
    wrap.style.width = "100%";
    wrap.style.justifyContent = "flex-end";
    wrap.style.boxSizing = "border-box";

    wrap.innerHTML = `
      <button type="button" data-mode="instant">⚡ Instant</button>
      <button type="button" data-mode="thinking">🧠 Deep Thinking</button>
    `;

    const main = document.querySelector(".main");
    const mobileTopbar = document.querySelector(".mobile-topbar");

    if(main && mobileTopbar){
      main.insertBefore(wrap, mobileTopbar.nextSibling);
    }else if(main){
      main.insertBefore(wrap, main.firstChild);
    }else if(form?.parentElement){
      form.parentElement.insertBefore(wrap, form.parentElement.firstChild);
    }
  }

  updateModeUI();
}

function updateModeUI(){
  document.querySelectorAll("#modeToggle button").forEach(btn=>{
    btn.classList.toggle("active", btn.dataset.mode === aiMode);
  });
}

document.addEventListener("click",(e)=>{
  const btn = e.target.closest("#modeToggle button[data-mode]");
  if(!btn) return;

  e.preventDefault();
  e.stopPropagation();

  aiMode = btn.dataset.mode;
  localStorage.setItem("neuromv_mode", aiMode);
  updateModeUI();
});

// =========================
// STATUS LOADER
// =========================
function isImageFile(file){
  if(!file) return false;
  if(file.type && file.type.startsWith("image/")) return true;
  return /\.(png|jpg|jpeg|webp)$/i.test(file.name || "");
}

function hasUrl(text){
  return /https?:\/\/\S+/i.test(text);
}

function looksLikeImagePrompt(text){
  const low = text.toLowerCase();
  return [
    "buat gambar",
    "generate image",
    "draw",
    "gambar",
    "logo",
    "poster",
    "illustration",
    "anime art"
  ].some(x => low.includes(x));
}

function looksLikeMemory(text){
  const low = text.toLowerCase();
  return [
    "masih ingat",
    "ingat tadi",
    "ingat ga",
    "ingat gak",
    "barusan",
    "tadi kita",
    "kita tadi",
    "chat sebelumnya",
    "sebelumnya aku",
    "aku tadi",
    "aku barusan",
    "ngomong apa",
    "bahas apa",
    "tadi ngomong",
    "tadi bahas",
    "remember",
    "previous chat"
  ].some(x => low.includes(x));
}

function looksLikeSearch(text){
  const low = text.toLowerCase();

  if(looksLikeMemory(text)) return false;

  const triggers = [
    "presiden","menteri","gubernur",
    "hari ini","sekarang","latest","news","update",
    "tanggal","tahun ini","current","harga","kapan",
    "rilis","2024","2025","2026","2027"
  ];

  return triggers.some(x => low.includes(x));
}

function labelFromAction(action,msg,file){
  if(isImageFile(file)) return "Analyzing Image";
  if(file) return "Reading File";

  if(action === "search") return "Searching";
  if(action === "url") return "Reading URL";
  if(action === "image") return "Creating Image";
  if(action === "memory") return "Recalling Memory";

  if(hasUrl(msg)) return "Reading URL";
  if(looksLikeImagePrompt(msg)) return "Creating Image";
  if(looksLikeSearch(msg)) return "Searching";
  if(looksLikeMemory(msg)) return "Recalling Memory";

  return aiMode === "thinking" ? "Deep Thinking" : "Instant";
}

function createStatusBubble(label){
  const row = document.createElement("div");
  row.className = "bot-row status-row";

  row.innerHTML = `
    <div class="bot-bubble status-bubble">
      <span class="glossy-text">${esc(label)}</span>
      <span class="thinking-dots"><i></i><i></i><i></i></span>
    </div>
  `;

  chatBox.appendChild(row);
  scrollBottom();

  return row;
}

function updateStatusBubble(row,label){
  if(!row) return;
  const text = row.querySelector(".glossy-text");
  if(text) text.textContent = label;
}

// =========================
// ROUTER
// =========================
async function getRouteAction(msg,signal,chatId=current,mode=aiMode){
  try{
    const fd = new FormData();
    fd.append("message",msg);
    fd.append("chat_id",chatId || "default");
    fd.append("mode",mode);
    appendIdentity(fd);

    const res = await fetch("/route",{
      method:"POST",
      body:fd,
      signal
    });

    const data = await res.json();
    return data.action || "chat";
  }catch{
    if(hasUrl(msg)) return "url";
    if(looksLikeMemory(msg)) return "memory";
    if(looksLikeImagePrompt(msg)) return "image";
    if(looksLikeSearch(msg)) return "search";
    return "chat";
  }
}

// =========================
// FILE PREVIEW
// =========================
function fileToMeta(file,callback){
  const meta = {
    name: file.name,
    type: file.type || "file",
    size: file.size,
    time: Date.now(),
    dataUrl: ""
  };

  if(isImageFile(file)){
    const reader = new FileReader();

    reader.onload = ()=>{
      meta.dataUrl = reader.result;
      callback(meta);
    };

    reader.readAsDataURL(file);
  }else{
    callback(meta);
  }
}

function setSelectedFile(file){
  if(isFileLimitReached()){
    showLimitBubble("file");
    clearSelectedFile();
    return;
  }

  selectedFile = file;

  fileToMeta(file,(meta)=>{
    selectedFileMeta = meta;
    renderInputPreview();
  });
}

function clearSelectedFile(){
  selectedFile = null;
  selectedFileMeta = null;

  if(fileInput) fileInput.value = "";
  if(preview) preview.innerHTML = "";
}

function renderInputPreview(){
  if(!preview || !selectedFileMeta){
    if(preview) preview.innerHTML = "";
    return;
  }

  const isImg = selectedFileMeta.type && selectedFileMeta.type.startsWith("image/");

  if(isImg && selectedFileMeta.dataUrl){
    preview.innerHTML = `
      <div class="preview-card image-preview-card">
        <img src="${selectedFileMeta.dataUrl}" class="preview-img">
        <div class="preview-info">
          <span>🖼️ ${esc(selectedFileMeta.name)}</span>
          <small>${formatSize(selectedFileMeta.size)}</small>
        </div>
        <button type="button" class="preview-x" onclick="clearSelectedFile()">×</button>
      </div>
    `;
  }else{
    preview.innerHTML = `
      <div class="preview-card">
        <div class="preview-info">
          <span>📎 ${esc(selectedFileMeta.name)}</span>
          <small>${formatSize(selectedFileMeta.size)}</small>
        </div>
        <button type="button" class="preview-x" onclick="clearSelectedFile()">×</button>
      </div>
    `;
  }
}

function renderChatAttachment(meta,save=false){
  if(!meta) return;

  const row = document.createElement("div");
  row.className = "user-row attachment-row";
  const isImg = meta.type && meta.type.startsWith("image/");

  if(isImg && meta.dataUrl){
    row.innerHTML = `
      <div class="user-attachment-card">
        <img src="${meta.dataUrl}" class="chat-upload-preview">
        <div class="attachment-info">
          <span>🖼️ ${esc(meta.name)}</span>
          <small>${formatSize(meta.size)}</small>
        </div>
      </div>
    `;
  }else{
    row.innerHTML = `
      <div class="user-attachment-card">
        <div class="file-icon">📎</div>
        <div class="attachment-info">
          <span>${esc(meta.name)}</span>
          <small>${formatSize(meta.size)}</small>
        </div>
      </div>
    `;
  }

  chatBox.appendChild(row);
  scrollBottom();
}

// =========================
// INIT / NEW CHAT
// =========================
async function ensureInitialState(){
  await loadBackendChats(false);
  await loadBackendChats(true);

  currentPrivate = isPrivateChatId(current);
  showingPrivate = currentPrivate;

  if(current){
    await loadBackendMessages(current,currentPrivate);
  }

  saveCurrent();
}

function newChat(){
  current = "";
  currentPrivate = false;
  showingPrivate = false;
  editingIndex = null;

  if(input){
    input.value = "";
    input.classList.remove("editing-message");
  }

  saveCurrent();
  renderHistory();
  renderChat();
  refreshSendButton();
  closeSidebarMobile();
}

// =========================
// HISTORY
// =========================
function renderHistory(){
  showingPrivate = false;
  historyBox.innerHTML = "";

  chats.forEach(c=>{
    const div = document.createElement("div");
    div.className = "history-item";

    if(!currentPrivate && c.id === current) div.classList.add("active");

    div.innerHTML = `
      <div class="history-top">
        <div class="history-title">${esc(c.title || "New Chat")}</div>
        <button class="icon-btn" type="button">⋮</button>
      </div>
    `;

    div.onclick = async ()=>{
      current = c.id;
      currentPrivate = false;
      showingPrivate = false;
      editingIndex = null;
      saveCurrent();
      await loadBackendMessages(current,false);
      renderHistory();
      renderChat();
      refreshSendButton();
      closeSidebarMobile();
    };

    div.querySelector(".icon-btn").onclick = (e)=>{
      e.stopPropagation();
      openChatMenu(c.id,e.target);
    };

    historyBox.appendChild(div);
  });
}

async function showPrivate(){
  showingPrivate = true;
  await loadBackendChats(true);
  renderPrivateHistory();
  refreshSendButton();
}

function renderPrivateHistory(){
  showingPrivate = true;
  historyBox.innerHTML = "";

  const back = document.createElement("button");
  back.className = "new-chat-btn private-back-btn";
  back.type = "button";
  back.innerHTML = "← Back to Chats";

  back.onclick = async ()=>{
    showingPrivate = false;
    currentPrivate = false;
    current = chats[0]?.id || "";
    saveCurrent();

    if(current){
      await loadBackendMessages(current,false);
    }

    renderHistory();
    renderChat();
    refreshSendButton();
  };

  historyBox.appendChild(back);

  if(privateChats.length === 0){
    const empty = document.createElement("div");
    empty.className = "history-item";
    empty.innerHTML = `<div class="history-title">No private chats</div>`;
    historyBox.appendChild(empty);
    return;
  }

  privateChats.forEach(c=>{
    const div = document.createElement("div");
    div.className = "history-item";

    if(currentPrivate && c.id === current) div.classList.add("active");

    div.innerHTML = `
      <div class="history-top">
        <div class="history-title">🔒 ${esc(c.title || "New Chat")}</div>
        <button class="icon-btn" type="button">⋮</button>
      </div>
    `;

    div.onclick = async ()=>{
      current = c.id;
      currentPrivate = true;
      showingPrivate = true;
      editingIndex = null;
      saveCurrent();
      await loadBackendMessages(current,true);
      renderPrivateHistory();
      renderChat();
      refreshSendButton();
      closeSidebarMobile();
    };

    div.querySelector(".icon-btn").onclick = (e)=>{
      e.stopPropagation();
      openPrivateMenu(c.id,e.target);
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
    <button type="button" onclick="event.stopPropagation(); openRename('${id}',false)">✏ Rename</button>
    <button type="button" onclick="event.stopPropagation(); movePrivate('${id}')">🔒 Private</button>
    <button type="button" onclick="event.stopPropagation(); askDelete('${id}',false)">🗑 Delete</button>
  `;

  btn.parentElement.appendChild(menu);
}

function openPrivateMenu(id,btn){
  closeMenus();

  const menu = document.createElement("div");
  menu.className = "mini-menu";

  menu.innerHTML = `
    <button type="button" onclick="event.stopPropagation(); openRename('${id}',true)">✏ Rename</button>
    <button type="button" onclick="event.stopPropagation(); prepareUnprivate('${id}')">🔓 Un-private</button>
    <button type="button" onclick="event.stopPropagation(); askDelete('${id}',true)">🗑 Delete</button>
  `;

  btn.parentElement.appendChild(menu);
}

function toggleMoreMenu(){
  closeMenus();

  const btn = document.querySelector(".dots-btn");
  if(!btn) return;

  if(!current){
    const r = btn.getBoundingClientRect();
    const menu = document.createElement("div");
    menu.className = "mini-menu";
    menu.style.position = "fixed";
    menu.style.top = (r.bottom + 8) + "px";
    menu.style.right = "10px";
    menu.innerHTML = `
      <button type="button" onclick="event.stopPropagation(); newChat(); closeMenus()">＋ New Chat</button>
      <button type="button" onclick="event.stopPropagation(); openPrivate(); closeMenus()">🔒 Private</button>
    `;
    document.body.appendChild(menu);
    return;
  }

  const r = btn.getBoundingClientRect();
  const menu = document.createElement("div");
  menu.className = "mini-menu";
  menu.style.position = "fixed";
  menu.style.top = (r.bottom + 8) + "px";
  menu.style.right = "10px";

  if(currentPrivate){
    menu.innerHTML = `
      <button type="button" onclick="event.stopPropagation(); openRename('${current}',true)">✏ Rename</button>
      <button type="button" onclick="event.stopPropagation(); prepareUnprivate('${current}')">🔓 Un-private</button>
      <button type="button" onclick="event.stopPropagation(); askDelete('${current}',true)">🗑 Delete</button>
    `;
  }else{
    menu.innerHTML = `
      <button type="button" onclick="event.stopPropagation(); openRename('${current}',false)">✏ Rename</button>
      <button type="button" onclick="event.stopPropagation(); movePrivate('${current}')">🔒 Private</button>
      <button type="button" onclick="event.stopPropagation(); askDelete('${current}',false)">🗑 Delete</button>
    `;
  }

  document.body.appendChild(menu);
}

// =========================
// CHAT VIEW / BUBBLES
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

  const messages = c.msg || [];

  if(messages.length === 0){
    chatBox.innerHTML = `
      <div class="welcome">
        <h2>NeuroMV</h2>
        <p>Start a new conversation</p>
      </div>
    `;
  }else{
    messages.forEach((m,index)=>{
      if(m.type === "image"){
        bubbleImage(m.url,false);
      }else if(m.type === "attachment"){
        renderChatAttachment(m.meta,false);
      }else{
        bubble(m.text,m.role,false,false,index);
      }
    });
  }

  renderActiveGenerationForCurrent();
  applyHighlight();
  scrollBottom();
}

function renderActiveGenerationForCurrent(){
  const gen = generators[current];

  if(!gen) return;
  if(!!gen.private !== !!currentPrivate) return;

  if(gen.full){
    const bot = createBotStreamingBubble();
    gen.streamBox = bot.box;
    gen.statusRow = null;
    gen.streamBox.innerHTML = parseMarkdown(gen.full) + `<span class="typing-dot">●</span>`;
    applyHighlight();
  }else{
    gen.statusRow = createStatusBubble(gen.label || (gen.mode === "thinking" ? "Deep Thinking" : "Instant"));
    gen.streamBox = null;
  }
}

function bubble(text,role="bot",save=true,typing=false,index=null){
  const row = document.createElement("div");
  row.className = role === "user" ? "user-row" : "bot-row";

  const box = document.createElement("div");
  box.className = role === "user" ? "user-bubble" : "bot-bubble";

  row.appendChild(box);
  chatBox.appendChild(row);

  const cleanText = role === "bot" ? cleanBackendStatus(text) : String(text || "");

  if(typing && role === "bot"){
    let i = 0;
    const speed = aiMode === "instant" ? 1 : 4;

    function run(){
      if(i <= cleanText.length){
        box.innerHTML = parseMarkdown(cleanText.slice(0,i)) + `<span class="typing-dot">●</span>`;
        i++;
        scrollBottom();
        setTimeout(run,speed);
      }else{
        box.innerHTML = parseMarkdown(cleanText);
        applyHighlight();
        scrollBottom();
      }
    }

    run();
  }else{
    box.innerHTML = role === "bot" ? parseMarkdown(cleanText) : formatUserText(cleanText);
    applyHighlight();
  }

  if(save){
    const c = currentChat();

    if(c){
      c.msg = c.msg || [];
      c.msg.push({role, text: cleanText, type: "text"});
      index = c.msg.length - 1;

      if(c.msg.length === 1 && role === "user"){
        c.title = makeSmartTitle(cleanText,null);
      }

      renderSidebarList();
    }
  }

  if(role === "user"){
    addUserActions(row,cleanText,index);
  }

  scrollBottom();
}

function bubbleImage(url,save=true){
  const row = document.createElement("div");
  row.className = "bot-row";

  row.innerHTML = `
    <div class="bot-bubble">
      <img src="${escAttr(url)}" class="chat-img" loading="lazy">
    </div>
  `;

  chatBox.appendChild(row);

  if(save){
    const c = currentChat();
    if(c){
      c.msg = c.msg || [];
      c.msg.push({type:"image", url});
      renderSidebarList();
    }
  }

  scrollBottom();
}

function createBotStreamingBubble(){
  const row = document.createElement("div");
  row.className = "bot-row";

  const box = document.createElement("div");
  box.className = "bot-bubble";

  row.appendChild(box);
  chatBox.appendChild(row);

  scrollBottom();

  return {row,box};
}

function saveBotMessageToLocal(chatId,text,targetPrivate=false){
  const clean = cleanBackendStatus(cleanHtmlStyleLeaks(text || ""));
  if(!clean.trim()) return;

  let c = getChatById(chatId,targetPrivate) || getAnyChatById(chatId);
  if(!c) return;

  c.msg = c.msg || [];
  c.msg.push({role:"bot", text:clean, type:"text"});
  renderSidebarList();
}

function ensureStreamBoxForGen(gen,targetChatId,targetIsPrivate){
  if(current !== targetChatId || currentPrivate !== targetIsPrivate) return;

  if(gen.statusRow && document.body.contains(gen.statusRow)){
    gen.statusRow.remove();
    gen.statusRow = null;
  }

  if(!gen.streamBox || !document.body.contains(gen.streamBox)){
    const bot = createBotStreamingBubble();
    gen.streamBox = bot.box;
  }
}

// =========================
// STREAMING SEND
// =========================
async function sendStreamingMessage(msg,chatIdForTitle,shouldUpdateTitle=true,targetPrivate=currentPrivate,saveUser=true){
  const controller = new AbortController();

  const targetChatId = chatIdForTitle;
  const targetIsPrivate = !!targetPrivate;
  const modeAtStart = aiMode;

  generators[targetChatId] = {
    controller,
    stopped:false,
    private:targetIsPrivate,
    full:"",
    streamBox:null,
    statusRow:null,
    label:modeAtStart === "thinking" ? "Deep Thinking" : "Instant",
    mode:modeAtStart
  };

  activeController = controller;
  refreshSendButton();

  const gen = generators[targetChatId];

  let full = "";
  let gotImage = false;

  try{
    if(current === targetChatId && currentPrivate === targetIsPrivate){
      gen.statusRow = createStatusBubble(gen.label);
    }

    const action = await getRouteAction(msg,controller.signal,targetChatId,modeAtStart);
    gen.label = labelFromAction(action,msg,null);

    if(gen.statusRow && document.body.contains(gen.statusRow)){
      updateStatusBubble(gen.statusRow,gen.label);
    }

    const fd = new FormData();
    fd.append("message",msg);
    fd.append("chat_id",targetChatId);
    fd.append("mode",modeAtStart);
    fd.append("skip_user_save", saveUser ? "0" : "1");
    appendIdentity(fd);

    const res = await fetch("/chat_stream",{
      method:"POST",
      body:fd,
      signal:controller.signal
    });

    if(gen.statusRow && document.body.contains(gen.statusRow)){
      gen.statusRow.remove();
      gen.statusRow = null;
    }

    if(current === targetChatId && currentPrivate === targetIsPrivate){
      ensureStreamBoxForGen(gen,targetChatId,targetIsPrivate);
    }

    if(!res.body){
      throw new Error("No stream body");
    }

    const reader = res.body.getReader();
    const decoder = new TextDecoder("utf-8");
    let buffer = "";

    while(true){
      if(!generators[targetChatId] || gen.stopped){
        throw new DOMException("Stopped", "AbortError");
      }

      const {done,value} = await reader.read();
      if(done) break;

      buffer += decoder.decode(value,{stream:true});

      const parts = buffer.split("\n\n");
      buffer = parts.pop();

      for(const part of parts){
        if(!generators[targetChatId] || gen.stopped){
          throw new DOMException("Stopped", "AbortError");
        }

        const line = part.trim();
        if(!line.startsWith("data:")) continue;

        const jsonText = line.replace(/^data:\s*/,"");

        try{
          const data = JSON.parse(jsonText);
          updateLimitStateFromPayload(data);

          if(data.type === "token"){
            full += data.text || "";
            gen.full = full;

            if(current === targetChatId && currentPrivate === targetIsPrivate){
              ensureStreamBoxForGen(gen,targetChatId,targetIsPrivate);

              if(gen.streamBox){
                gen.streamBox.innerHTML = parseMarkdown(full) + `<span class="typing-dot">●</span>`;
                scrollBottom();
              }
            }

            await sleep(STREAM_TOKEN_DELAY);

            if(!generators[targetChatId] || gen.stopped){
              throw new DOMException("Stopped", "AbortError");
            }
          }

          if(data.type === "image"){
            gotImage = true;

            if(gen.streamBox && gen.streamBox.parentElement){
              gen.streamBox.parentElement.remove();
            }

            if(current === targetChatId && currentPrivate === targetIsPrivate){
              bubbleImage(data.url,true);
            }else{
              const c = getChatById(targetChatId,targetIsPrivate) || getAnyChatById(targetChatId);
              if(c){
                c.msg = c.msg || [];
                c.msg.push({type:"image", url:data.url});
              }
            }
          }

          if(data.type === "error"){
            if(data.code === "limit_chat"){
              limitState.chat = 0;
              saveLimitState();
              applyLimitUI();
              showLimitBubble("chat");

              if(gen.streamBox && gen.streamBox.parentElement){
                gen.streamBox.parentElement.remove();
              }

              full = "";
              gen.full = "";
              continue;
            }

            if(data.code === "limit_image"){
              limitState.image = 0;
              saveLimitState();
              applyLimitUI();
              showLimitBubble("image");

              if(gen.streamBox && gen.streamBox.parentElement){
                gen.streamBox.parentElement.remove();
              }

              full = "";
              gen.full = "";
              continue;
            }

            full += data.text || "Error.";
            gen.full = full;

            if(current === targetChatId && currentPrivate === targetIsPrivate){
              ensureStreamBoxForGen(gen,targetChatId,targetIsPrivate);

              if(gen.streamBox){
                gen.streamBox.innerHTML = parseMarkdown(full);
                scrollBottom();
              }
            }
          }

          if(data.type === "done"){
            if(!gotImage && gen.streamBox){
              gen.streamBox.innerHTML = parseMarkdown(full);
              applyHighlight();
            }
          }
        }catch(err){
          if(err.name === "AbortError") throw err;
        }
      }
    }

    if(!gotImage){
      if(gen.streamBox){
        gen.streamBox.innerHTML = parseMarkdown(full);
        applyHighlight();
      }

      saveBotMessageToLocal(targetChatId,full,targetIsPrivate);

      if(shouldUpdateTitle){
        updateChatTitleSmart(targetChatId,msg,full,null);
      }
    }

    await loadBackendMessages(targetChatId,targetIsPrivate);

  }catch(err){
    if(gen.statusRow && document.body.contains(gen.statusRow)){
      gen.statusRow.remove();
    }

    if(err.name === "AbortError"){
      const savedText = gen?.full || full;

      if(gen.streamBox){
        gen.streamBox.innerHTML = parseMarkdown(savedText);
        applyHighlight();
      }

      if(savedText.trim()){
        saveBotMessageToLocal(targetChatId,savedText,targetIsPrivate);
      }
    }else{
      const text = "Connection error.";

      if(current === targetChatId && currentPrivate === targetIsPrivate){
        bubble(text,"bot",true,false);
      }else{
        saveBotMessageToLocal(targetChatId,text,targetIsPrivate);
      }
    }
  }finally{
    if(generators[targetChatId] === gen){
      delete generators[targetChatId];
    }

    if(activeController === controller){
      activeController = null;
    }

    refreshSendButton();
    scrollBottom();
  }
}

// =========================
// NORMAL FILE SEND
// =========================
async function sendNormalWithFile(msg,fileToSend,chatIdForTitle,targetPrivate=currentPrivate){
  const controller = new AbortController();

  const targetChatId = chatIdForTitle;
  const targetIsPrivate = !!targetPrivate;
  const modeAtStart = aiMode;

  generators[targetChatId] = {
    controller,
    stopped:false,
    private:targetIsPrivate,
    full:"",
    streamBox:null,
    statusRow:null,
    label:labelFromAction("chat",msg,fileToSend),
    mode:modeAtStart
  };

  activeController = controller;
  refreshSendButton();

  const gen = generators[targetChatId];

  if(current === targetChatId && currentPrivate === targetIsPrivate){
    gen.statusRow = createStatusBubble(gen.label);
  }

  const fd = new FormData();
  fd.append("message",msg);
  fd.append("chat_id",targetChatId);
  fd.append("mode",modeAtStart);
  appendIdentity(fd);
  fd.append("file",fileToSend);

  clearSelectedFile();

  try{
    const res = await fetch("/chat",{
      method:"POST",
      body:fd,
      signal:controller.signal
    });

    const data = await res.json();
    updateLimitStateFromPayload(data);

    if(gen.statusRow && document.body.contains(gen.statusRow)){
      gen.statusRow.remove();
    }

    if(data.type === "limit_chat"){
      limitState.chat = 0;
      saveLimitState();
      applyLimitUI();
      showLimitBubble("chat");
      return;
    }

    if(data.type === "limit_file"){
      limitState.file = 0;
      saveLimitState();
      applyLimitUI();
      showLimitBubble("file");
      return;
    }

    if(data.type === "limit_image"){
      limitState.image = 0;
      saveLimitState();
      applyLimitUI();
      showLimitBubble("image");
      return;
    }

    if(data.type === "image"){
      if(current === targetChatId && currentPrivate === targetIsPrivate){
        bubbleImage(data.url,true);
      }else{
        const c = getChatById(targetChatId,targetIsPrivate) || getAnyChatById(targetChatId);
        if(c){
          c.msg = c.msg || [];
          c.msg.push({type:"image", url:data.url});
        }
      }

      updateChatTitleSmart(targetChatId,msg,"Image generated",fileToSend);
      await loadBackendMessages(targetChatId,targetIsPrivate);
      return;
    }

    const reply = cleanBackendStatus(cleanHtmlStyleLeaks(data.reply || "No response."));

    if(current === targetChatId && currentPrivate === targetIsPrivate){
      bubble(reply,"bot",true,modeAtStart === "thinking");
    }else{
      saveBotMessageToLocal(targetChatId,reply,targetIsPrivate);
    }

    updateChatTitleSmart(targetChatId,msg,reply,fileToSend);
    await loadBackendMessages(targetChatId,targetIsPrivate);

  }catch(err){
    if(gen.statusRow && document.body.contains(gen.statusRow)){
      gen.statusRow.remove();
    }

    if(err.name !== "AbortError"){
      const text = "Connection error.";

      if(current === targetChatId && currentPrivate === targetIsPrivate){
        bubble(text,"bot",true,false);
      }else{
        saveBotMessageToLocal(targetChatId,text,targetIsPrivate);
      }
    }
  }finally{
    if(generators[targetChatId] === gen){
      delete generators[targetChatId];
    }

    if(activeController === controller){
      activeController = null;
    }

    refreshSendButton();
    scrollBottom();
  }
}

// =========================
// SEND HANDLER
// =========================
form.addEventListener("submit", async(e)=>{
  e.preventDefault();

  if(chatIsGenerating(current)){
    stopGenerating();
    return;
  }

  if(isChatLimitReached()){
    applyLimitUI();
    showLimitBubble("chat");
    return;
  }

  const msg = input.value.trim();
  const fileToSend = selectedFile;

  if(fileToSend && isFileLimitReached()){
    applyLimitUI();
    showLimitBubble("file");
    return;
  }

  const metaToRender = fileToSend && selectedFileMeta
    ? JSON.parse(JSON.stringify(selectedFileMeta))
    : null;

  if(!msg && !fileToSend) return;

  if(editingIndex !== null){
    const c = currentChat();

    if(!c || !c.msg[editingIndex] || c.msg[editingIndex].role !== "user"){
      editingIndex = null;
      input.classList.remove("editing-message");
      return;
    }

    const editedFirst = editingIndex === 0;
    const chatIdForTitle = current;
    const targetPrivate = currentPrivate;

    c.msg[editingIndex].text = msg;
    c.msg = c.msg.slice(0, editingIndex + 1);

    await updateBackendUserMessage(current,editingIndex,msg);
    await truncateBackendChat(current,editingIndex);

    if(editedFirst){
      c.title = makeSmartTitle(msg,null);
      c.autoTitleDone = false;
      await renameBackendChat(current,c.title);
    }

    renderChat();

    editingIndex = null;
    input.classList.remove("editing-message");
    input.value = "";

    await sendStreamingMessage(msg,chatIdForTitle,editedFirst,targetPrivate,false);
    return;
  }

  if(!currentChat()){
    const created = await createChatFromFirstMessage(msg,fileToSend);
    if(!created) return;
  }

  const chatIdForTitle = current;
  const targetPrivate = currentPrivate;

  const welcome = chatBox.querySelector(".welcome");
  if(welcome) welcome.remove();

  const c = currentChat();
  if(c){
    c.msg = c.msg || [];
  }

  if(metaToRender){
    if(c) c.msg.push({type:"attachment", meta:metaToRender});
    renderChatAttachment(metaToRender,false);
  }

  if(msg){
    if(c) c.msg.push({role:"user", text:msg, type:"text"});
    bubble(msg,"user",false,false,(c?.msg?.length || 1) - 1);
  }else if(fileToSend){
    const fileText = `📎 ${fileToSend.name}`;
    if(c) c.msg.push({role:"user", text:fileText, type:"text"});
    bubble(fileText,"user",false,false,(c?.msg?.length || 1) - 1);
  }

  input.value = "";

  if(fileToSend){
    await sendNormalWithFile(msg,fileToSend,chatIdForTitle,targetPrivate);
  }else{
    await sendStreamingMessage(msg,chatIdForTitle,true,targetPrivate,true);
  }
});

// =========================
// FILE INPUT + PASTE IMAGE
// =========================
fileInput.addEventListener("change",()=>{
  if(isFileLimitReached()){
    clearSelectedFile();
    showLimitBubble("file");
    applyLimitUI();
    return;
  }

  const f = fileInput.files[0];
  if(!f) return;
  setSelectedFile(f);
});

function handlePasteImage(e){
  if(chatIsGenerating(current)) return;

  if(isFileLimitReached()){
    showLimitBubble("file");
    e.preventDefault();
    return;
  }

  const items = e.clipboardData?.items;
  if(!items) return;

  for(const item of items){
    if(item.kind === "file" && item.type.startsWith("image/")){
      const file = item.getAsFile();

      if(file){
        const ext = item.type.split("/")[1] || "png";

        const namedFile = new File(
          [file],
          `pasted-image-${Date.now()}.${ext}`,
          {type:item.type}
        );

        setSelectedFile(namedFile);
        e.preventDefault();
        return;
      }
    }
  }
}

document.addEventListener("paste",handlePasteImage);
input.addEventListener("paste",handlePasteImage);

// =========================
// ENTER SEND BLOCKER
// =========================
input.addEventListener("keydown",(e)=>{
  if(chatIsGenerating(current) && e.key === "Enter"){
    e.preventDefault();
    e.stopPropagation();
    return false;
  }

  if(isChatLimitReached() && e.key === "Enter"){
    e.preventDefault();
    e.stopPropagation();
    applyLimitUI();
    showLimitBubble("chat");
    return false;
  }

  if(e.key === "Escape" && editingIndex !== null){
    editingIndex = null;
    input.value = "";
    input.classList.remove("editing-message");
    return;
  }

  if(e.key === "Enter" && !e.shiftKey){
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

async function saveRename(){
  const val = renameInput.value.trim();
  if(!val || !renameTarget) return;

  const arr = renameTarget.isPrivate ? privateChats : chats;
  const c = arr.find(x => x.id === renameTarget.id);

  if(c) c.title = val;

  await renameBackendChat(renameTarget.id,val);

  renderSidebarList();
  closeRename();
}

function askDelete(id,isPrivate=false){
  deleteTarget = {id,isPrivate};
  deleteModal.classList.remove("hidden");
}

function closeDelete(){
  deleteModal.classList.add("hidden");
}

async function confirmDelete(){
  if(!deleteTarget) return;

  await deleteBackendChatMemory(deleteTarget.id);

  if(deleteTarget.isPrivate){
    privateChats = privateChats.filter(x => x.id !== deleteTarget.id);

    if(currentPrivate && current === deleteTarget.id){
      current = "";
      currentPrivate = false;
      saveCurrent();
    }

    closeDelete();

    if(showingPrivate){
      await loadBackendChats(true);
      renderPrivateHistory();
    }else{
      await loadBackendChats(false);
      renderHistory();
    }

    renderChat();
    refreshSendButton();
    return;
  }

  chats = chats.filter(x => x.id !== deleteTarget.id);

  if(!currentPrivate && current === deleteTarget.id){
    current = "";
    saveCurrent();
  }

  closeDelete();
  await loadBackendChats(false);
  renderHistory();
  renderChat();
  refreshSendButton();
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
  pinInput.value = "";
  pinMode = "";
}

async function submitPin(){
  const val = pinInput.value.trim();
  if(!val) return;

  if(pinMode === "create" || pinMode === "createOpen"){
    savedPin = val;
    localStorage.setItem("neuromv_pin",savedPin);

    if(pinMode === "create") await doPrivate();
    if(pinMode === "createOpen") await showPrivate();

    closePin();
    return;
  }

  if(val !== savedPin){
    alert("Wrong PIN");
    return;
  }

  if(pinMode === "verify") await doPrivate();
  if(pinMode === "open") await showPrivate();
  if(pinMode === "unprivate") await doUnprivate();

  closePin();
}

async function doPrivate(){
  const id = pendingPrivateId;
  if(!id) return;

  await setBackendPrivate(id,true);

  chats = chats.filter(x => x.id !== id);

  if(!currentPrivate && current === id){
    current = "";
    saveCurrent();
  }

  currentPrivate = false;
  showingPrivate = false;

  await loadBackendChats(false);
  renderHistory();
  renderChat();
  refreshSendButton();
}

async function doUnprivate(){
  const id = pendingPrivateId;
  if(!id) return;

  await setBackendPrivate(id,false);

  privateChats = privateChats.filter(x => x.id !== id);

  currentPrivate = false;
  showingPrivate = false;

  await loadBackendChats(false);
  current = chats[0]?.id || "";
  saveCurrent();

  if(current){
    await loadBackendMessages(current,false);
  }

  renderHistory();
  renderChat();
  refreshSendButton();
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
    !e.target.closest(".dots-btn") &&
    !e.target.closest("#modeToggle")
  ){
    closeMenus();
  }
});

// =========================
// NEUROMV SAFE HEADING JUMBO PATCH
// Append-only patch, does not remove old markdown/link system
// =========================
(function(){
  function escapeMini(t){
    return String(t ?? "")
      .replace(/&/g,"&amp;")
      .replace(/</g,"&lt;")
      .replace(/>/g,"&gt;")
      .replace(/"/g,"&quot;");
  }

  function applyHeadingHtml(html){
    const root = document.createElement("div");
    root.innerHTML = String(html || "");

    const skipTags = new Set([
      "PRE",
      "CODE",
      "SCRIPT",
      "STYLE",
      "TEXTAREA",
      "BUTTON"
    ]);

    function walk(node){
      Array.from(node.childNodes).forEach(child=>{
        if(child.nodeType === 1){
          if(skipTags.has(child.tagName)) return;
          walk(child);
          return;
        }

        if(child.nodeType !== 3) return;

        const raw = child.nodeValue || "";
        const trimmed = raw.trim();

        const m = trimmed.match(/^(#{1,3})\s+(.+)$/);
        if(!m) return;

        const parent = child.parentElement;
        if(!parent) return;
        if(/^H[1-6]$/.test(parent.tagName)) return;

        const level = Math.min(3, m[1].length);
        const h = document.createElement("h" + level);
        h.className = "neuromv-heading";
        h.textContent = m[2];

        child.parentNode.replaceChild(h, child);
      });
    }

    walk(root);

    // Remove extra <br> right after headings
    return root.innerHTML.replace(
      /(<h[123][^>]*>[\s\S]*?<\/h[123]>)\s*<br\s*\/?>/gi,
      "$1"
    );
  }

  function fallbackMarkdown(text){
    return applyHeadingHtml(
      escapeMini(text).replace(/\n/g,"<br>")
    );
  }

  function wrapMarkdownFunction(name){
    const old = window[name];

    if(typeof old === "function" && !old.__neuromvHeadingWrapped){
      const wrapped = function(text, ...rest){
        const html = old.call(this, text, ...rest);
        return applyHeadingHtml(html);
      };

      wrapped.__neuromvHeadingWrapped = true;
      window[name] = wrapped;
      return;
    }

    if(typeof old !== "function"){
      window[name] = fallbackMarkdown;
    }
  }

  wrapMarkdownFunction("formatBotText");
  wrapMarkdownFunction("parseMarkdown");
  wrapMarkdownFunction("markdownToHtml");
  wrapMarkdownFunction("renderMarkdown");
})();

// =========================
// START
// =========================
async function startNeuroMV(){
  initModeToggle();
  await ensureInitialState();

  if(currentPrivate){
    renderPrivateHistory();
  }else{
    renderHistory();
  }

  renderChat();
  renderInputPreview();
  refreshSendButton();
  fetchLimits();
}

startNeuroMV();
