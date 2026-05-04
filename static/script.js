const chatbox = document.getElementById("chatbox");
const fileInput = document.getElementById("fileInput");
const preview = document.getElementById("preview");
const msgInput = document.getElementById("msg");
const historyDiv = document.getElementById("history");

let chats = JSON.parse(localStorage.getItem("neuro_chats")) || [];
let currentChat = null;

/* ================= LOAD ================= */

function saveChats(){
    localStorage.setItem("neuro_chats", JSON.stringify(chats));
}

function renderHistory(){
    historyDiv.innerHTML = "";

    chats.forEach(chat=>{
        let div = document.createElement("div");
        div.className = "chat-item";
        div.innerHTML = `
            <span onclick="loadChat('${chat.id}')">${chat.id}</span>
            <button onclick="deleteChat('${chat.id}')">x</button>
        `;
        historyDiv.appendChild(div);
    });
}

/* ================= CHAT ================= */

function newChat(){
    let id = "Chat " + (chats.length + 1);

    let chat = {
        id: id,
        messages: []
    };

    chats.push(chat);
    currentChat = chat;

    saveChats();
    renderHistory();

    chatbox.innerHTML = "";
}

function loadChat(id){
    let chat = chats.find(c => c.id === id);
    if(!chat) return;

    currentChat = chat;

    chatbox.innerHTML = "";

    chat.messages.forEach(msg=>{
        if(msg.type === "text"){
            addMsg(msg.content, msg.role, false);
        }else if(msg.type === "image"){
            addImage(msg.content, msg.role, false);
        }
    });
}

function deleteChat(id){
    chats = chats.filter(c => c.id !== id);

    saveChats();
    renderHistory();

    chatbox.innerHTML = "";
}

/* ================= UI ================= */

function addMsg(text, role, save=true){
    let div = document.createElement("div");
    div.className = "msg " + role;
    div.innerText = text;
    chatbox.appendChild(div);

    chatbox.scrollTop = chatbox.scrollHeight;

    if(save && currentChat){
        currentChat.messages.push({
            role: role,
            type: "text",
            content: text
        });
        saveChats();
    }
}

function addImage(src, role, save=true){
    let div = document.createElement("div");
    div.className = "msg " + role;
    div.innerHTML = `<img src="${src}">`;
    chatbox.appendChild(div);

    chatbox.scrollTop = chatbox.scrollHeight;

    if(save && currentChat){
        currentChat.messages.push({
            role: role,
            type: "image",
            content: src
        });
        saveChats();
    }
}

/* ================= SEND ================= */

async function sendMsg(){
    let msg = msgInput.value.trim();
    let file = fileInput.files[0];

    if(!msg && !file) return;

    if(!currentChat){
        newChat();
    }

    if(msg) addMsg(msg, "user");

    if(file){
        let url = URL.createObjectURL(file);
        addImage(url, "user");
    }

    msgInput.value="";
    preview.innerText="";

    let loading = document.createElement("div");
    loading.className="msg bot";
    loading.id="loading";
    loading.innerText="NeuroMV lagi mikir...";
    chatbox.appendChild(loading);

    let formData = new FormData();
    formData.append("message", msg);
    if(file) formData.append("file", file);

    try{
        let res = await fetch("/chat",{method:"POST",body:formData});
        let data = await res.json();

        document.getElementById("loading").remove();

        typeEffect(data.reply);

    }catch{
        document.getElementById("loading").remove();
        addMsg("Error server 😭","bot");
    }

    fileInput.value="";
}

/* ================= TYPING ================= */

function typeEffect(text){
    let div = document.createElement("div");
    div.className="msg bot";
    chatbox.appendChild(div);

    let i=0;

    function typing(){
        if(i<text.length){
            div.innerText+=text.charAt(i);
            i++;
            chatbox.scrollTop=chatbox.scrollHeight;
            setTimeout(typing,15);
        }else{
            if(currentChat){
                currentChat.messages.push({
                    role:"bot",
                    type:"text",
                    content:text
                });
                saveChats();
            }
        }
    }

    typing();
}

/* ================= EVENTS ================= */

msgInput.addEventListener("keypress",(e)=>{
    if(e.key==="Enter") sendMsg();
});

fileInput.addEventListener("change",()=>{
    if(fileInput.files.length>0){
        preview.innerText="📎 "+fileInput.files[0].name;
    }else{
        preview.innerText="";
    }
});

/* ================= INIT ================= */

renderHistory();
