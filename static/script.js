/* =========================
   ELEMENT
========================= */
const chatbox = document.getElementById("chatbox");
const fileInput = document.getElementById("fileInput");
const previewBox = document.getElementById("previewBox");
const msgInput = document.getElementById("msg");

let selectedFile = null;

/* =========================
   CHAT STORAGE
========================= */
let chats = JSON.parse(localStorage.getItem("chats")) || [];
let currentChat = null;

/* =========================
   ENTER = SEND
========================= */
msgInput.addEventListener("keydown", function(e){
    if(e.key === "Enter"){
        e.preventDefault();
        sendMsg();
    }
});

/* =========================
   NEW CHAT
========================= */
function newChat(){
    currentChat = Date.now().toString();
    chats.push({id: currentChat, messages: []});
    saveChats();
    renderHistory();
    chatbox.innerHTML = "";
}

/* =========================
   SAVE CHAT
========================= */
function saveChats(){
    localStorage.setItem("chats", JSON.stringify(chats));
}

/* =========================
   LOAD CHAT
========================= */
function loadChat(id){
    currentChat = id;
    chatbox.innerHTML = "";

    let chat = chats.find(c => c.id === id);
    if(!chat) return;

    chat.messages.forEach(m => {
        if(m.type === "text"){
            addMsg(m.text, m.sender);
        } else if(m.type === "image"){
            addImage(m.src, m.sender);
        }
    });
}

/* =========================
   DELETE CHAT
========================= */
function deleteChat(id){
    chats = chats.filter(c => c.id !== id);
    saveChats();
    renderHistory();

    if(currentChat === id){
        chatbox.innerHTML = "";
        currentChat = null;
    }
}

/* =========================
   RENDER HISTORY
========================= */
function renderHistory(){
    let history = document.getElementById("history");
    history.innerHTML = "";

    chats.forEach(chat => {
        let div = document.createElement("div");
        div.className = "chat-item";

        let title = document.createElement("span");
        title.innerText = "Chat " + chat.id.slice(-4);
        title.onclick = () => loadChat(chat.id);

        let del = document.createElement("button");
        del.innerText = "🗑";
        del.onclick = () => deleteChat(chat.id);

        div.appendChild(title);
        div.appendChild(del);

        history.appendChild(div);
    });
}

/* =========================
   SAVE MESSAGE
========================= */
function saveMessage(sender, text, type="text", src=null){
    if(!currentChat){
        newChat();
    }

    let chat = chats.find(c => c.id === currentChat);

    if(type === "text"){
        chat.messages.push({sender, text, type});
    } else if(type === "image"){
        chat.messages.push({sender, src, type});
    }

    saveChats();
}

/* =========================
   OPEN FILE
========================= */
function openFile(){
    fileInput.click();
}

/* =========================
   PREVIEW IMAGE
========================= */
fileInput.addEventListener("change", ()=>{
    if(fileInput.files.length > 0){
        selectedFile = fileInput.files[0];

        let url = URL.createObjectURL(selectedFile);

        previewBox.innerHTML = `
            <div class="preview-card">
                <button class="remove-btn" onclick="removeFile()">✕</button>
                <img src="${url}">
            </div>
        `;
    }
});

/* =========================
   REMOVE FILE
========================= */
function removeFile(){
    selectedFile = null;
    fileInput.value = "";
    previewBox.innerHTML = "";
}

/* =========================
   ADD TEXT
========================= */
function addMsg(text, sender){
    let div = document.createElement("div");
    div.className = "msg " + sender;
    div.textContent = text;
    chatbox.appendChild(div);
    chatbox.scrollTop = chatbox.scrollHeight;
}

/* =========================
   ADD IMAGE
========================= */
function addImage(src, sender){
    let div = document.createElement("div");
    div.className = "msg " + sender;

    let img = document.createElement("img");
    img.src = src;

    div.appendChild(img);
    chatbox.appendChild(div);
    chatbox.scrollTop = chatbox.scrollHeight;
}

/* =========================
   TYPING EFFECT
========================= */
function typeEffect(text){
    let div = document.createElement("div");
    div.className = "msg bot";
    chatbox.appendChild(div);

    let i = 0;

    function typing(){
        if(i < text.length){
            div.textContent += text.charAt(i);
            i++;
            chatbox.scrollTop = chatbox.scrollHeight;
            setTimeout(typing, 15);
        }
    }

    typing();
}

/* =========================
   SEND MESSAGE
========================= */
async function sendMsg(){

    let msg = msgInput.value.trim();

    if(!msg && !selectedFile) return;

    if(msg){
        addMsg(msg, "user");
        saveMessage("user", msg);
    }

    if(selectedFile){
        let url = URL.createObjectURL(selectedFile);
        addImage(url, "user");
        saveMessage("user", "", "image", url);
    }

    msgInput.value = "";
    previewBox.innerHTML = "";

    let formData = new FormData();
    formData.append("message", msg);

    if(selectedFile){
        formData.append("file", selectedFile);
    }

    selectedFile = null;

    let loading = document.createElement("div");
    loading.className = "msg bot";
    loading.innerText = "NeuroMV lagi mikir...";
    chatbox.appendChild(loading);

    try{
        let res = await fetch("/chat", {
            method: "POST",
            body: formData
        });

        let data = await res.json();

        loading.remove();
        typeEffect(data.reply);

        saveMessage("bot", data.reply);

    }catch{
        loading.remove();
        addMsg("❌ Error server", "bot");
    }
}

/* =========================
   INIT
========================= */
renderHistory();
