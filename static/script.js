/* =========================
FULL FIX static/script.js
SEND + ENTER + GENERATE + HISTORY
========================= */

const chatbox = document.getElementById("chatbox");
const msg = document.getElementById("msg");
const fileInput = document.getElementById("fileInput");
const previewBox = document.getElementById("previewBox");
const historyBox = document.getElementById("history");

let selectedFile = null;
let currentChatId = null;
let chats = JSON.parse(localStorage.getItem("neuromv_chats")) || [];

/* =========================
MARKDOWN
========================= */
function md(t){
return t
.replace(/`([^`]+)`/g,"<code>$1</code>")
.replace(/\*\*(.*?)\*\*/g,"<b>$1</b>")
.replace(/\_(.*?)\_/g,"<i>$1</i>")
.replace(/\n/g,"<br>");
}

/* =========================
SAVE
========================= */
function saveChats(){
localStorage.setItem("neuromv_chats", JSON.stringify(chats));
}

/* =========================
TITLE
========================= */
function smartTitle(text){
text = text.trim();
if(text.length <= 18) return "💬 " + text;
return "💬 " + text.substring(0,18) + "...";
}

/* =========================
NEW CHAT
========================= */
function newChat(){

const id = Date.now().toString();

chats.unshift({
id:id,
title:"💬 New Chat",
messages:[]
});

currentChatId = id;

saveChats();
renderHistory();
renderMessages();
}

/* =========================
DELETE CHAT
========================= */
function deleteChat(id){

chats = chats.filter(c => c.id !== id);

if(currentChatId === id){
currentChatId = null;
chatbox.innerHTML = "";
}

saveChats();
renderHistory();
}

/* =========================
LOAD CHAT
========================= */
function loadChat(id){
currentChatId = id;
renderHistory();
renderMessages();
}

/* =========================
HISTORY
========================= */
function renderHistory(){

historyBox.innerHTML = "";

chats.forEach(chat => {

let div = document.createElement("div");
div.className = "chat-item";

if(chat.id === currentChatId){
div.classList.add("active");
}

div.innerHTML = `
<span onclick="loadChat('${chat.id}')">${chat.title}</span>
<button onclick="deleteChat('${chat.id}')">✕</button>
`;

historyBox.appendChild(div);

});
}

/* =========================
TYPEWRITER
========================= */
function typeWriter(el, html){

let i = 0;

function tick(){

if(i <= html.length){
el.innerHTML = html.slice(0,i);
chatbox.scrollTop = chatbox.scrollHeight;
i++;
setTimeout(tick,10);
}

}

tick();
}

/* =========================
RENDER
========================= */
function renderMessages(){

chatbox.innerHTML = "";

let chat = chats.find(c => c.id === currentChatId);
if(!chat) return;

chat.messages.forEach((m,index)=>{

let div = document.createElement("div");
div.className = "msg " + m.role;

if(m.role === "bot" && index === chat.messages.length - 1){

div.innerHTML = "";
chatbox.appendChild(div);
typeWriter(div, md(m.text));

}else{

if(m.role === "bot"){
div.innerHTML = md(m.text);
}else{
div.textContent = m.text;
}

chatbox.appendChild(div);

}

});

chatbox.scrollTop = chatbox.scrollHeight;
}

/* =========================
ADD MESSAGE
========================= */
function addMessage(role,text){

let chat = chats.find(c => c.id === currentChatId);
if(!chat) return;

chat.messages.push({
role:role,
text:text
});

if(chat.title === "💬 New Chat" && role === "user"){
chat.title = smartTitle(text);
}

saveChats();
renderHistory();
renderMessages();
}

/* =========================
UPLOAD
========================= */
function openFile(){
fileInput.click();
}

fileInput.onchange = function(){

let file = this.files[0];
if(!file) return;

selectedFile = file;

let reader = new FileReader();

reader.onload = function(e){

previewBox.innerHTML = `
<div class="preview-card">
<img src="${e.target.result}">
<button onclick="removeFile()">✕</button>
</div>
`;

};

reader.readAsDataURL(file);
};

function removeFile(){
selectedFile = null;
fileInput.value = "";
previewBox.innerHTML = "";
}

/* =========================
SEND MESSAGE
========================= */
async function sendMsg(){

let text = msg.value.trim();

if(!text && !selectedFile) return;

if(!currentChatId){
newChat();
}

if(text){
addMessage("user", text);
}

msg.value = "";

/* loading */
let loading = document.createElement("div");
loading.className = "msg bot";
loading.innerHTML = "NeuroMV is thinking...";
chatbox.appendChild(loading);
chatbox.scrollTop = chatbox.scrollHeight;

/* form */
let fd = new FormData();
fd.append("message", text);

if(selectedFile){
fd.append("file", selectedFile);
}

/* detect image generate */
let lower = text.toLowerCase();

let isGenerate =
lower.startsWith("buat gambar") ||
lower.startsWith("buatkan gambar") ||
lower.startsWith("buat foto") ||
lower.startsWith("buatkan foto") ||
lower.startsWith("generate image") ||
lower.startsWith("generate foto") ||
lower.startsWith("create image");

/* remove preview after collect */
removeFile();

/* =========================
GENERATE IMAGE
========================= */
if(isGenerate){

try{

loading.innerHTML = "🎨 Creating Image...";

let r = await fetch("/generate-image",{
method:"POST",
body:fd
});

let d = await r.json();

if(d.error){
loading.remove();
addMessage("bot", d.error);
return;
}

let img = new Image();

img.onload = function(){

loading.remove();

addMessage("bot", `
<b>Image Created ✅</b><br><br>
<img src="${d.image}" class="chat-image fade-in-img">
`);

};

img.onerror = function(){
loading.remove();
addMessage("bot","❌ Gagal load gambar.");
};

img.src = d.image;

}catch(err){

loading.remove();
addMessage("bot","❌ Gagal generate image.");

}

return;
}

/* =========================
NORMAL CHAT
========================= */
try{

let r = await fetch("/chat",{
method:"POST",
body:fd
});

let d = await r.json();

loading.remove();

addMessage("bot", d.reply || "❌ Tidak ada respon.");

}catch(err){

loading.remove();
addMessage("bot","❌ Gagal koneksi server.");

}

}

/* =========================
ENTER SEND PC ONLY
========================= */
msg.addEventListener("keydown", function(e){

let isMobile = window.innerWidth <= 768;

if(e.key === "Enter" && !isMobile && !e.shiftKey){
e.preventDefault();
sendMsg();
}

});

/* =========================
GLOBAL
========================= */
window.sendMsg = sendMsg;
window.newChat = newChat;
window.loadChat = loadChat;
window.deleteChat = deleteChat;
window.openFile = openFile;
window.removeFile = removeFile;

/* =========================
INIT
========================= */
renderHistory();

if(chats.length > 0){
currentChatId = chats[0].id;
renderHistory();
renderMessages();
}
