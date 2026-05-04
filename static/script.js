const chatbox = document.getElementById("chatbox");
const fileInput = document.getElementById("fileInput");
const previewBox = document.getElementById("previewBox");
const msgInput = document.getElementById("msg");

let selectedFile = null;

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
   ADD TEXT MESSAGE
========================= */
function addMsg(text, sender){
    let div = document.createElement("div");
    div.className = "msg " + sender;
    div.textContent = text;
    chatbox.appendChild(div);
    chatbox.scrollTop = chatbox.scrollHeight;
}

/* =========================
   ADD IMAGE MESSAGE
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

    // tampilkan pesan user
    if(msg) addMsg(msg, "user");

    if(selectedFile){
        let url = URL.createObjectURL(selectedFile);
        addImage(url, "user");
    }

    msgInput.value = "";
    previewBox.innerHTML = "";

    let formData = new FormData();
    formData.append("message", msg);

    if(selectedFile){
        formData.append("file", selectedFile);
    }

    selectedFile = null;

    // loading
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

    }catch{
        loading.remove();
        addMsg("❌ Error server", "bot");
    }
}
