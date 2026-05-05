const chatbox = document.getElementById("chatbox");
const msg = document.getElementById("msg");
const fileInput = document.getElementById("fileInput");
const previewBox = document.getElementById("previewBox");
const historyBox = document.getElementById("history");

let selectedFile = null;
let currentChatId = null;

/* =========================
   STORAGE
========================= */
let chats = JSON.parse(localStorage.getItem("neuromv_chats")) || [];

/* =========================
   MARKDOWN
========================= */
function md(text){
return text
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
   NEW CHAT
========================= */
function newChat(){

const id = Date.now().toString();

const obj = {
id:id,
title:"💬 New Chat",
messages:[]
};

chats.unshift(obj);
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
   MESSAGES
========================= */
function renderMessages(){

chatbox.innerHTML = "";

let chat = chats.find(c => c.id === currentChatId);
if(!chat) return;

chat.messages.forEach(m => {

let div = document.createElement("div");
div.className = "msg " + m.role;

if(m.role === "bot"){
div.innerHTML = md(m.text);
}else{
div.textContent = m.text;
}

chatbox.appendChild(div);

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
   SMART TITLE
========================= */
function smartTitle(text){

text = text.trim();

if(text.length <= 18) return "💬 " + text;

return "💬 " + text.substring(0,18) + "...";
}

/* =========================
   FILE OPEN
========================= */
function openFile(){
fileInput.click();
}

/* =========================
   PREVIEW
========================= */
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

/* =========================
   REMOVE FILE
========================= */
function removeFile(){
selectedFile = null;
fileInput.value = "";
previewBox.innerHTML = "";
}

/* =========================
   SEND
========================= */
async function sendMsg(){

let text = msg.value.trim();

if(!text && !selectedFile) return;

if(!currentChatId){
newChat();
}

/* user message */
if(text){
addMessage("user", text);
}

/* show uploaded image bubble */
if(selectedFile){

let reader = new FileReader();

reader.onload = function(e){

let div = document.createElement("div");
div.className = "msg user";
div.innerHTML = `<img src="${e.target.result}" class="chat-image">`;

chatbox.appendChild(div);
chatbox.scrollTop = chatbox.scrollHeight;

};

reader.readAsDataURL(selectedFile);
}

/* clear */
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

removeFile();

/* image generation detect */
let lower = text.toLowerCase();

if(
lower.startsWith("buat gambar") ||
lower.startsWith("buatkan gambar") ||
lower.startsWith("generate image")
){

try{

loading.innerHTML = "🎨 Creating Image...";

let r = await fetch("/generate-image",{
method:"POST",
body:fd
});

let d = await r.json();

loading.remove();

if(d.error){
addMessage("bot", d.error);
return;
}

let html = `
<b>Image Created ✅</b><br><br>
<img src="${d.image}" class="chat-image">
`;

addMessage("bot", html);

}catch(err){
loading.remove();
addMessage("bot","❌ Gagal membuat gambar.");
}

return;
}

/* normal chat */
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
