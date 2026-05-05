function loadChats(){
    try{
        const data = JSON.parse(localStorage.getItem("chats"));
        return Array.isArray(data) ? data : [];
    }catch{
        return [];
    }
}

let chats = loadChats();
let currentChatId = null;

const form = document.getElementById("chat-form");
const input = document.getElementById("message");
const chatBox = document.getElementById("chat-box");
const historyBox = document.getElementById("history");
const fileInput = document.getElementById("file-input");
const previewBox = document.getElementById("preview-box");

// SAVE
function saveChats(){
    localStorage.setItem("chats", JSON.stringify(chats));
}

// NEW CHAT
document.querySelector(".new-chat").onclick = ()=>{
    const id = Date.now();

    chats.unshift({
        id:id,
        title:"New Chat",
        messages:[]
    });

    currentChatId = id;
    saveChats();
    renderHistory();
    renderChat();
};

// HISTORY
function renderHistory(){
    historyBox.innerHTML="";

    chats.forEach(chat=>{
        const div=document.createElement("div");
        div.className="history-item";

        const span=document.createElement("span");
        span.textContent=chat.title;

        const del=document.createElement("button");
        del.className="delete-chat";
        del.textContent="✖";

        del.onclick=(e)=>{
            e.stopPropagation();
            chats=chats.filter(c=>c.id!==chat.id);
            currentChatId=chats[0]?.id||null;
            saveChats();
            renderHistory();
            renderChat();
        };

        div.onclick=()=>{
            currentChatId=chat.id;
            renderChat();
        };

        div.appendChild(span);
        div.appendChild(del);
        historyBox.appendChild(div);
    });
}

// CHAT
function addMessage(text, role, save=true){
    const div=document.createElement("div");
    div.className=role;

    const p=document.createElement("p");
    p.textContent=text;

    div.appendChild(p);
    chatBox.appendChild(div);

    if(save){
        const chat=chats.find(c=>c.id===currentChatId);
        if(chat){
            chat.messages.push({role,text});
            if(chat.messages.length===1){
                chat.title=text.slice(0,20);
            }
        }
        saveChats();
        renderHistory();
    }

    scrollBottom();
}

function addImage(url){
    const div=document.createElement("div");
    div.className="bot";

    const img=document.createElement("img");
    img.src=url;
    img.className="chat-image";

    div.appendChild(img);
    chatBox.appendChild(div);
    scrollBottom();
}

function renderChat(){
    chatBox.innerHTML="";
    const chat=chats.find(c=>c.id===currentChatId);
    if(!chat)return;

    chat.messages.forEach(m=>{
        addMessage(m.text,m.role,false);
    });
}

// SEND
form.onsubmit=async(e)=>{
    e.preventDefault();

    const msg=input.value.trim();
    if(!msg)return;

    addMessage(msg,"user");

    input.value="";

    try{
        const fd=new FormData();
        fd.append("message",msg);

        const res=await fetch("/chat",{
            method:"POST",
            body:fd
        });

        const data=await res.json();

        if(data.type==="text"){
            addMessage(data.reply,"bot");
        }

        if(data.type==="image"){
            addImage(data.url);
        }

    }catch{
        addMessage("❌ Server error","bot");
    }
};

// ENTER SEND
input.onkeydown=(e)=>{
    if(e.key==="Enter"&&!e.shiftKey){
        e.preventDefault();
        form.dispatchEvent(new Event("submit"));
    }
};

function scrollBottom(){
    chatBox.scrollTop=chatBox.scrollHeight;
}

// INIT
if(chats.length===0){
    document.querySelector(".new-chat").click();
}else{
    currentChatId=chats[0].id;
}

renderHistory();
renderChat();
