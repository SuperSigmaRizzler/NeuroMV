// ===== SAFE STORAGE =====
function loadChats(){
  try{
    const d = JSON.parse(localStorage.getItem("chats"));
    return Array.isArray(d) ? d : [];
  }catch{ return []; }
}
let chats = loadChats();
let current = null;

// ===== ELEMENTS =====
const chatBox = document.getElementById("chatBox");
const historyBox = document.getElementById("history");
const form = document.getElementById("form");
const input = document.getElementById("input");
const file = document.getElementById("file");
const preview = document.getElementById("preview");
const sendBtn = document.getElementById("send");
const newBtn = document.getElementById("newChat");

// ===== SAVE =====
function save(){ localStorage.setItem("chats", JSON.stringify(chats)); }

// ===== NEW CHAT =====
newBtn.onclick = ()=>{
  const id = "c"+Date.now();
  chats.unshift({id, title:"New Chat", messages:[]});
  current = id;
  save(); renderHistory(); renderChat();
};

// ===== HISTORY =====
function renderHistory(){
  historyBox.innerHTML="";
  chats.forEach(c=>{
    const d=document.createElement("div");
    d.className="history-item"+(c.id===current?" active":"");
    d.innerHTML=`<span>${c.title}</span><button class="del">✖</button>`;
    d.onclick=()=>{ current=c.id; renderHistory(); renderChat(); };
    d.querySelector(".del").onclick=(e)=>{
      e.stopPropagation();
      chats=chats.filter(x=>x.id!==c.id);
      current=chats[0]?.id||null;
      save(); renderHistory(); renderChat();
    };
    historyBox.appendChild(d);
  });
}

// ===== RENDER CHAT =====
function renderChat(){
  chatBox.innerHTML="";
  const c=chats.find(x=>x.id===current);
  if(!c) return;
  c.messages.forEach(m=>bubble(m.text, m.role, false));
  scrollDown();
}

// ===== TITLE =====
function genTitle(t){
  if(t.toLowerCase().includes("hasil")) return t.replace(/apa/i,"").trim();
  return t.length>24? t.slice(0,24)+"…" : t;
}

// ===== BUBBLE + TYPING =====
function bubble(text, role, saveMsg=true){
  const wrap=document.createElement("div");
  wrap.className=role;
  const p=document.createElement("p");
  wrap.appendChild(p);
  chatBox.appendChild(wrap);

  let i=0;
  (function type(){
    if(i<text.length){
      p.textContent+=text[i++];
      setTimeout(type, 12);
    }
  })();

  if(saveMsg){
    const c=chats.find(x=>x.id===current);
    c.messages.push({role, text});
    if(c.messages.length===1) c.title=genTitle(text);
    save(); renderHistory();
  }
  scrollDown();
}

function imageBubble(url){
  const wrap=document.createElement("div");
  wrap.className="bot";
  const status=document.createElement("p");
  status.textContent="🟡 Creating image...";
  wrap.appendChild(status);
  chatBox.appendChild(wrap);

  const img=new Image();
  img.src=url;
  img.onload=()=>{
    status.textContent="✅ Image created";
    wrap.appendChild(img);
    scrollDown();
  };
}

// ===== PREVIEW =====
file.onchange=()=>{
  preview.innerHTML="";
  const f=file.files[0];
  if(!f) return;
  const w=document.createElement("div");
  w.className="preview-wrapper";
  const img=document.createElement("img");
  img.src=URL.createObjectURL(f);
  img.className="preview-img";
  const x=document.createElement("button");
  x.textContent="✖";
  x.onclick=()=>{ file.value=""; preview.innerHTML=""; };
  w.appendChild(img); w.appendChild(x);
  preview.appendChild(w);
};

// ===== DISABLE CHAT =====
function disableChat(msg){
  input.disabled=true;
  sendBtn.disabled=true;
  input.placeholder=msg;
}

// ===== SEND =====
form.onsubmit=async(e)=>{
  e.preventDefault();
  const msg=input.value.trim();
  const f=file.files[0];
  if(!msg && !f) return;

  bubble(msg || "[image]", "user");
  input.value=""; input.style.height="auto";
  file.value=""; preview.innerHTML="";

  const thinking=document.createElement("div");
  thinking.className="bot";
  thinking.innerHTML="<p>NeuroMV is thinking...</p>";
  chatBox.appendChild(thinking); scrollDown();

  try{
    const fd=new FormData();
    fd.append("message", msg);
    fd.append("chat_id", current);
    if(f) fd.append("file", f);

    const res=await fetch("/chat",{method:"POST", body:fd});
    const data=await res.json();
    thinking.remove();

    if(data.type==="limit"){
      bubble(data.reply,"bot");
      disableChat(data.reply);
      return;
    }
    if(data.type==="text"){
      bubble(data.reply,"bot");
    }
    if(data.type==="image"){
      imageBubble(data.url);
    }
  }catch{
    thinking.innerHTML="<p>❌ Network error</p>";
  }
};

// ===== ENTER SEND =====
input.addEventListener("keydown",e=>{
  if(e.key==="Enter" && !e.shiftKey){
    e.preventDefault();
    form.dispatchEvent(new Event("submit"));
  }
});

// ===== AUTO RESIZE =====
input.addEventListener("input",()=>{
  input.style.height="auto";
  input.style.height=input.scrollHeight+"px";
});

// ===== INIT =====
if(chats.length===0){ newBtn.click(); }
else{ current=chats[0].id; }
renderHistory(); renderChat();

function scrollDown(){ chatBox.scrollTop=chatBox.scrollHeight; }
