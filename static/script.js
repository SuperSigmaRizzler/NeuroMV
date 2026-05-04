let chats = JSON.parse(localStorage.getItem("chats")) || {};
let currentChat = localStorage.getItem("current_chat");

/* buat chat pertama kalau belum ada */
if(!currentChat){
    currentChat = "Chat 1";
    chats[currentChat] = "";
}

/* render sidebar */
function renderChats(){
    let list = document.getElementById("chatList");
    list.innerHTML = "";

    Object.keys(chats).forEach(name => {
        let div = document.createElement("div");
        div.innerText = name;
        div.onclick = () => switchChat(name);
        list.appendChild(div);
    });
}

/* pindah chat */
function switchChat(name){
    currentChat = name;
    localStorage.setItem("current_chat", name);
    document.getElementById("chatbox").innerHTML = chats[name];
}

/* chat baru */
function newChat(){
    let name = "Chat " + (Object.keys(chats).length + 1);
    chats[name] = "";
    currentChat = name;
    saveAll();
    renderChats();
    switchChat(name);
}

/* simpan */
function saveAll(){
    chats[currentChat] = document.getElementById("chatbox").innerHTML;
    localStorage.setItem("chats", JSON.stringify(chats));
    localStorage.setItem("current_chat", currentChat);
}

/* load awal */
window.onload = () => {
    renderChats();
    switchChat(currentChat);
};

/* tambah pesan */
function addMsg(text, role){
    let div = document.createElement("div");
    div.className = "msg " + role;
    div.innerText = text;
    document.getElementById("chatbox").appendChild(div);
    saveAll();
}

/* kirim */
async function sendMsg(){
    let msg = document.getElementById("msg").value;
    if(!msg) return;

    addMsg(msg, "user");
    document.getElementById("msg").value = "";

    let res = await fetch("/chat", {
        method:"POST",
        body:new URLSearchParams({message:msg})
    });

    let data = await res.json();

    addMsg(data.reply, "bot");
}
