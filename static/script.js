const chatbox = document.getElementById("chatbox");
const fileInput = document.getElementById("fileInput");
const previewBox = document.getElementById("previewBox");
const msg = document.getElementById("msg");

let selectedFile = null;

let chats = JSON.parse(localStorage.getItem("chats")) || [];
let currentChat = null;

/* markdown */
function md(t){
return t
.replace(/`([^`]+)`/g,"<code>$1</code>")
.replace(/\*\*(.*?)\*\*/g,"<b>$1</b>")
.replace(/\_(.*?)\_/g,"<i>$1</i>")
.replace(/\n/g,"<br>");
}

/* save */
function saveData(){
localStorage.setItem("chats",JSON.stringify(chats));
}

/* render history */
function renderHistory(){
let h = document.getElementById("history");
h.innerHTML = "";

chats.forEach(c=>{
let div = document.createElement("div");
div.className="chat-item";

div.innerHTML=`
<span onclick="loadChat('${c.id}')">${c.title}</span>
<button onclick="deleteChat('${c.id}')">🗑️</button>
`;

h.appendChild(div);
});
}

/* new chat */
function newChat(){
currentChat = Date.now().toString();

chats.unshift({
id:currentChat,
title:"💬 New Chat",
messages:[]
});

saveData();
renderHistory();
chatbox.innerHTML="";
}

/* delete */
function deleteChat(id){
chats = chats.filter(x=>x.id!==id);
saveData();
renderHistory();
chatbox.innerHTML="";
}

/* load */
function loadChat(id){
currentChat=id;
chatbox.innerHTML="";

let c = chats.find(x=>x.id===id);

c.messages.forEach(m=>{
addMsg(m.text,m.sender,false);
});
}

/* add msg */
function addMsg(text,sender,save=true){

let div = document.createElement("div");
div.className="msg "+sender;

if(sender==="bot"){
div.innerHTML = md(text);
}else{
div.textContent = text;
}

chatbox.appendChild(div);
chatbox.scrollTop=chatbox.scrollHeight;

if(save && currentChat){
let c = chats.find(x=>x.id===currentChat);
c.messages.push({text,sender});
saveData();
}
}

/* preview */
function openFile(){
fileInput.click();
}

fileInput.onchange=()=>{
if(fileInput.files.length>0){
selectedFile=fileInput.files[0];

let url = URL.createObjectURL(selectedFile);

previewBox.innerHTML=`
<div class="preview-card">
<button class="remove-btn" onclick="removeFile()">✕</button>
<img src="${url}">
</div>
`;
}
};

function removeFile(){
selectedFile=null;
fileInput.value="";
previewBox.innerHTML="";
}

/* summary title */
async function makeTitle(text){

if(!currentChat) return;

let fd = new FormData();
fd.append("text",text);

let r = await fetch("/summary",{method:"POST",body:fd});
let d = await r.json();

let c = chats.find(x=>x.id===currentChat);
c.title=d.title;

saveData();
renderHistory();
}

/* send */
async function sendMsg(){

let text = msg.value.trim();

if(!text && !selectedFile) return;

if(!currentChat) newChat();

if(text){
addMsg(text,"user");
makeTitle(text);
}

if(selectedFile){
let url = URL.createObjectURL(selectedFile);

let div = document.createElement("div");
div.className="msg user";
div.innerHTML=`<img src="${url}">`;
chatbox.appendChild(div);
}

msg.value="";

let fd = new FormData();
fd.append("message",text);

if(selectedFile){
fd.append("file",selectedFile);
}

removeFile();

/* image request detect */
if(text.toLowerCase().startsWith("buat gambar") || text.toLowerCase().startsWith("generate image")){

let box = document.createElement("div");
box.className="msg bot";
box.innerHTML=`<div class="loading-box">🎨 Creating Image...</div>`;
chatbox.appendChild(box);

let res = await fetch("/generate-image",{method:"POST",body:fd});
let data = await res.json();

box.remove();

if(data.error){
addMsg(data.error,"bot");
return;
}

let div = document.createElement("div");
div.className="msg bot";
div.innerHTML=`
<b>Image Created ✅</b><br><br>
<img src="${data.image}">
`;

chatbox.appendChild(div);
chatbox.scrollTop=chatbox.scrollHeight;

return;
}

/* normal chat */
let loading = document.createElement("div");
loading.className="msg bot";
loading.innerHTML="NeuroMV is thinking...";
chatbox.appendChild(loading);

let res = await fetch("/chat",{method:"POST",body:fd});
let data = await res.json();

loading.remove();

addMsg(data.reply,"bot");
}

/* enter */
msg.addEventListener("keydown",(e)=>{
if(e.key==="Enter"){
e.preventDefault();
sendMsg();
}
});

renderHistory();
