let chats = JSON.parse(localStorage.getItem("chats")) || {};
let currentChat = localStorage.getItem("current_chat");

if(!currentChat || !chats[currentChat]){
    currentChat = "Chat 1";
    chats[currentChat] = {
        title: "Chat Baru",
        messages: []
    };
    saveAll();
}

function saveAll(){
    localStorage.setItem("chats", JSON.stringify(chats));
    localStorage.setItem("current_chat", currentChat);
}

/* ================= SIDEBAR ================= */
function renderChats(){
    const list = document.getElementById("chatList");
    list.innerHTML = "";

    Object.keys(chats).forEach(name => {
        let chat = chats[name];

        let div = document.createElement("div");

        div.innerHTML = `
            <span onclick="switchChat('${name}')">${chat.title}</span>
            <button onclick="deleteChat('${name}')">x</button>
        `;

        list.appendChild(div);
    });
}

/* ================= SWITCH ================= */
function switchChat(name){
    currentChat = name;
    saveAll();
    loadChat();
}

/* ================= NEW CHAT ================= */
function newChat(){
    let name = "Chat " + Date.now();

    chats[name] = {
        title: "Chat Baru",
        messages: []
    };

    currentChat = name;

    saveAll();
    renderChats();
    loadChat();
}

/* ================= DELETE ================= */
function deleteChat(name){
    delete chats[name];

    if(Object.keys(chats).length === 0){
        newChat();
        return;
    }

    if(currentChat === name){
        currentChat = Object.keys(chats)[0];
    }

    saveAll();
    renderChats();
    loadChat();
}

/* ================= LOAD CHAT ================= */
function loadChat(){
    const box = document.getElementById("chatbox");
    box.innerHTML = "";

    let chat = chats[currentChat];
    if(!chat) return;

    chat.messages.forEach(m => {
        addMsgUI(m.text, m.role, false);
    });
}

/* ================= MESSAGE ================= */
function addMsgUI(text, role, save=true){
    const box = document.getElementById("chatbox");

    let div = document.createElement("div");
    div.className = "msg " + role;

    box.appendChild(div);

    if(role === "user"){
        div.innerText = text;
    }

    if(role === "bot"){
        typeText(div, text);
    }

    if(save){
        chats[currentChat].messages.push({text, role});
        saveAll();
    }
}

/* ================= TYPING EFFECT ================= */
function typeText(element, text){
    element.innerText = "";

    let i = 0;

    let interval = setInterval(() => {
        element.innerText += text[i];
        i++;

        if(i >= text.length){
            clearInterval(interval);
        }
    }, 15);
}

/* ================= SEND ================= */
async function sendMsg(){
    let msg = document.getElementById("msg").value;
    let file = document.getElementById("fileInput").files[0];

    if(!msg && !file) return;

    let chat = chats[currentChat];

    if(chat.messages.length === 0){
        chat.title = msg.slice(0, 30) || "Chat Baru";
    }

    let formData = new FormData();
    formData.append("message", msg);

    if(file){
        formData.append("file", file);
        addMsgUI("[image]", "user");
    }

    if(msg){
        addMsgUI(msg, "user");
    }

    document.getElementById("msg").value = "";

    let res = await fetch("/chat", {
        method:"POST",
        body:formData
    });

    let data = await res.json();

    addMsgUI(data.reply, "bot");

    document.getElementById("fileInput").value = "";
}

/* ================= INIT ================= */
window.onload = () => {
    renderChats();
    loadChat();
};
