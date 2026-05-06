let chats=[], privates=[], current=null;
let hasStarted=false;
let isLoading=false;

const chat=document.getElementById("chat");
const form=document.getElementById("form");
const input=document.getElementById("input");
const file=document.getElementById("file");
const preview=document.getElementById("preview");

function newChat(){
  const id="c"+Date.now();
  chats.unshift({id,title:"New Chat",msg:[]});
  current=id;
  hasStarted=false;
  render();
}

function render(){
  chat.innerHTML="";
  let c=chats.find(x=>x.id===current);
  if(!c) return;
  c.msg.forEach(m=>bubble(m.t,m.r,false));
}

function bubble(t,r,save=true){
  let d=document.createElement("div");
  d.className=r;

  let p=document.createElement("p");
  p.textContent=t;

  d.appendChild(p);
  chat.appendChild(d);

  if(save){
    let c=chats.find(x=>x.id===current);
    c.msg.push({t,r});
  }
}

function submitPin(){
  fetch("/verify_pin",{
    method:"POST",
    headers:{"Content-Type":"application/json"},
    body:JSON.stringify({pin:pinInput.value})
  }).then(r=>r.json()).then(d=>{
    if(d.ok) pinModal.classList.add("hidden");
    else alert("Wrong PIN");
  });
}

form.onsubmit=async(e)=>{
  e.preventDefault();
  if(isLoading) return;

  let msg=input.value.trim();
  if(!msg && !file.files[0]) return;

  if(!hasStarted) hasStarted=true;

  bubble(msg||"[file]","user");

  input.value="";
  file.value="";
  preview.innerHTML="";

  let res=await fetch("/chat",{
    method:"POST",
    body:new FormData(form)
  });

  let d=await res.json();

  if(d.type==="text") bubble(d.reply,"bot");

  if(d.type==="image"){
    let d1=document.createElement("div");
    let img=document.createElement("img");
    img.src=d.url;
    d1.appendChild(img);
    chat.appendChild(d1);
  }
};

file.onchange=()=>{
  preview.innerHTML="";
  let f=file.files[0];
  if(!f) return;

  let img=document.createElement("img");
  img.src=URL.createObjectURL(f);
  preview.appendChild(img);
};

newChat();
