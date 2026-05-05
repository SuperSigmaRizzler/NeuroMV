const chatbox = document.getElementById("chatbox");
const fileInput = document.getElementById("fileInput");
const previewBox = document.getElementById("previewBox");
const msg = document.getElementById("msg");

let selectedFile = null;

let chats = JSON.parse(localStorage.getItem("chats")) || [];
let currentChat = null;

/* =========================
   MARKDOWN RENDER
========================= */
function md(t){
return t
.replace(/`([^`]+)`/g,"<code>$1</code>")
.replace(/\*\*(.*?)\*\*/g,"<b>$1</b>")
.replace(/\_(.*?)\_/g,"<i>$1</i>")
.replace(/\n/g,"<br>");
}

/* =========================
   SAVE STORAGE
========================= */
function saveData(){
localStorage.setItem("chats", JSON.stringify(chats));
}

/* =========================
   HISTORY
========================= */
function renderHistory(){
const h = document.getElementById("history");
h.innerHTML = "";

chats.forEach(c=>{
let div = document.createElement("div");
div.className = "chat-item";

div.innerHTML = `
<span onclick="loadChat('${c.id}')">${c.title}</span>
<button onclick="deleteChat('${c.id}')">🗑️</button>
`;

h.appendChild(div);
});
}

/* =========================
   NEW CHAT
========================= */
function newChat(){

currentChat = Date.now().toString();

chats.unshift({
id: currentChat,
title: "💬 New Chat",
messages:[]
});

saveData();
renderHistory();
chatbox.innerHTML = "";
}

/* =========================
   DELETE CHAT
========================= */
function deleteChat(id){

chats = chats.filter(x=>x.id !== id);

saveData();
renderHistory();

if(currentChat === id){
currentChat = null;
chatbox.innerHTML = "";
}
}

/* =========================
   LOAD CHAT
========================= */
function loadChat(id){

currentChat = id;
chatbox.innerHTML = "";

let c = chats.find(x=>x.id === id);
if(!c) return;

c.messages.forEach(m=>{
addMsg(m.text, m.sender, false);
});
}

/* =========================
   ADD MESSAGE
========================= */
function addMsg(text, sender, save=true){

let div = document.createElement("div");
div.className = "msg " + sender;

if(sender === "bot"){
div.innerHTML = md(text);
}else{
div.textContent = text;
}

chatbox.appendChild(div);
chatbox.scrollTop = chatbox.scrollHeight;

/* save */
if(save && currentChat){
let c = chats.find(x=>x.id === currentChat);
if(c){
c.messages.push({
text:text,
sender:sender
});
saveData();
}
}
}

/* =========================
   FILE PICKER
========================= */
function openFile(){
fileInput.click();
}

/* =========================
   FILE PREVIEW
========================= */
fileInput.onchange = ()=>{

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
};

/* =========================
   REMOVE FILE
========================= */
function removeFile(){
selectedFile = null;
fileInput.value = "";
previewBox.innerHTML = "";
}

/* =========================
   SUMMARY TITLE
========================= */
async function makeTitle(text){

if(!currentChat) return;

let fd = new FormData();
fd.append("text", text);

try{

let r = await fetch("/summary",{
method:"POST",
body:fd
});

let d = await r.json();

let c = chats.find(x=>x.id === currentChat);

if(c){
c.title = d.title || "💬 New Chat";
saveData();
renderHistory();
}

}catch(err){}
}

/* =========================
   SEND MESSAGE
========================= */
async function sendMsg(){

let text = msg.value.trim();

if(!text && !selectedFile) return;

/* bikin chat baru */
if(!currentChat){
newChat();
}

/* simpan file dulu */
let fileToSend = selectedFile;

/* tampil pesan user */
if(text){
addMsg(text, "user");
makeTitle(text);
}

/* tampil gambar user */
if(fileToSend){

let url = URL.createObjectURL(fileToSend);

let div = document.createElement("div");
div.className = "msg user";
div.innerHTML = `<img src="${url}">`;

chatbox.appendChild(div);
chatbox.scrollTop = chatbox.scrollHeight;
}

/* clear input */
msg.value = "";

/* formdata */
let fd = new FormData();
fd.append("message", text);

if(fileToSend){
fd.append("file", fileToSend);
}

/* hapus preview setelah file aman */
removeFile();

/* =========================
   IMAGE GENERATION MODE
========================= */
let lower = text.toLowerCase();

if(
lower.startsWith("buat gambar") ||
lower.startsWith("generate image") ||
lower.startsWith("buatkan gambar")
){

let loading = document.createElement("div");
loading.className = "msg bot";
loading.innerHTML = `
<div class="loading-box">
🎨 Creating Image...
</div>
`;

chatbox.appendChild(loading);
chatbox.scrollTop = chatbox.scrollHeight;

try{

let r = await fetch("/generate-image",{
method:"POST",
body:fd
});

let d = await r.json();

loading.remove();

if(d.error){
addMsg(d.error, "bot");
return;
}

let div = document.createElement("div");
div.className = "msg bot";
div.innerHTML = `
<b>Image Created ✅</b><br><br>
<img src="${d.image}" style="opacity:0;transition:1s;">
`;

chatbox.appendChild(div);
chatbox.scrollTop = chatbox.scrollHeight;

/* fade in */
setTimeout(()=>{
div.querySelector("img").style.opacity = "1";
},100);

}catch(err){

loading.remove();
addMsg("❌ Gagal membuat gambar.", "bot");
}

return;
}

/* =========================
   NORMAL CHAT MODE
========================= */
let loading = document.createElement("div");
loading.className = "msg bot";
loading.innerHTML = "NeuroMV is thinking...";

chatbox.appendChild(loading);
chatbox.scrollTop = chatbox.scrollHeight;

try{

let r = await fetch("/chat",{
method:"POST",
body:fd
});

let d = await r.json();

loading.remove();

addMsg(d.reply || "❌ Tidak ada respon.", "bot");

}catch(err){

loading.remove();
addMsg("❌ Gagal terhubung ke server.", "bot");
}
}

/* =========================
   ENTER TO SEND
========================= */
msg.addEventListener("keydown",(e)=>{

if(e.key === "Enter"){
e.preventDefault();
sendMsg();
}

});

/* =========================
   AUTO LOAD
========================= */
renderHistory();
