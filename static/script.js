const form = document.getElementById("chat-form");
const input = document.getElementById("message");
const chatBox = document.getElementById("chat-box");
const historyBox = document.getElementById("history");
const fileInput = document.getElementById("file-input");
const previewBox = document.getElementById("preview-box");

// =====================
// STORAGE
// =====================
let chats = JSON.parse(localStorage.getItem("chats") || "[]");
let currentChatId = null;

// =====================
// SAVE
// =====================
function saveChats() {
    localStorage.setItem("chats", JSON.stringify(chats));
}

// =====================
// NEW CHAT
// =====================
document.querySelector(".new-chat").onclick = () => {
    const id = Date.now();

    const chat = {
        id,
        title: "New Chat",
        messages: []
    };

    chats.unshift(chat);
    currentChatId = id;

    saveChats();
    renderHistory();
    renderChat();
};

// =====================
// RENDER HISTORY
// =====================
function renderHistory() {
    historyBox.innerHTML = "";

    chats.forEach(chat => {
        const item = document.createElement("div");
        item.className = "history-item";
        if (chat.id === currentChatId) item.classList.add("active");

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

// =====================
// RENDER CHAT
// =====================
function renderChat() {
    chatBox.innerHTML = "";

    const chat = chats.find(c => c.id === currentChatId);
    if (!chat) return;

    chat.messages.forEach(msg => {
        addMessage(msg.text, msg.role, null, false);
    });

    scrollBottom();
}

// =====================
// TITLE GENERATOR
// =====================
function generateTitle(text) {
    text = text.trim();

    if (text.toLowerCase().includes("hasil")) {
        return text.replace(/apa/i, "").trim();
    }

    if (text.length > 25) {
        return text.slice(0, 25) + "...";
    }

    return text;
}

// =====================
// ADD MESSAGE
// =====================
function addMessage(text, sender, file=null, save=true) {
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

    if (save) {
        const chat = chats.find(c => c.id === currentChatId);
        if (!chat) return;

        chat.messages.push({ role: sender, text });

        if (chat.messages.length === 1) {
            chat.title = generateTitle(text);
        }

        saveChats();
        renderHistory();
    }
}

// =====================
// PREVIEW IMAGE
// =====================
fileInput.addEventListener("change", () => {
    previewBox.innerHTML = "";

    const file = fileInput.files[0];
    if (!file) return;

    const wrapper = document.createElement("div");
    wrapper.className = "preview-wrapper";

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

    wrapper.appendChild(img);
    wrapper.appendChild(remove);
    previewBox.appendChild(wrapper);
});

// =====================
// SEND
// =====================
form.addEventListener("submit", async (e) => {
    e.preventDefault();

    const msg = input.value.trim();
    const file = fileInput.files[0];

    if (!msg && !file) return;

    addMessage(msg, "user", file);

    // RESET INPUT FIX
    input.value = "";
    input.style.height = "auto";
    fileInput.value = "";
    previewBox.innerHTML = "";

    try {
        const fd = new FormData();
        fd.append("message", msg);
        if (file) fd.append("file", file);

        const res = await fetch("/chat", {
            method: "POST",
            body: fd
        });

        if (!res.ok) throw new Error("Server error");

        const data = await res.json();

        if (data.type === "text") {
            addMessage(data.reply, "bot");
        }

        if (data.type === "image") {
            const div = document.createElement("div");
            div.className = "bot";

            const img = document.createElement("img");
            img.src = data.url;
            img.className = "chat-image";

            div.appendChild(img);
            chatBox.appendChild(div);
        }

    } catch (err) {
        console.error(err);
        addMessage("❌ Gagal connect ke server", "bot");
    }

    scrollBottom();
});

// =====================
// ENTER = SEND (PC)
// =====================
input.addEventListener("keydown", (e) => {
    if (window.innerWidth > 768 && e.key === "Enter" && !e.shiftKey) {
        e.preventDefault();
        form.dispatchEvent(new Event("submit"));
    }
});

// =====================
// AUTO RESIZE
// =====================
input.addEventListener("input", () => {
    input.style.height = "auto";
    input.style.height = input.scrollHeight + "px";
});

// =====================
// SCROLL
// =====================
function scrollBottom() {
    chatBox.scrollTop = chatBox.scrollHeight;
}

// =====================
// INIT
// =====================
if (chats.length === 0) {
    document.querySelector(".new-chat").click();
} else {
    currentChatId = chats[0].id;
}

renderHistory();
renderChat();
