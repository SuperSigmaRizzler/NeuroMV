// =========================
// NEUROMV ULTRA FINAL SCRIPT.JS
// STREAMING + STOP + MODE SWITCH + PRIVATE FIX
// CHAT ATTACHMENT PREVIEW + PASTE IMAGE + SMART TITLE + CLICKABLE LINKS
// =========================

// =========================
// STORAGE
// =========================
let chats = JSON.parse(localStorage.getItem("neuromv_chats") || "[]");
let privateChats = JSON.parse(localStorage.getItem("neuromv_private") || "[]");
let current = localStorage.getItem("neuromv_current") || "";

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

let showingPrivate = false;
let currentPrivate = false;

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

let sendBtnOriginalHTML = sendBtn ? sendBtn.innerHTML : "Send";
let sendBtnOriginalTitle = sendBtn ? (sendBtn.title || "Send") : "Send";

// =========================
// HELPERS
// =========================
function uid(){
  return "c" + Date.now() + Math.floor(Math.random() * 99999);
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

function saveData(){
  localStorage.setItem("neuromv_chats", JSON.stringify(chats));
  localStorage.setItem("neuromv_private", JSON.stringify(privateChats));
  localStorage.setItem("neuromv_current", current || "");
}

function currentChat(){
  if(currentPrivate){
    return privateChats.find(x => x.id === current);
  }

  return chats.find(x => x.id === current);
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

function cleanupEmptyChats(){
  chats = chats.filter(c => Array.isArray(c.msg) && c.msg.length > 0);
  privateChats = privateChats.filter(c => Array.isArray(c.msg) && c.msg.length > 0);
}

function removeEmojis(text){
  return String(text || "").replace(/[\u{1F300}-\u{1FAFF}\u{2600}-\u{27BF}]/gu,"");
}

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
  const c = chats.find(x => x.id === chatId);
  if(!c) return;

  if(c.autoTitleDone){
    return;
  }

  const userCount = (c.msg || []).filter(m => m.role === "user").length;

  if(userCount > 1){
    c.autoTitleDone = true;
    saveData();
    return;
  }

  c.title = makeSmartTitle(msg || file?.name || "",file);
  c.autoTitleDone = true;

  saveData();
  renderHistory();

  try{
    const fd = new FormData();
    fd.append("message", msg || "");
    fd.append("reply", reply || "");
    fd.append("file", file?.name || "");

    const res = await fetch("/title",{
      method:"POST",
      body:fd
    });

    if(!res.ok) return;

    const data = await res.json();
    const title = String(data.title || "").trim();

    if(title && chats.some(x => x.id === chatId)){
      c.title = title.slice(0,42);
      c.autoTitleDone = true;
      saveData();
      renderHistory();
    }
  }catch{}
}

function createChatFromFirstMessage(msg,file){
  const c = {
    id: uid(),
    title: makeSmartTitle(msg,file),
    msg: [],
    autoTitleDone: false
  };

  chats.unshift(c);
  current = c.id;
  currentPrivate = false;
  showingPrivate = false;

  saveData();
  renderHistory();

  return c;
}

// =========================
// GENERATING / STOP BUTTON
// =========================
function setGeneratingState(on){
  isGenerating = on;

  if(!sendBtn) return;

  if(on){
    sendBtn.classList.add("stop-mode");
    sendBtn.innerHTML = "■";
    sendBtn.title = "Stop generating";
  }else{
    sendBtn.classList.remove("stop-mode");
    sendBtn.innerHTML = sendBtnOriginalHTML;
    sendBtn.title = sendBtnOriginalTitle;
  }
}

function stopGenerating(){
  if(activeController){
    activeController.abort();
    activeController = null;
  }

  setGeneratingState(false);
}

// =========================
// STATUS CLEANER
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

// =========================
// CLICKABLE LINK ENGINE
// =========================
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

      if(isValidHttpUrl(realUrl)){
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

// =========================
// MATH / MARKDOWN
// =========================
function protectMathBlocks(text){
  const math = [];

  text = String(text || "").replace(/\$\$([\s\S]*?)\$\$/g,(_,body)=>{
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
          <button class="copy-btn" onclick="copyCode('${id}',this)">Copy</button>
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

  navigator.clipboard.writeText(code).then(()=>{
    btn.innerText = "Copied";
    btn.classList.add("copied");

    setTimeout(()=>{
      btn.innerText = "Copy";
      btn.classList.remove("copied");
    },1200);
  }).catch(()=>{
    btn.innerText = "Failed";
    setTimeout(()=>btn.innerText = "Copy",1200);
  });
}

// =========================
// MODE TOGGLE
// =========================
function initModeToggle(){
  if(document.getElementById("modeToggle")) return;

  const wrap = document.createElement("div");
  wrap.id = "modeToggle";
  wrap.className = "mode-toggle mode-toggle-top";

  wrap.style.width = "100%";
  wrap.style.justifyContent = "flex-end";
  wrap.style.boxSizing = "border-box";

  wrap.innerHTML = `
    <button type="button" data-mode="instant">⚡ Instant</button>
    <button type="button" data-mode="thinking">🧠 Deep Thinking</button>
  `;

  const target =
    document.querySelector(".chat-head") ||
    document.querySelector(".topbar") ||
    document.querySelector(".main") ||
    form?.parentElement;

  if(target){
    target.insertBefore(wrap, target.firstChild);
  }

  updateModeUI();

  wrap.querySelectorAll("button").forEach(btn=>{
    btn.onclick = ()=>{
      if(isGenerating) return;

      aiMode = btn.dataset.mode;
      localStorage.setItem("neuromv_mode", aiMode);
      updateModeUI();
    };
  });
}

function updateModeUI(){
  document.querySelectorAll("#modeToggle button").forEach(btn=>{
    btn.classList.toggle("active", btn.dataset.mode === aiMode);
  });
}

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
      <span class="thinking-dots">
        <i></i><i></i><i></i>
      </span>
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
// ROUTER PRECHECK
// =========================
async function getRouteAction(msg,signal){
  try{
    const fd = new FormData();
    fd.append("message",msg);
    fd.append("chat_id",current || "default");
    fd.append("mode",aiMode);

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

function renderChatAttachment(meta,save=true){
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

  if(save){
    const c = currentChat();
    if(c){
      c.msg.push({
        type:"attachment",
        meta
      });
      saveData();
    }
  }

  scrollBottom();
}

// =========================
// INIT CHAT
// =========================
function ensureInitialState(){
  cleanupEmptyChats();

  if(current && !chats.some(c => c.id === current)){
    current = "";
  }

  currentPrivate = false;
  showingPrivate = false;

  saveData();
}

function newChat(){
  current = "";
  currentPrivate = false;
  showingPrivate = false;

  saveData();
  renderHistory();
  renderChat();
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
        <div class="history-title">${esc(c.title)}</div>
        <button class="icon-btn" type="button">⋮</button>
      </div>
    `;

    div.onclick = ()=>{
      current = c.id;
      currentPrivate = false;
      showingPrivate = false;
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

function renderPrivateHistory(){
  showingPrivate = true;
  historyBox.innerHTML = "";

  const back = document.createElement("button");
  back.className = "new-chat-btn private-back-btn";
  back.type = "button";
  back.innerHTML = "← Back to Chats";

  back.onclick = ()=>{
    showingPrivate = false;
    currentPrivate = false;
    current = chats[0]?.id || "";
    saveData();
    renderHistory();
    renderChat();
  };

  historyBox.appendChild(back);

  if(privateChats.length === 0){
    const empty = document.createElement("div");
    empty.className = "history-item";
    empty.innerHTML = `
      <div class="history-title">No private chats</div>
    `;
    historyBox.appendChild(empty);
    return;
  }

  privateChats.forEach(c=>{
    const div = document.createElement("div");
    div.className = "history-item";

    if(currentPrivate && c.id === current) div.classList.add("active");

    div.innerHTML = `
      <div class="history-top">
        <div class="history-title">🔒 ${esc(c.title)}</div>
        <button class="icon-btn" type="button">⋮</button>
      </div>
    `;

    div.onclick = ()=>{
      current = c.id;
      currentPrivate = true;
      showingPrivate = true;
      saveData();
      renderPrivateHistory();
      renderChat();
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
  if(!btn || !current) return;

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
// CHAT VIEW
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
        <p>Start a new conversation</p>
      </div>
    `;
    return;
  }

  c.msg.forEach(m=>{
    if(m.type === "image"){
      bubbleImage(m.url,false);
    }else if(m.type === "attachment"){
      renderChatAttachment(m.meta,false);
    }else{
      bubble(m.text,m.role,false,false);
    }
  });

  applyHighlight();
  scrollBottom();
}

// =========================
// BUBBLES
// =========================
function bubble(text,role="bot",save=true,typing=false){
  const row = document.createElement("div");
  row.className = role === "user" ? "user-row" : "bot-row";

  const box = document.createElement("div");
  box.className = role === "user" ? "user-bubble" : "bot-bubble";

  row.appendChild(box);
  chatBox.appendChild(row);

  const cleanText = role === "bot" ? cleanBackendStatus(text) : String(text || "");

  if(typing && role === "bot"){
    let i = 0;
    const speed = aiMode === "instant" ? 1 : 7;

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
      c.msg.push({
        role,
        text: cleanText,
        type: "text"
      });

      if(c.msg.length === 1 && role === "user"){
        c.title = makeSmartTitle(cleanText,null);
      }

      saveData();
      renderSidebarList();
    }
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
      c.msg.push({
        type: "image",
        url
      });

      saveData();
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

function saveBotMessage(text){
  const clean = cleanBackendStatus(text || "");

  if(!clean.trim()) return;

  const c = currentChat();

  if(c){
    c.msg.push({
      role:"bot",
      text:clean,
      type:"text"
    });

    saveData();
    renderSidebarList();
  }
}

// =========================
// STREAMING TEXT SEND
// =========================
async function sendStreamingMessage(msg,chatIdForTitle){
  activeController = new AbortController();
  setGeneratingState(true);

  let load = null;
  let streamBox = null;
  let full = "";
  let gotImage = false;

  try{
    load = createStatusBubble(aiMode === "thinking" ? "Deep Thinking" : "Instant");

    const action = await getRouteAction(msg,activeController.signal);
    updateStatusBubble(load,labelFromAction(action,msg,null));

    const fd = new FormData();
    fd.append("message",msg);
    fd.append("chat_id",current);
    fd.append("mode",aiMode);

    const res = await fetch("/chat_stream",{
      method:"POST",
      body:fd,
      signal:activeController.signal
    });

    load.remove();
    load = null;

    const bot = createBotStreamingBubble();
    streamBox = bot.box;

    const reader = res.body.getReader();
    const decoder = new TextDecoder("utf-8");

    let buffer = "";

    while(true){
      const {done,value} = await reader.read();
      if(done) break;

      buffer += decoder.decode(value,{stream:true});

      const parts = buffer.split("\n\n");
      buffer = parts.pop();

      for(const part of parts){
        const line = part.trim();
        if(!line.startsWith("data:")) continue;

        const jsonText = line.replace(/^data:\s*/,"");

        try{
          const data = JSON.parse(jsonText);

          if(data.type === "token"){
            full += data.text || "";
            streamBox.innerHTML = parseMarkdown(full) + `<span class="typing-dot">●</span>`;
            scrollBottom();
          }

          if(data.type === "image"){
            gotImage = true;
            streamBox.parentElement.remove();
            bubbleImage(data.url,true);
          }

          if(data.type === "error"){
            full += data.text || "Error.";
            streamBox.innerHTML = parseMarkdown(full);
            scrollBottom();
          }

          if(data.type === "done"){
            if(!gotImage){
              streamBox.innerHTML = parseMarkdown(full);
              applyHighlight();
            }
          }
        }catch{}
      }
    }

    if(!gotImage){
      streamBox.innerHTML = parseMarkdown(full);
      applyHighlight();
      saveBotMessage(full);
      updateChatTitleSmart(chatIdForTitle,msg,full,null);
    }

  }catch(err){
    if(load) load.remove();

    if(err.name === "AbortError"){
      if(streamBox){
        full += "\n\n_Generation stopped._";
        streamBox.innerHTML = parseMarkdown(full);
        applyHighlight();
        saveBotMessage(full);
      }else{
        bubble("_Generation stopped._","bot",true,false);
      }
    }else{
      bubble("Connection error.","bot",true,false);
    }

  }finally{
    activeController = null;
    setGeneratingState(false);
    scrollBottom();
  }
}

// =========================
// NORMAL FILE SEND
// =========================
async function sendNormalWithFile(msg,fileToSend,chatIdForTitle){
  activeController = new AbortController();
  setGeneratingState(true);

  const label = labelFromAction("chat",msg,fileToSend);
  const load = createStatusBubble(label);

  const fd = new FormData();
  fd.append("message",msg);
  fd.append("chat_id",current);
  fd.append("mode",aiMode);
  fd.append("file",fileToSend);

  clearSelectedFile();

  try{
    const res = await fetch("/chat",{
      method:"POST",
      body:fd,
      signal:activeController.signal
    });

    const data = await res.json();

    load.remove();

    if(data.type === "image"){
      bubbleImage(data.url,true);
      updateChatTitleSmart(chatIdForTitle,msg,"Image generated",fileToSend);
      return;
    }

    const reply = cleanBackendStatus(data.reply || "No response.");
    bubble(reply,"bot",true,aiMode === "thinking");
    updateChatTitleSmart(chatIdForTitle,msg,reply,fileToSend);

  }catch(err){
    load.remove();

    if(err.name === "AbortError"){
      bubble("_Generation stopped._","bot",true,false);
    }else{
      bubble("Connection error.","bot",true,false);
    }

  }finally{
    activeController = null;
    setGeneratingState(false);
    scrollBottom();
  }
}

// =========================
// SEND HANDLER
// =========================
form.addEventListener("submit", async(e)=>{
  e.preventDefault();

  if(isGenerating){
    stopGenerating();
    return;
  }

  const msg = input.value.trim();
  const fileToSend = selectedFile;
  const metaToRender = fileToSend && selectedFileMeta
    ? JSON.parse(JSON.stringify(selectedFileMeta))
    : null;

  if(!msg && !fileToSend) return;

  if(!currentChat()){
    createChatFromFirstMessage(msg,fileToSend);
  }

  const chatIdForTitle = current;

  const welcome = chatBox.querySelector(".welcome");
  if(welcome) welcome.remove();

  if(metaToRender){
    renderChatAttachment(metaToRender,true);
  }

  if(msg){
    bubble(msg,"user",true,false);
  }else if(fileToSend){
    bubble(`📎 ${fileToSend.name}`,"user",true,false);
  }

  input.value = "";

  if(fileToSend){
    await sendNormalWithFile(msg,fileToSend,chatIdForTitle);
  }else{
    await sendStreamingMessage(msg,chatIdForTitle);
  }
});

// =========================
// FILE INPUT + PASTE IMAGE
// =========================
fileInput.addEventListener("change",()=>{
  const f = fileInput.files[0];
  if(!f) return;
  setSelectedFile(f);
});

function handlePasteImage(e){
  if(isGenerating) return;

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
  if(isGenerating && e.key === "Enter"){
    e.preventDefault();
    e.stopPropagation();
    return false;
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

function saveRename(){
  const val = renameInput.value.trim();
  if(!val || !renameTarget) return;

  const arr = renameTarget.isPrivate ? privateChats : chats;
  const c = arr.find(x => x.id === renameTarget.id);

  if(c) c.title = val;

  saveData();
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

function confirmDelete(){
  if(!deleteTarget) return;

  if(deleteTarget.isPrivate){
    privateChats = privateChats.filter(x => x.id !== deleteTarget.id);

    if(currentPrivate && current === deleteTarget.id){
      current = "";
      currentPrivate = false;
    }

    saveData();
    closeDelete();

    if(showingPrivate){
      renderPrivateHistory();
    }else{
      renderHistory();
    }

    renderChat();
    return;
  }

  chats = chats.filter(x => x.id !== deleteTarget.id);

  if(!currentPrivate && current === deleteTarget.id){
    current = "";
  }

  saveData();
  closeDelete();
  renderHistory();
  renderChat();
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

function submitPin(){
  const val = pinInput.value.trim();
  if(!val) return;

  if(pinMode === "create" || pinMode === "createOpen"){
    savedPin = val;
    localStorage.setItem("neuromv_pin",savedPin);

    if(pinMode === "create") doPrivate();
    if(pinMode === "createOpen") showPrivate();

    closePin();
    return;
  }

  if(val !== savedPin){
    alert("Wrong PIN");
    return;
  }

  if(pinMode === "verify") doPrivate();
  if(pinMode === "open") showPrivate();
  if(pinMode === "unprivate") doUnprivate();

  closePin();
}

function doPrivate(){
  const i = chats.findIndex(x => x.id === pendingPrivateId);
  if(i === -1) return;

  privateChats.unshift(chats[i]);
  chats.splice(i,1);

  if(!currentPrivate && current === pendingPrivateId){
    current = "";
  }

  currentPrivate = false;
  showingPrivate = false;

  saveData();
  renderHistory();
  renderChat();
}

function doUnprivate(){
  const i = privateChats.findIndex(x => x.id === pendingPrivateId);
  if(i === -1) return;

  chats.unshift(privateChats[i]);
  privateChats.splice(i,1);

  current = chats[0].id;
  currentPrivate = false;
  showingPrivate = false;

  saveData();
  renderHistory();
  renderChat();
}

function showPrivate(){
  showingPrivate = true;
  renderPrivateHistory();
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
initModeToggle();
ensureInitialState();
renderHistory();
renderChat();
renderInputPreview();
