async function sendMsg(){
    let msg = document.getElementById("msg").value;
    let file = document.getElementById("fileInput").files[0];

    if(!msg && !file) return;

    let formData = new FormData();

    formData.append("message", msg);

    if(file){
        formData.append("file", file);

        let url = URL.createObjectURL(file);
        addMsgUI("[image uploaded]", "user");
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

function addMsgUI(text, role){
    let div = document.createElement("div");
    div.className = "msg " + role;
    div.innerText = text;
    document.getElementById("chatbox").appendChild(div);
}
