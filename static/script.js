const chatbox = document.getElementById("chatbox");
const fileInput = document.getElementById("fileInput");
const previewBox = document.getElementById("previewBox");
const msg = document.getElementById("msg");

let selectedFile = null;

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
ADD MESSAGE
========================= */
function addMsg(text,sender){

let div=document.createElement("div");
div.className="msg "+sender;

if(sender==="bot"){
div.innerHTML=md(text);
}else{
div.textContent=text;
}

chatbox.appendChild(div);
chatbox.scrollTop=chatbox.scrollHeight;
}

/* =========================
OPEN FILE
========================= */
function openFile(){
fileInput.click();
}

/* =========================
PREVIEW IMAGE
========================= */
fileInput.onchange=function(){

let file=this.files[0];
if(!file) return;

selectedFile=file;

let reader=new FileReader();

reader.onload=function(e){

previewBox.innerHTML=`
<div class="preview-card">
<button class="remove-btn" onclick="removeFile()">✕</button>
<img src="${e.target.result}">
</div>
`;

};

reader.readAsDataURL(file);
};

/* =========================
REMOVE FILE
========================= */
function removeFile(){
selectedFile=null;
fileInput.value="";
previewBox.innerHTML="";
}

/* =========================
SEND MESSAGE
========================= */
async function sendMsg(){

let text=msg.value.trim();

if(!text && !selectedFile) return;

/* tampil user */
if(text){
addMsg(text,"user");
}

/* tampil gambar user */
if(selectedFile){

let reader=new FileReader();

reader.onload=function(e){

let div=document.createElement("div");
div.className="msg user";
div.innerHTML=`<img src="${e.target.result}">`;

chatbox.appendChild(div);
chatbox.scrollTop=chatbox.scrollHeight;

};

reader.readAsDataURL(selectedFile);
}

/* clear input */
msg.value="";

/* loading */
let loading=document.createElement("div");
loading.className="msg bot";
loading.innerHTML="NeuroMV is thinking...";
chatbox.appendChild(loading);

chatbox.scrollTop=chatbox.scrollHeight;

/* formdata */
let fd=new FormData();
fd.append("message",text);

if(selectedFile){
fd.append("file",selectedFile);
}

/* remove preview */
removeFile();

/* send to backend */
try{

let r=await fetch("/chat",{
method:"POST",
body:fd
});

let d=await r.json();

loading.remove();

addMsg(d.reply || "❌ Tidak ada respon.","bot");

}catch(err){

loading.remove();

addMsg("❌ Gagal menghubungi server.","bot");
}
}

/* =========================
ENTER SEND (PC ONLY)
========================= */
msg.addEventListener("keydown",function(e){

let isMobile = window.innerWidth <= 768;

if(e.key==="Enter" && !isMobile && !e.shiftKey){
e.preventDefault();
sendMsg();
}

});

/* =========================
BUTTON SEND SUPPORT
========================= */
window.sendMsg = sendMsg;
window.openFile = openFile;
window.removeFile = removeFile;
