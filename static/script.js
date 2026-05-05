const form = document.getElementById("chat-form");
const input = document.getElementById("message");
const chatBox = document.getElementById("chat-box");
const fileInput = document.getElementById("file-input");
const previewBox = document.getElementById("preview-box");

// ENTER SEND (PC)
document.addEventListener("keydown", (e) => {
  if (window.innerWidth > 768 && e.key === "Enter" && !e.shiftKey) {
    if (document.activeElement === input) {
      e.preventDefault();
      form.requestSubmit();
    }
  }
});

// AUTO RESIZE
input.addEventListener("input", () => {
  input.style.height = "auto";
  input.style.height = input.scrollHeight + "px";
});

// PREVIEW
fileInput.addEventListener("change", () => {
  previewBox.innerHTML = "";
  const file = fileInput.files[0];
  if (!file) return;

  const img = document.createElement("img");
  img.src = URL.createObjectURL(file);
  img.className = "preview-image";
  previewBox.appendChild(img);
});

// SEND
form.addEventListener("submit", async (e) => {
  e.preventDefault();

  const msg = input.value.trim();
  const file = fileInput.files[0];

  if (!msg && !file) return;

  addMessage(msg, "user", file);

  input.value = "";
  previewBox.innerHTML = "";

  const fd = new FormData();
  fd.append("message", msg);
  if (file) fd.append("file", file);

  const res = await fetch("/chat", {
    method: "POST",
    body: fd
  });

  const data = await res.json();

  if (data.type === "text") typeEffect(data.reply);
  if (data.type === "image") createImage(data.url);

  scrollBottom();
});

// USER MESSAGE
function addMessage(text, sender, file=null) {
  const div = document.createElement("div");
  div.className = sender;

  if (text) {
    const p = document.createElement("p");
    p.textContent = text;
    div.appendChild(p);
  }

  if (file) {
    const img = document.createElement("img");
    img.src = URL.createObjectURL(file);
    img.className = "chat-image";
    div.appendChild(img);
  }

  chatBox.appendChild(div);
}

// TYPING
function typeEffect(text) {
  const div = document.createElement("div");
  div.className = "bot";

  const p = document.createElement("p");
  div.appendChild(p);
  chatBox.appendChild(div);

  let i = 0;
  function typing() {
    if (i < text.length) {
      p.textContent += text[i++];
      setTimeout(typing, 10);
    }
  }
  typing();
}

// IMAGE
function createImage(url) {
  const div = document.createElement("div");
  div.className = "bot";

  const status = document.createElement("p");
  status.textContent = "🎨 Creating Image...";

  const img = document.createElement("img");
  img.className = "chat-image";
  img.style.display = "none";

  div.appendChild(status);
  div.appendChild(img);
  chatBox.appendChild(div);

  let retry = 0;

  function load() {
    img.src = url + "?t=" + Date.now();

    img.onload = () => {
      status.textContent = "Image Created ✅";
      img.style.display = "block";
    };

    img.onerror = () => {
      retry++;
      if (retry < 5) {
        status.textContent = "Retrying...";
        setTimeout(load, 1500);
      } else {
        status.textContent = "❌ Gagal generate image";
      }
    };
  }

  load();
}

// SCROLL
function scrollBottom() {
  chatBox.scrollTop = chatBox.scrollHeight;
}
