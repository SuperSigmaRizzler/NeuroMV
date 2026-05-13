// =========================
// NEUROMV ULTRA FINAL SCRIPT.JS
// STREAMING + STOP + MODE SWITCH + PRIVATE + MARKDOWN + PREVIEW + CLICKABLE LINKS
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

let aiMode = localStorage.getItem("neuromv_mode") || "thinking";

let activeController = null;
let isGenerating = false;

let persistentPreview = null;
try{
  persistentPreview = JSON.parse(sessionStorage.getItem("neuromv_file_preview") || "null");
}catch{
  persistentPreview = null;
}

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
  return chats.find(x => x.id === current);
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
// BACKEND STATUS CLEANER
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
// MARKDOWN PREMIUM
// =========================
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

  html = restoreSafeBackendHtml(html);
  html = linkifyHtml(html);

  return html;
}

function applyHighlight(){
  if(window.hljs){
    document.querySelectorAll("pre code").forEach(el=>{
      try{
        hljs.highlightElement(el);
      }catch{}
    });
  }
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
// PREMIUM STATUS LOADER
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
// PERSISTENT FILE PREVIEW
// =========================
function savePersistentPreview(meta){
  persistentPreview = meta;
  sessionStorage.setItem("neuromv_file_preview", JSON.stringify(meta));
  renderPersistentPreview();
}

function clearPersistentPreview(){
  persistentPreview = null;
  selectedFile = null;

  if(fileInput) fileInput.value = "";
  sessionStorage.removeItem("neuromv_file_preview");

  if(preview) preview.innerHTML = "";
}

function renderPersistentPreview(){
  if(!preview){
    return;
  }

  if(!persistentPreview){
    preview.innerHTML = "";
    return;
  }

  const isImg = persistentPreview.type && persistentPreview.type.startsWith("image/");
  const note = selectedFile ? "" : `<small class="preview-note">Preview only — choose file again to resend</small>`;

  if(isImg && persistentPreview.dataUrl){
    preview.innerHTML = `
      <div class="preview-card image-preview-card">
        <img src="${persistentPreview.dataUrl}" class="preview-img">
        <div class="preview-info">
          <span>🖼️ ${esc(persistentPreview.name)}</span>
          <small>${formatSize(persistentPreview.size)}</small>
          ${note}
        </div>
        <button type="button" class="preview-x" onclick="clearPersistentPreview()">×</button>
      </div>
    `;
  }else{
    preview.innerHTML = `
      <div class="preview-card">
        <div class="preview-info">
          <span>📎 ${esc(persistentPreview.name)}</span>
          <small>${formatSize(persistentPreview.size)}</small>
          ${note}
        </div>
        <button type="button" class="preview-x" onclick="clearPersistentPreview()">×</button>
      </div>
    `;
  }
}

// =========================
// INIT CHAT
// =========================
function ensureChat(){
  if(chats.length === 0){
    newChat();
  }else if(!current){
    current = chats[0].id;
  }
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

// =========================
// HISTORY
// =========================
function renderHistory(){
  historyBox.innerHTML = "";

  chats.forEach(c=>{
    const div = document.createElement("div");
    div.className = "history-item";

    if(c.id === current) div.classList.add("active");

    div.innerHTML = `
      <div class="history-top">
        <div class="history-title">${esc(c.title)}</div>
        <button class="icon-btn" type="button">⋮</button>
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
    <button type="button" onclick="openRename('${id}',false)">✏ Rename</button>
    <button type="button" onclick="movePrivate('${id}')">🔒 Private</button>
    <button type="button" onclick="askDelete('${id}',false)">🗑 Delete</button>
  `;

  btn.parentElement.appendChild(menu);
}

function openPrivateMenu(id,btn){
  closeMenus();

  const menu = document.createElement("div");
  menu.className = "mini-menu";

  menu.innerHTML = `
    <button type="button" onclick="openRename('${id}',true)">✏ Rename</button>
    <button type="button" onclick="prepareUnprivate('${id}')">🔓 Unprivate</button>
    <button type="button" onclick="askDelete('${id}',true)">🗑 Delete</button>
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

  menu.innerHTML = `
    <button type="button" onclick="openRename('${current}',false)">✏ Rename</button>
    <button type="button" onclick="movePrivate('${current}')">🔒 Private</button>
    <button type="button" onclick="askDelete('${current}',false)">🗑 Delete</button>
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
      bubbleImage(m.url,false);
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
        box.innerHTML = parseMarkdown(cleanText.slice(0,i)) + `<span class="typing-cursor"></span>`;
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
        c.title = cleanText.slice(0,30);
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
    renderHistory();
  }
}

// =========================
// STREAMING TEXT SEND
// =========================
async function sendStreamingMessage(msg){
  activeController = new AbortController();
  setGeneratingState(true);

  let action = "chat";
  const load = createStatusBubble(aiMode === "thinking" ? "Deep Thinking" : "Instant");

  try{
    action = await getRouteAction(msg,activeController.signal);
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

    const {box} = createBotStreamingBubble();

    const reader = res.body.getReader();
    const decoder = new TextDecoder("utf-8");

    let buffer = "";
    let full = "";
    let gotImage = false;

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
            box.innerHTML = parseMarkdown(full) + `<span class="typing-cursor"></span>`;
            scrollBottom();
          }

          if(data.type === "image"){
            gotImage = true;
            box.parentElement.remove();
            bubbleImage(data.url,true);
          }

          if(data.type === "error"){
            full += data.text || "Error.";
            box.innerHTML = parseMarkdown(full);
            scrollBottom();
          }

          if(data.type === "done"){
            if(!gotImage){
              box.innerHTML = parseMarkdown(full);
              applyHighlight();
            }
          }

        }catch{}
      }
    }

    if(!gotImage){
      box.innerHTML = parseMarkdown(full);
      applyHighlight();
      saveBotMessage(full);
    }

  }catch(err){
    load.remove();

    if(err.name === "AbortError"){
      const stopped = "_Generation stopped._";
      bubble(stopped,"bot",true,false);
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
async function sendNormalWithFile(msg,fileToSend){
  activeController = new AbortController();
  setGeneratingState(true);

  const label = labelFromAction("chat",msg,fileToSend);
  const load = createStatusBubble(label);

  const fd = new FormData();
  fd.append("message",msg);
  fd.append("chat_id",current);
  fd.append("mode",aiMode);
  fd.append("file",fileToSend);

  selectedFile = null;
  fileInput.value = "";
  renderPersistentPreview();

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
      return;
    }

    const reply = cleanBackendStatus(data.reply || "No response.");
    bubble(reply,"bot",true,aiMode === "thinking");

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

  if(!msg && !fileToSend) return;

  if(!current) newChat();

  const welcome = chatBox.querySelector(".welcome");
  if(welcome) welcome.remove();

  if(msg){
    bubble(msg,"user",true,false);
  }else if(fileToSend){
    bubble(`📎 ${fileToSend.name}`,"user",true,false);
  }

  input.value = "";

  if(fileToSend){
    await sendNormalWithFile(msg,fileToSend);
  }else{
    await sendStreamingMessage(msg);
  }
});

// =========================
// FILE PREVIEW
// =========================
function clearSelectedFile(){
  clearPersistentPreview();
}

fileInput.addEventListener("change",()=>{
  const f = fileInput.files[0];
  if(!f) return;

  selectedFile = f;

  const meta = {
    name: f.name,
    type: f.type || "file",
    size: f.size,
    time: Date.now(),
    dataUrl: ""
  };

  if(f.type && f.type.startsWith("image/")){
    const reader = new FileReader();

    reader.onload = ()=>{
      meta.dataUrl = reader.result;
      savePersistentPreview(meta);
    };

    reader.readAsDataURL(f);
  }else{
    savePersistentPreview(meta);
  }
});

// =========================
// ENTER SEND
// =========================
input.addEventListener("keydown",(e)=>{
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
  if(!deleteTarget) return;

  if(deleteTarget.isPrivate){
    privateChats = privateChats.filter(x => x.id !== deleteTarget.id);
  }else{
    chats = chats.filter(x => x.id !== deleteTarget.id);

    if(current === deleteTarget.id){
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

  current = chats[0]?.id || "";

  saveData();
  ensureChat();
  renderHistory();
  renderChat();
}

function doUnprivate(){
  const i = privateChats.findIndex(x => x.id === pendingPrivateId);
  if(i === -1) return;

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
        <button class="icon-btn" type="button">⋮</button>
      </div>
    `;

    div.onclick = ()=>{
      chats.unshift(c);
      privateChats = privateChats.filter(x => x.id !== c.id);
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
initModeToggle();
ensureChat();
renderHistory();
renderChat();
renderPersistentPreview();
