// ==============================
// NeuroMV FINAL script.js
// Full Feature Stable Edition
// ==============================

// ---------- SAFE STORAGE ----------
function loadChats() {
    try {
        const data = JSON.parse(localStorage.getItem("neuromv_chats"));
        return Array.isArray(data) ? data : [];
    } catch {
        return [];
    }
}

let chats = loadChats();
let currentChatId = null;

// ---------- ELEMENTS ----------
const form = document.getElementById("chat-form");
const input = document.getElementById("message");
const chatBox = document.getElementById("chat-box");
const historyBox = document.getElementById("history");
const fileInput = document.getElementById("file-input");
const previewBox = document.getElementById("preview-box");
const newChatBtn = document.querySelector(".new-chat");

// ---------- SAVE ----------
function saveChats() {
    localStorage.setItem("neuromv_chats", JSON.stringify(chats));
}

// ---------- NEW CHAT ----------
function createChat() {
    const id = Date.now();

    chats.unshift({
        id,
        title: "New Chat",
        messages: []
    });

    currentChatId = id;
    saveChats();
    renderHistory();
    renderChat();
}

newChatBtn.onclick = createChat;

// ---------- HISTORY ----------
function renderHistory() {
    historyBox.innerHTML = "";

    chats.forEach(chat => {
        const item = document.createElement("div");
        item.className = "history-item";

        if (chat.id === currentChatId) {
            item.classList.add("active");
        }

        const title = document.createElement("span");
        title.textContent = chat.title;

        const del = document.createElement("button");
        del.className = "delete-chat";
        del.textContent = "✖";

        del.onclick = (e) => {
            e.stopPropagation();

            chats = chats.filter(c => c.id !== chat.id);

            if (currentChatId === chat.id) {
                currentChatId = chats[0]?.id || null;
            }

            saveChats();
            renderHistory();
            renderChat();
        };

        item.onclick = () => {
            currentChatId = chat.id;
            renderHistory();
            renderChat();
        };

        item.appendChild(title);
        item.appendChild(del);
        historyBox.appendChild(item);
    });
}

// ---------- TITLE ----------
function generateTitle(text) {
    text = text.trim();

    if (text.length <= 25) return text;
    return text.slice(0, 25) + "...";
}

// ---------- RENDER CHAT ----------
function renderChat() {
    chatBox.innerHTML = "";

    const chat = chats.find(c => c.id === currentChatId);
    if (!chat) return;

    chat.messages.forEach(msg => {
        if (msg.type === "image") {
            addImage(msg.url, msg.role, false);
        } else {
            addMessage(msg.text, msg.role, false);
        }
    });

    scrollBottom();
}

// ---------- SAVE MESSAGE ----------
function pushMessage(role, type, payload) {
    const chat = chats.find(c => c.id === currentChatId);
    if (!chat) return;

    if (type === "text") {
        chat.messages.push({
            role,
            type,
            text: payload
        });
    }

    if (type === "image") {
        chat.messages.push({
            role,
            type,
            url: payload
        });
    }

    if (chat.messages.length === 1 && type === "text") {
        chat.title = generateTitle(payload);
    }

    saveChats();
    renderHistory();
}

// ---------- TEXT BUBBLE ----------
function addMessage(text, role = "bot", save = true) {
    const wrap = document.createElement("div");
    wrap.className = role;

    const p = document.createElement("p");
    p.textContent = text;

    wrap.appendChild(p);
    chatBox.appendChild(wrap);

    if (save) pushMessage(role, "text", text);

    scrollBottom();
}

// ---------- TYPING EFFECT ----------
async function typeMessage(text) {
    const wrap = document.createElement("div");
    wrap.className = "bot";

    const p = document.createElement("p");
    wrap.appendChild(p);

    chatBox.appendChild(wrap);

    let i = 0;

    const speed = 12;

    while (i < text.length) {
        p.textContent += text[i];
        i++;
        scrollBottom();
        await new Promise(r => setTimeout(r, speed));
    }

    pushMessage("bot", "text", text);
}

// ---------- IMAGE ----------
function addImage(url, role = "bot", save = true) {
    const wrap = document.createElement("div");
    wrap.className = role;

    const img = document.createElement("img");
    img.src = url;
    img.className = "chat-image";

    wrap.appendChild(img);
    chatBox.appendChild(wrap);

    if (save) pushMessage(role, "image", url);

    scrollBottom();
}

// ---------- PREVIEW FILE ----------
if (fileInput) {
    fileInput.onchange = () => {
        previewBox.innerHTML = "";

        const file = fileInput.files[0];
        if (!file) return;

        const wrap = document.createElement("div");
        wrap.className = "preview-wrapper";

        const img = document.createElement("img");
        img.src = URL.createObjectURL(file);
        img.className = "preview-image";

        const remove = document.createElement("button");
        remove.className = "remove-btn";
        remove.textContent = "✖";

        remove.onclick = () => {
            fileInput.value = "";
            previewBox.innerHTML = "";
        };

        wrap.appendChild(img);
        wrap.appendChild(remove);
        previewBox.appendChild(wrap);
    };
}

// ---------- SEND ----------
form.addEventListener("submit", async (e) => {
    e.preventDefault();

    const msg = input.value.trim();
    const file = fileInput?.files?.[0];

    if (!msg && !file) return;

    addMessage(msg, "user");

    input.value = "";
    input.style.height = "auto";

    if (fileInput) fileInput.value = "";
    if (previewBox) previewBox.innerHTML = "";

    const thinking = document.createElement("div");
    thinking.className = "bot";
    thinking.id = "thinking-box";
    thinking.innerHTML = `<p>NeuroMV is thinking...</p>`;
    chatBox.appendChild(thinking);

    scrollBottom();

    try {
        const fd = new FormData();
        fd.append("message", msg);
        if (file) fd.append("file", file);

        const res = await fetch("/chat", {
            method: "POST",
            body: fd
        });

        const data = await res.json();

        document.getElementById("thinking-box")?.remove();

        if (data.type === "text") {
            await typeMessage(data.reply);
        }

        if (data.type === "image") {
            addImage(data.url, "bot");
        }

    } catch (err) {
        document.getElementById("thinking-box")?.remove();
        addMessage("❌ Gagal connect ke server", "bot");
    }
});

// ---------- ENTER SEND ----------
input.addEventListener("keydown", (e) => {
    if (e.key === "Enter" && !e.shiftKey) {
        e.preventDefault();
        form.dispatchEvent(new Event("submit"));
    }
});

// ---------- AUTO RESIZE ----------
input.addEventListener("input", () => {
    input.style.height = "auto";
    input.style.height = input.scrollHeight + "px";
});

// ---------- SCROLL ----------
function scrollBottom() {
    chatBox.scrollTop = chatBox.scrollHeight;
}

// ---------- INIT ----------
if (chats.length === 0) {
    createChat();
} else {
    currentChatId = chats[0].id;
}

renderHistory();
renderChat();
