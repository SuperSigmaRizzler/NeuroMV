const form = document.getElementById("chat-form");
const input = document.getElementById("message");
const chatBox = document.getElementById("chat-box");
const historyBox = document.getElementById("history");
const fileInput = document.getElementById("file-input");
const previewBox = document.getElementById("preview-box");

// =====================
// STORAGE
// =====================
let chats = JSON.parse(localStorage.getItem("chats") || "[]");
let currentChatId = null;

function saveChats(){
  localStorage.setItem("chats", JSON.stringify(chats));
}

// =====================
// NEW CHAT
// =====================
document.querySelector(".new-chat").onclick = ()=>{
  const id = Date.now();
  chats.unshift({id,title:"New Chat",messages:[]});
  currentChatId = id;
  saveChats();
  renderHistory();
  renderChat();
};

// =====================
// HISTORY
// =====================
function renderHistory(){
  historyBox.innerHTML="";
  chats.forEach(c=>{
    const div=document.createElement("div");
    div.className="history-item";

    const t=document.createElement("span");
    t.textContent=c.title;

    const del=document.createElement("button");
    del.textContent="✖";
    del.className="delete-chat";

    del.onclick=(e)=>{
      e.stopPropagation();
      chats=chats.filter(x=>x.id!==c.id);
      currentChatId=chats[0]?.id;
      saveChats();
      renderHistory();
      renderChat();
    };

    div.onclick=()=>{
      currentChatId=c.id;
      renderChat();
    };

    div.appendChild(t);
    div.appendChild(del);
    historyBox.appendChild(div);
  });
}

// =====================
// RENDER CHAT
// =====================
function renderChat(){
  chatBox.innerHTML="";
  const chat=chats.find(c=>c.id===currentChatId);
  if(!chat)return;

  chat.messages.forEach(m=>{
    addMessage(m.text,m.role,null,false);
  });
}

// =====================
// TITLE AUTO
// =====================
function genTitle(t){
  if(t.toLowerCase().includes("hasil")) return t.replace("apa","");
  return t.slice(0,20);
}

// =====================
// ADD MESSAGE
// =====================
function addMessage(text,role,file=null,save=true){
  const div=document.createElement("div");
  div.className=role;

  if(text){
    const p=document.createElement("p");
    p.textContent=text;
    div.appendChild(p);
  }

  if(file){
    const img=document.createElement("img");
    img.src=URL.createObjectURL(file);
    img.className="chat-image";
    div.appendChild(img);
  }

  chatBox.appendChild(div);

  if(save){
    const chat=chats.find(c=>c.id===currentChatId);
    chat.messages.push({role,text});
    if(chat.messages.length===1) chat.title=genTitle(text);
    saveChats();
    renderHistory();
  }

  chatBox.scrollTop=chatBox.scrollHeight;
}

// =====================
// PREVIEW
// =====================
fileInput.onchange=()=>{
  previewBox.innerHTML="";
  const f=fileInput.files[0];
  if(!f)return;

  const wrap=document.createElement("div");
  wrap.className="preview-wrapper";

  const img=document.createElement("img");
  img.src=URL.createObjectURL(f);
  img.className="preview-image";

  const rm=document.createElement("button");
  rm.textContent="✖";
  rm.className="remove-btn";
  rm.onclick=()=>{
    fileInput.value="";
    previewBox.innerHTML="";
  };

  wrap.appendChild(img);
  wrap.appendChild(rm);
  previewBox.appendChild(wrap);
};

// =====================
// SEND (FIX TOTAL)
// =====================
form.onsubmit=async(e)=>{
  e.preventDefault();

  const msg=input.value.trim();
  const file=fileInput.files[0];
  if(!msg && !file) return;

  addMessage(msg,"user",file);

  // RESET FIX
  input.value="";
  fileInput.value="";
  previewBox.innerHTML="";

  try{
    const fd=new FormData();
    fd.append("message",msg);
    if(file) fd.append("file",file);

    const res=await fetch("/chat",{method:"POST",body:fd});
    const data=await res.json();

    if(data.type==="text") addMessage(data.reply,"bot");

    if(data.type==="image"){
      const div=document.createElement("div");
      div.className="bot";
      const img=document.createElement("img");
      img.src=data.url;
      img.className="chat-image";
      div.appendChild(img);
      chatBox.appendChild(div);
    }

  }catch{
    addMessage("❌ Server error","bot");
  }
};

// =====================
// ENTER SEND
// =====================
input.onkeydown=(e)=>{
  if(e.key==="Enter"&&!e.shiftKey){
    e.preventDefault();
    form.dispatchEvent(new Event("submit"));
  }
};

// =====================
// INIT
// =====================
if(chats.length===0){
  document.querySelector(".new-chat").click();
}else{
  currentChatId=chats[0].id;
}
renderHistory();
renderChat();
