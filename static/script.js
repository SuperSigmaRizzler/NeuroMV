let chatbox = document.getElementById("chatbox");
let history = document.getElementById("history");

let chats = JSON.parse(localStorage.getItem("neuro_chats") || "{}");
let currentChat = null;

function saveData(){
    localStorage.setItem("neuro_chats", JSON.stringify(chats));
}

function renderHistory(){
    history.innerHTML = "";

    for(let id in chats){
        let div = document.createElement("div");
        div.className = "history-item";
        div.innerText = chats[id].title;
        div.onclick = () => openChat(id);
        history.prepend(div);
    }
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

function renderMessages(){
    chatbox.innerHTML = "";

    if(!currentChat) return;

    chats[currentChat].messages.forEach(m=>{
        chatbox.innerHTML += `
        <div class="msg ${m.role}">
            ${m.text}
        </div>`;
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

    chats[currentChat].messages.push({
        role:"bot",
        text:data.reply
    });

    saveData();
    renderMessages();
}

renderHistory();

if(Object.keys(chats).length > 0){
    currentChat = Object.keys(chats)[0];
    renderMessages();
} else {
    newChat();
}
