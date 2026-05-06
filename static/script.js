// ===============================
// NEUROMV FINAL SCRIPT.JS FIXED
// New Chat benar-benar reset layar
// ===============================

// ---------- SAFE STORAGE ----------
function loadChats() {
    try {
        const data = JSON.parse(localStorage.getItem("chats"));
        return Array.isArray(data) ? data : [];
    } catch {
        return [];
    }
}

let chats = loadChats();
let currentChatId = null;

// ---------- ELEMENT ----------
const form = document.getElementById("chat-form");
const input = document.getElementById("message");
const chatBox = document.getElementById("chat-box");
const historyBox = document.getElementById("history");
const fileInput = document.getElementById("file-input");
const previewBox = document.getElementById("preview-box");
const newChatBtn = document.querySelector(".new-chat");

// ---------- SAVE ----------
function saveChats() {
    localStorage.setItem("chats", JSON.stringify(chats));
}

// ---------- CREATE NEW CHAT ----------
function createNewChat() {
    const id = Date.now();

    const newChat = {
        id: id,
        title: "New Chat",
        messages: []
    };

    chats.unshift(newChat);
    currentChatId = id;

    saveChats();
    renderHistory();

    // 🔥 RESET TOTAL UI
    chatBox.innerHTML = "";
    input.value = "";
    previewBox.innerHTML = "";
    fileInput.value = "";

    input.focus();
}

// tombol new chat
newChatBtn.onclick = createNewChat;

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
        del.textContent = "✖";
        del.className = "delete-chat";

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

// ---------- RENDER CHAT ----------
function renderChat() {
    chatBox.innerHTML = "";

    const chat = chats.find(c => c.id === currentChatId);
    if (!chat) return;

    chat.messages.forEach(msg => {
        addMessage(msg.text, msg.role, null, false);
    });

    scrollBottom();
}

// ---------- TITLE ----------
function generateTitle(text) {
    if (!text) return "New Chat";

    text = text.trim();

    if (text.length > 24) {
        return text.slice(0, 24) + "...";
    }

    return text;
}

// ---------- ADD MESSAGE ----------
function addMessage(text, role, file = null, save = true) {
    const div = document.createElement("div");
    div.className = role;

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

    if (save) {
        const chat = chats.find(c => c.id === currentChatId);
        if (!chat) return;

        chat.messages.push({
            role: role,
            text: text
        });

        if (chat.messages.length === 1) {
            chat.title = generateTitle(text);
        }

        saveChats();
        renderHistory();
    }

    scrollBottom();
}

// ---------- PREVIEW FILE ----------
fileInput?.addEventListener("change", () => {
    previewBox.innerHTML = "";

    const file = fileInput.files[0];
    if (!file) return;

    const wrap = document.createElement("div");
    wrap.className = "preview-wrapper";

    const img = document.createElement("img");
    img.src = URL.createObjectURL(file);
    img.className = "preview-image";

    const remove = document.createElement("button");
    remove.textContent = "✖";
    remove.className = "remove-btn";

    remove.onclick = () => {
        fileInput.value = "";
        previewBox.innerHTML = "";
    };

    wrap.appendChild(img);
    wrap.appendChild(remove);
    previewBox.appendChild(wrap);
});

// ---------- SEND ----------
form.addEventListener("submit", async (e) => {
    e.preventDefault();

    const msg = input.value.trim();
    const file = fileInput.files[0];

    if (!msg && !file) return;

    addMessage(msg, "user", file);

    input.value = "";
    previewBox.innerHTML = "";
    fileInput.value = "";

    try {
        const fd = new FormData();
        fd.append("message", msg);

        if (file) {
            fd.append("file", file);
        }

        const res = await fetch("/chat", {
            method: "POST",
            body: fd
        });

        const data = await res.json();

        if (data.type === "image") {
            const div = document.createElement("div");
            div.className = "bot";

            const img = document.createElement("img");
            img.src = data.url;
            img.className = "chat-image";

            div.appendChild(img);
            chatBox.appendChild(div);
        } else {
            addMessage(data.reply || "No response", "bot");
        }

    } catch {
        addMessage("❌ Server Error", "bot");
    }

    scrollBottom();
});

// ---------- ENTER SEND ----------
input.addEventListener("keydown", (e) => {
    if (e.key === "Enter" && !e.shiftKey) {
        e.preventDefault();
        form.dispatchEvent(new Event("submit"));
    }
});

// ---------- SCROLL ----------
function scrollBottom() {
    chatBox.scrollTop = chatBox.scrollHeight;
}

// ---------- INIT ----------
if (chats.length === 0) {
    createNewChat();
} else {
    currentChatId = chats[0].id;
}

renderHistory();
renderChat();
