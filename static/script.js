const fileInput = document.getElementById("fileInput");
const previewBox = document.getElementById("previewBox");

let selectedFile = null;

/* OPEN FILE */
function openFile(){
    fileInput.click();
}

/* PREVIEW IMAGE */
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

/* REMOVE FILE */
function removeFile(){
    selectedFile = null;
    fileInput.value = "";
    previewBox.innerHTML = "";
}

/* SEND MESSAGE */
async function sendMsg(){
    let msg = document.getElementById("msg").value.trim();

    if(!msg && !selectedFile) return;

    if(msg) addMsg(msg, "user");

    if(selectedFile){
        let url = URL.createObjectURL(selectedFile);
        addImage(url, "user");
    }

    document.getElementById("msg").value = "";
    previewBox.innerHTML = "";

    let formData = new FormData();
    formData.append("message", msg);

    if(selectedFile){
        formData.append("file", selectedFile);
    }

    selectedFile = null;

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
        addMsg("Error server 😭", "bot");
    }
}
