const chatbox = document.getElementById("chatbox");
const fileInput = document.getElementById("fileInput");
const preview = document.getElementById("preview");
const msgInput = document.getElementById("msg");

/* Preview file */
fileInput.addEventListener("change", () => {
    if(fileInput.files.length > 0){
        preview.innerText = "📎 " + fileInput.files[0].name;
    } else {
        preview.innerText = "";
    }
});

/* Tambah bubble */
function addMsg(text, role){
    let div = document.createElement("div");
    div.className = "msg " + role;
    div.innerText = text;
    chatbox.appendChild(div);
    chatbox.scrollTop = chatbox.scrollHeight;
}

/* Kirim pesan */
async function sendMsg(){

    let msg = msgInput.value.trim();
    let file = fileInput.files[0];

    if(!msg && !file) return;

    if(msg){
        addMsg(msg, "user");
    }

    if(file){
        addMsg("📷 Upload gambar: " + file.name, "user");
    }

    msgInput.value = "";
    preview.innerText = "";

    let loading = document.createElement("div");
    loading.className = "msg bot";
    loading.id = "loading";
    loading.innerText = "NeuroMV sedang menganalisis...";
    chatbox.appendChild(loading);
    chatbox.scrollTop = chatbox.scrollHeight;

    let formData = new FormData();
    formData.append("message", msg);

    if(file){
        formData.append("file", file);
    }

    try{
        let res = await fetch("/chat", {
            method: "POST",
            body: formData
        });

        let data = await res.json();

        document.getElementById("loading").remove();

        addMsg(data.reply, "bot");

    }catch(err){

        document.getElementById("loading").remove();

        addMsg("❌ Gagal terhubung ke server.", "bot");
    }

    fileInput.value = "";
}

/* Enter untuk kirim */
msgInput.addEventListener("keypress", function(e){
    if(e.key === "Enter"){
        sendMsg();
    }
});
