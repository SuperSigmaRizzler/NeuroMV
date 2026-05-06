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

function saveChats(){
    localStorage.setItem("chats", JSON.stringify(chats));
}

document.querySelector(".new-chat").onclick = ()=>{
    const id = Date.now();
    chats.unshift({
        id:id,
        title:"New Chat",
        messages:[]
    });
    currentChatId=id;
    saveChats();
    renderHistory();
    renderChat();
};

function renderHistory(){
    historyBox.innerHTML="";

    chats.forEach(chat=>{
        const div=document.createElement("div");
        div.className="history-item";

        const title=document.createElement("span");
        title.textContent=chat.title;

        const del=document.createElement("button");
        del.textContent="✖";
        del.className="delete-chat";

        del.onclick=(e)=>{
            e.stopPropagation();
            chats=chats.filter(c=>c.id!==chat.id);
            currentChatId=chats[0]?.id || null;
            saveChats();
            renderHistory();
            renderChat();
        };

        div.onclick=()=>{
            currentChatId=chat.id;
            renderChat();
        };

        div.appendChild(title);
        div.appendChild(del);
        historyBox.appendChild(div);
    });
}

function renderChat(){
    chatBox.innerHTML="";
    const chat=chats.find(c=>c.id===currentChatId);
    if(!chat)return;

    chat.messages.forEach(m=>{
        addMessage(m.text,m.role,false);
    });
}

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
                chat.title=text.slice(0,25);
            }
            saveChats();
            renderHistory();
        }
    }

    chatBox.scrollTop=chatBox.scrollHeight;
}

form.onsubmit=async(e)=>{
    e.preventDefault();

    const msg=input.value.trim();
    const file=fileInput.files[0];

    if(!msg && !file) return;

    addMessage(msg,"user");

    input.value="";
    fileInput.value="";
    previewBox.innerHTML="";

    const loading=document.createElement("div");
    loading.className="bot";
    loading.innerHTML="<p>NeuroMV is thinking...</p>";
    chatBox.appendChild(loading);

    try{
        const fd=new FormData();
        fd.append("message",msg);
        if(file) fd.append("file",file);

        const res=await fetch("/chat",{
            method:"POST",
            body:fd
        });

        const data=await res.json();
        loading.remove();

        if(data.type==="text"){
            addMessage(data.reply,"bot");
        }

        if(data.type==="image"){
            const div=document.createElement("div");
            div.className="bot";
            div.innerHTML=`<img src="${data.url}" class="chat-image">`;
            chatBox.appendChild(div);
        }

    }catch{
        loading.remove();
        addMessage("❌ Server error","bot");
    }
};

input.addEventListener("keydown",(e)=>{
    if(e.key==="Enter" && !e.shiftKey){
        e.preventDefault();
        form.dispatchEvent(new Event("submit"));
    }
});

fileInput.onchange=()=>{
    previewBox.innerHTML="";
    const f=fileInput.files[0];
    if(!f)return;

    const img=document.createElement("img");
    img.src=URL.createObjectURL(f);
    img.className="preview-image";
    previewBox.appendChild(img);
};

if(chats.length===0){
    document.querySelector(".new-chat").click();
}else{
    currentChatId=chats[0].id;
}

renderHistory();
renderChat();
