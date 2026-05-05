const form = document.getElementById("chat-form");
const input = document.getElementById("message");
const chatBox = document.getElementById("chat-box");
const fileInput = document.getElementById("file-input");
const previewBox = document.getElementById("preview-box");

// =====================
// ENTER = SEND (PC ONLY, ROBUST)
// =====================
document.addEventListener("keydown", function (e) {
    const isDesktop = window.innerWidth > 768;

    // hanya aktif kalau fokus di input/textarea message
    const active = document.activeElement;
    const inMessageBox =
        active === input ||
        (active && (active.id === "message" || active.closest("#message")));

    if (!isDesktop) return;
    if (!inMessageBox) return;
    if (e.key !== "Enter") return;
    if (e.shiftKey) return; // shift+enter = newline

    e.preventDefault();

    if (form) {
        // paling reliable
        if (typeof form.requestSubmit === "function") {
            form.requestSubmit();
        } else {
            // fallback lama
            form.dispatchEvent(new Event("submit", { cancelable: true }));
        }
    }
});

// =====================
// FILE PREVIEW
// =====================
if (fileInput && previewBox) {
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
}

// =====================
// SEND MESSAGE
// =====================
if (form) {
    form.addEventListener("submit", async (e) => {
        e.preventDefault();

        const msg = (input?.value || "").trim();
        const file = fileInput?.files?.[0];

        if (!msg && !file) return;

        addMessage(msg, "user", file);

        if (input) input.value = "";
        if (previewBox) previewBox.innerHTML = "";

        const formData = new FormData();
        formData.append("message", msg);
        if (file) formData.append("file", file);

        let data;
        try {
            const res = await fetch("/chat", {
                method: "POST",
                body: formData
            });
            data = await res.json();
        } catch (err) {
            addBotText("❌ Network error");
            return;
        }

        // TEXT
        if (data.type === "text") {
            typeEffect(data.reply || "");
        }

        // IMAGE
        if (data.type === "image") {
            createImage(data.url);
        }

        scrollBottom();
    });
}

// =====================
// ADD USER MESSAGE
// =====================
function addMessage(text, sender, file = null) {
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
    scrollBottom();
}

// =====================
// BOT TEXT (NO TYPING)
// =====================
function addBotText(text) {
    const div = document.createElement("div");
    div.className = "bot";
    const p = document.createElement("p");
    p.textContent = text;
    div.appendChild(p);
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
            p.textContent += text.charAt(i);
            i++;
            setTimeout(typing, 15);
        }
    }
    typing();
    scrollBottom();
}

// =====================
// IMAGE GENERATE (RETRY)
// =====================
function createImage(url) {
    const wrapper = document.createElement("div");
    wrapper.className = "bot";

    const status = document.createElement("p");
    status.textContent = "🎨 Creating Image...";

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
            status.textContent = "Image Created ✅";
            img.style.display = "block";
        };

        img.onerror = () => {
            retry++;
            if (retry < 6) {
                status.textContent = "Retrying... " + retry;
                setTimeout(loadImage, 1500);
            } else {
                status.textContent = "❌ Gagal generate image";
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
    if (!chatBox) return;
    chatBox.scrollTop = chatBox.scrollHeight;
}
