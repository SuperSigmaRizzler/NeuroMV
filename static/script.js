let chats = JSON.parse(localStorage.getItem("chats")) || {};
let currentChat = localStorage.getItem("current_chat");

/* init */
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

/* switch chat */
function switchChat(name){
    currentChat = name;
    localStorage.setItem("current_chat", name);
    document.getElementById("chatbox").innerHTML = chats[name] || "";
}

/* new chat */
function newChat(){
    let name = "Chat " + (Object.keys(chats).length + 1);
    chats[name] = "";
    saveAll();
    renderChats();
    switchChat(name);
}

/* save */
function saveAll(){
    chats[currentChat] = document.getElementById("chatbox").innerHTML;
    localStorage.setItem("chats", JSON.stringify(chats));
    localStorage.setItem("current_chat", currentChat);
}

/* load */
window.onload = () => {
    renderChats();
    switchChat(currentChat);
};

/* add message */
function addMsg(text, role){
    let div = document.createElement("div");
    div.className = "msg " + role;
    div.innerText = text;
    document.getElementById("chatbox").appendChild(div);
    saveAll();
}

/* send */
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

/* reset */
async function clearChat(){
    await fetch("/clear", {method:"POST"});
    document.getElementById("chatbox").innerHTML = "";
    localStorage.removeItem("chats");
}
