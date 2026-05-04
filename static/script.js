let chats = JSON.parse(localStorage.getItem("chats")) || {};
let currentChat = localStorage.getItem("current_chat");

if(!currentChat){
    currentChat = "Chat 1";
    chats[currentChat] = {
        title: "Chat Baru",
        messages: []
    };
    saveAll();
}

/* =========================
   SAVE KE LOCALSTORAGE
========================= */
function saveAll(){
    localStorage.setItem("chats", JSON.stringify(chats));
    localStorage.setItem("current_chat", currentChat);
}

/* =========================
   AUTO JUDUL CHAT
========================= */
function generateTitle(text){
    text = text.trim().replace("?", "");

    let words = text.split(" ");

    let title = words.slice(0, 6).join(" ");

    if(title.length > 35){
        title = title.substring(0, 35) + "...";
    }

    return title || "Chat Baru";
}

/* =========================
   RENDER SIDEBAR CHAT LIST
========================= */
function renderChats(){
    const list = document.getElementById("chatList");
    list.innerHTML = "";

    Object.keys(chats).forEach(name => {
        let chat = chats[name];

        let div = document.createElement("div");

        let title = chat.title || name;

        div.innerHTML = `
            <span onclick="switchChat('${name}')">${title}</span>
            <button onclick="deleteChat('${name}')">x</button>
        `;

        list.appendChild(div);
    });
}

/* =========================
   SWITCH CHAT
========================= */
function switchChat(name){
    currentChat = name;
    saveAll();
    loadChat();
}

/* =========================
   CHAT BARU
========================= */
function newChat(){
    let name = "chat_" + Date.now();

    chats[name] = {
        title: "Chat Baru",
        messages: []
    };

    currentChat = name;

    saveAll();
    renderChats();
    loadChat();
}

/* =========================
   HAPUS CHAT
========================= */
function deleteChat(name){
    delete chats[name];

    if(Object.keys(chats).length === 0){
        newChat();
    } else if(currentChat === name){
        currentChat = Object.keys(chats)[0];
    }

    saveAll();
    renderChats();
    loadChat();
}

/* =========================
   LOAD CHAT KE UI
========================= */
function loadChat(){
    const box = document.getElementById("chatbox");
    box.innerHTML = "";

    let chat = chats[currentChat];

    if(!chat) return;

    chat.messages.forEach(m => {
        addMsgUI(m.text, m.role, false);
    });
}

/* =========================
   TAMBAH PESAN KE UI
========================= */
function addMsgUI(text, role, save=true){
    const box = document.getElementById("chatbox");

    let div = document.createElement("div");
    div.className = "msg " + role;
    div.innerText = text;

    box.appendChild(div);

    if(save){
        chats[currentChat].messages.push({
            text,
            role
        });

        saveAll();
    }
}

/* =========================
   KIRIM PESAN
========================= */
async function sendMsg(){
    let msg = document.getElementById("msg").value;
    if(!msg) return;

    let chat = chats[currentChat];

    /* 🧠 AUTO TITLE (ambil dari pesan pertama) */
    if(chat.messages.length === 0){
        chat.title = generateTitle(msg);
    }

    addMsgUI(msg, "user");

    document.getElementById("msg").value = "";

    let res = await fetch("/chat", {
        method:"POST",
        body:new URLSearchParams({message:msg})
    });

    let data = await res.json();

    addMsgUI(data.reply, "bot");
}

/* =========================
   CLEAR CHAT
========================= */
async function clearChat(){
    chats[currentChat].messages = [];
    saveAll();
    loadChat();
}

/* =========================
   INIT
========================= */
window.onload = () => {
    renderChats();
    loadChat();
};
