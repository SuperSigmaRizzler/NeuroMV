let chatbox = document.getElementById("chatbox");
let history = document.getElementById("history");

function addMessage(text, cls){
    chatbox.innerHTML += `<div class="msg ${cls}">${text}</div>`;
    chatbox.scrollTop = chatbox.scrollHeight;
}

function typingEffect(text){
    let div = document.createElement("div");
    div.className = "msg bot";
    chatbox.appendChild(div);

    let i = 0;
    let interval = setInterval(()=>{
        div.innerHTML += text.charAt(i);
        i++;
        chatbox.scrollTop = chatbox.scrollHeight;

        if(i >= text.length){
            clearInterval(interval);
        }
    },20);
}

async function sendMsg(){
    let input = document.getElementById("msg");
    let msg = input.value.trim();

    if(!msg) return;

    addMessage(msg,"user");
    saveHistory(msg);

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

    typingEffect(data.reply);
}

function saveHistory(text){
    let div = document.createElement("div");
    div.className="history-item";
    div.innerText=text.substring(0,25);
    history.prepend(div);
}

function newChat(){
    chatbox.innerHTML="";
}
