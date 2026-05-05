const form = document.getElementById("chat-form");
const input = document.getElementById("message");
const chatBox = document.getElementById("chat-box");
const fileInput = document.getElementById("file-input");
const previewBox = document.getElementById("preview-box");

// =====================
// ENTER = SEND (PC ONLY)
// =====================
input.addEventListener("keydown", function(e) {
    if (window.innerWidth > 768 && e.key === "Enter" && !e.shiftKey) {
        e.preventDefault();
        form.dispatchEvent(new Event("submit"));
    }
});

// =====================
// FILE PREVIEW
// =====================
fileInput.addEventListener("change", () => {
    previewBox.innerHTML = "";

    const file = fileInput.files[0];
    if (!file) return;

    const img = document.createElement("img");
    img.src = URL.createObjectURL(file);
    img.className = "preview-image";

    const remove = document.createElement("button");
    remove.innerText = "✖";
    remove.onclick = () => {
        fileInput.value = "";
        previewBox.innerHTML = "";
    };

    previewBox.appendChild(img);
    previewBox.appendChild(remove);
});

// =====================
// SEND MESSAGE
// =====================
form.addEventListener("submit", async (e) => {
    e.preventDefault();

    const msg = input.value.trim();
    const file = fileInput.files[0];

    if (!msg && !file) return;

    addMessage(msg, "user", file);

    input.value = "";
    previewBox.innerHTML = "";

    const formData = new FormData();
    formData.append("message", msg);
    if (file) formData.append("file", file);

    const res = await fetch("/chat", {
        method: "POST",
        body: formData
    });

    const data = await res.json();

    // =====================
    // TEXT RESPONSE
    // =====================
    if (data.type === "text") {
        typeEffect(data.reply);
    }

    // =====================
    // IMAGE RESPONSE
    // =====================
    if (data.type === "image") {
        createImage(data.url);
    }

    scrollBottom();
});

// =====================
// ADD USER MESSAGE
// =====================
function addMessage(text, sender, file=null) {
    const div = document.createElement("div");
    div.className = sender;

    if (text) {
        const p = document.createElement("p");
        p.innerText = text;
        div.appendChild(p);
    }

    if (file) {
        const img = document.createElement("img");
        img.src = URL.createObjectURL(file);
        img.className = "chat-image";
        div.appendChild(img);
    }

    chatBox.appendChild(div);
    scrollBottom();
}

// =====================
// TYPING EFFECT
// =====================
function typeEffect(text) {
    const div = document.createElement("div");
    div.className = "bot";

    const p = document.createElement("p");
    div.appendChild(p);

    chatBox.appendChild(div);

    let i = 0;

    function typing() {
        if (i < text.length) {
            p.innerHTML += text.charAt(i);
            i++;
            setTimeout(typing, 15);
        }
    }

    typing();
    scrollBottom();
}

// =====================
// IMAGE GENERATE (FIX)
// =====================
function createImage(url) {

    const wrapper = document.createElement("div");
    wrapper.className = "bot";

    const status = document.createElement("p");
    status.innerText = "🎨 Creating Image...";

    const img = document.createElement("img");
    img.className = "chat-image";
    img.style.display = "none";

    wrapper.appendChild(status);
    wrapper.appendChild(img);
    chatBox.appendChild(wrapper);

    let retry = 0;

    function loadImage() {
        img.src = url + "?t=" + Date.now();

        img.onload = () => {
            status.innerText = "Image Created ✅";
            img.style.display = "block";
        };

        img.onerror = () => {
            retry++;
            if (retry < 6) {
                status.innerText = "Retrying... " + retry;
                setTimeout(loadImage, 1500);
            } else {
                status.innerText = "❌ Gagal generate image";
            }
        };
    }

    loadImage();
    scrollBottom();
}

// =====================
// SCROLL
// =====================
function scrollBottom() {
    chatBox.scrollTop = chatBox.scrollHeight;
}
