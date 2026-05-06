let chats=[], archive=[], current=null, lastDeleted=null;

const chat=document.getElementById("chat");
const history=document.getElementById("history");
const archiveBox=document.getElementById("archive");
const form=document.getElementById("form");
const input=document.getElementById("input");
const file=document.getElementById("file");
const preview=document.getElementById("preview");

// MENU
function toggleMenu(){
 document.querySelector(".sidebar").classList.toggle("open");
}

// NEW CHAT
function newChat(){
 const id="c"+Date.now();
 chats.unshift({id,title:"New Chat",msg:[]});
 current=id;
 renderAll();
}

// RENDER
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

// TYPE EFFECT
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

// BUBBLE
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

// THINKING
function showThinking(mode){
 let d=document.createElement("div");
 d.className="bot";
 let p=document.createElement("p");

 if(mode==="image"){
  p.textContent="🎨 Creating Image...";
 }else if(mode==="search"){
  p.textContent="🔍 Searching...";
 }else{
  p.textContent="🧠 NeuroMV is thinking...";
 }

 d.appendChild(p);
 chat.appendChild(d);
 return {wrap:d, text:p};
}

// DELETE
async function deleteChat(id){
 let c=chats.find(x=>x.id===id);
 lastDeleted=c;

 await fetch("/clear_chat",{
  method:"POST",
  headers:{"Content-Type":"application/json"},
  body:JSON.stringify({chat_id:id})
 });

 chats=chats.filter(x=>x.id!==id);
 current=chats[0]?.id;
 renderAll();
 showUndo();
}

// UNDO
function showUndo(){
 let u=document.createElement("div");
 u.className="undo";
 u.innerHTML=`Deleted <button onclick="undo()">Undo</button>`;
 document.body.appendChild(u);
 setTimeout(()=>u.remove(),5000);
}

function undo(){
 if(!lastDeleted) return;
 chats.unshift(lastDeleted);
 current=lastDeleted.id;
 renderAll();
}

// ARCHIVE
function archiveChat(id){
 let c=chats.find(x=>x.id===id);
 archive.push(c);
 chats=chats.filter(x=>x.id!==id);
 current=chats[0]?.id;
 renderAll();
}

function restoreChat(id){
 let c=archive.find(x=>x.id===id);
 chats.unshift(c);
 archive=archive.filter(x=>x.id!==id);
 current=c.id;
 renderAll();
}

// FILE
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
 x.onclick=()=>{
  file.value="";
  preview.innerHTML="";
 };

 w.appendChild(img);
 w.appendChild(x);
 preview.appendChild(w);
};

// SEND
form.onsubmit=async(e)=>{
 e.preventDefault();

 let msg=input.value;
 let f=file.files[0];
 if(!msg && !f) return;

 bubble(msg||"[file]","user");

 input.value="";
 preview.innerHTML="";
 file.value="";

 let mode = "ai";
 if(msg.match(/image|draw|anime|art/i)) mode="image";
 if(msg.match(/what|who|when|where/i)) mode="search";

 let thinking = showThinking(mode);

 let fd=new FormData();
 fd.append("message",msg);
 fd.append("chat_id",current);
 if(f) fd.append("file",f);

 let r=await fetch("/chat",{method:"POST",body:fd});
 let d=await r.json();

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
};

// INIT
newChat();
