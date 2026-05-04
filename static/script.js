let chatbox = document.getElementById("chatbox");
let history = document.getElementById("history");

let chats = JSON.parse(localStorage.getItem("neuro_chats") || "{}");
let currentChat = null;

function saveData(){
    localStorage.setItem("neuro_chats", JSON.stringify(chats));
}

function renderHistory(){
    history.innerHTML = "";

    let keys = Object.keys(chats).reverse();

    keys.forEach(id => {
        let div = document.createElement("div");
        div.className = "history-item";

        div.innerHTML = `
            <span class="chat-title" onclick="openChat('${id}')">
                ${chats[id].title}
            </span>

            <button onclick="deleteChat('${id}')">🗑️</button>
        `;

        history.appendChild(div);
    });
}

function newChat(){
    let id = "chat_" + Date.now();

    chats[id] = {
        title:"New Chat",
        messages:[]
    };

    currentChat = id;

    saveData();
    renderHistory();
    renderMessages();
}

function openChat(id){
    currentChat = id;
    renderMessages();
}

function deleteChat(id){
    if(!confirm("Hapus chat ini?")) return;

    delete chats[id];

    if(currentChat === id){
        currentChat = null;
        chatbox.innerHTML = "";
    }

    saveData();
    renderHistory();

    let keys = Object.keys(chats);

    if(keys.length > 0){
        currentChat = keys[keys.length - 1];
        renderMessages();
    } else {
        newChat();
    }
}

function renderMessages(){
    chatbox.innerHTML = "";

    if(!currentChat) return;

    chats[currentChat].messages.forEach(msg => {
        chatbox.innerHTML += `
            <div class="msg ${msg.role}">
                ${msg.text}
            </div>
        `;
    });

    chatbox.scrollTop = chatbox.scrollHeight;
}

async function sendMsg(){
    let input = document.getElementById("msg");
    let msg = input.value.trim();

    if(!msg || !currentChat) return;

    chats[currentChat].messages.push({
        role:"user",
        text:msg
    });

    if(chats[currentChat].title === "New Chat"){
        chats[currentChat].title = msg.substring(0,25);
    }

    saveData();
    renderHistory();
    renderMessages();

    input.value="";

    let loading = document.createElement("div");
    loading.className = "msg bot";
    loading.id = "loading";
    loading.innerText = "Mengetik...";
    chatbox.appendChild(loading);

    chatbox.scrollTop = chatbox.scrollHeight;

    let res = await fetch("/chat",{
        method:"POST",
        headers:{
            "Content-Type":"application/json"
        },
        body:JSON.stringify({
            message:msg
        })
    });

    let data = await res.json();

    document.getElementById("loading").remove();

    chats[currentChat].messages.push({
        role:"bot",
        text:data.reply
    });

    saveData();
    renderMessages();
}

renderHistory();

let keys = Object.keys(chats);

if(keys.length > 0){
    currentChat = keys[keys.length - 1];
    renderMessages();
} else {
    newChat();
}
