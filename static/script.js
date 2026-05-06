let chats=[], archive=[], current=null, lastDeleted=null;
let isLoading=false;

const chat=document.getElementById("chat");
const history=document.getElementById("history");
const archiveBox=document.getElementById("archive");
const form=document.getElementById("form");
const input=document.getElementById("input");
const file=document.getElementById("file");
const preview=document.getElementById("preview");
const sendBtn=form.querySelector("button");

// ===== MENU =====
function toggleMenu(){
 document.querySelector(".sidebar").classList.toggle("open");
}

// ===== NEW CHAT =====
function newChat(){
 const id="c"+Date.now();
 chats.unshift({id,title:"New Chat",msg:[]});
 current=id;
 renderAll();
}

// ===== RENDER =====
function renderAll(){
 renderHistory();
 renderArchive();
 renderChat();
}

function renderHistory(){
 history.innerHTML="";
 chats.forEach(c=>{
  let d=document.createElement("div");
  d.className="history-item";
  d.innerHTML=`${c.title}
  <div>
   <button onclick="archiveChat('${c.id}')">📦</button>
   <button onclick="deleteChat('${c.id}')">✖</button>
  </div>`;
  d.onclick=()=>{current=c.id;renderChat();}
  history.appendChild(d);
 });
}

function renderArchive(){
 archiveBox.innerHTML="";
 archive.forEach(c=>{
  let d=document.createElement("div");
  d.className="history-item";
  d.innerHTML=`${c.title}
  <button onclick="restoreChat('${c.id}')">↩</button>`;
  archiveBox.appendChild(d);
 });
}

function renderChat(){
 chat.innerHTML="";
 let c=chats.find(x=>x.id===current);
 if(!c) return;
 c.msg.forEach(m=>bubble(m.t,m.r,false));
}

// ===== TYPE =====
function typeText(el,text){
 let i=0;
 function type(){
  if(i<text.length){
   el.textContent+=text[i++];
   requestAnimationFrame(type);
  }
 }
 type();
}

// ===== BUBBLE =====
function bubble(t,r,save=true){
 let d=document.createElement("div");
 d.className=r;
 let p=document.createElement("p");
 d.appendChild(p);
 chat.appendChild(d);

 typeText(p,t);

 if(save){
  let c=chats.find(x=>x.id===current);
  c.msg.push({t,r});
 }
}

// ===== THINKING =====
function showThinking(mode){
 let d=document.createElement("div");
 d.className="bot";
 let p=document.createElement("p");

 if(mode==="image") p.textContent="🎨 Creating Image...";
 else if(mode==="search") p.textContent="🔍 Searching...";
 else p.textContent="🧠 NeuroMV is thinking...";

 d.appendChild(p);
 chat.appendChild(d);
 return {wrap:d};
}

// ===== INPUT CONTROL =====
input.addEventListener("keydown",(e)=>{
 if(e.key==="Enter" && !e.shiftKey){
  e.preventDefault();
  if(!isLoading) form.dispatchEvent(new Event("submit"));
 }
});

input.addEventListener("input",()=>{
 input.style.height="auto";
 input.style.height=input.scrollHeight+"px";

 sendBtn.disabled = input.value.trim()==="" && !file.files[0];
});

// ===== FILE =====
file.onchange=()=>{
 preview.innerHTML="";
 let f=file.files[0];
 if(!f) return;

 let w=document.createElement("div");
 w.className="preview-wrapper";

 let img=document.createElement("img");
 img.src=URL.createObjectURL(f);

 let x=document.createElement("button");
 x.textContent="✖";
 x.onclick=()=>{file.value="";preview.innerHTML="";};

 w.appendChild(img);
 w.appendChild(x);
 preview.appendChild(w);
};

// ===== SEND =====
form.onsubmit=async(e)=>{
 e.preventDefault();
 if(isLoading) return;

 let msg=input.value.trim();
 let f=file.files[0];
 if(!msg && !f) return;

 isLoading=true;
 sendBtn.textContent="...";
 sendBtn.disabled=true;

 bubble(msg||"[file]","user");

 input.value="";
 preview.innerHTML="";
 file.value="";

 let mode="ai";
 if(msg.match(/image|draw|anime|art/i)) mode="image";
 if(msg.match(/what|who|when|where/i)) mode="search";

 let thinking=showThinking(mode);

 let fd=new FormData();
 fd.append("message",msg);
 fd.append("chat_id",current);
 if(f) fd.append("file",f);

 let res=await fetch("/chat",{method:"POST",body:fd});
 let d=await res.json();

 thinking.wrap.remove();

 if(d.type==="image"){
  let wrap=document.createElement("div");
  wrap.className="bot";

  let p=document.createElement("p");
  p.textContent="✅ Image Created";
  wrap.appendChild(p);

  let img=new Image();
  img.src=d.url;
  wrap.appendChild(img);

  chat.appendChild(wrap);
 }

 if(d.type==="text"||d.type==="search"){
  bubble(d.reply,"bot");
 }

 if(d.type==="error"){
  bubble(d.reply,"bot");
 }

 isLoading=false;
 sendBtn.textContent="Send";
};

// INIT
newChat();
