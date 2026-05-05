const form = document.getElementById("chat-form");
const input = document.getElementById("message");
const chatBox = document.getElementById("chat-box");
const historyBox = document.getElementById("history");

// =====================
// STORAGE
// =====================
let chats = JSON.parse(localStorage.getItem("chats") || "[]");
let currentChatId = null;

// =====================
// NEW CHAT
// =====================
document.querySelector(".new-chat").onclick = () => {
    const id = Date.now();

    const newChat = {
        id,
        title: "New Chat",
        messages: []
    };

    chats.unshift(newChat);
    currentChatId = id;

    saveChats();
    renderHistory();
    renderChat();
};

// =====================
// SAVE
// =====================
function saveChats() {
    localStorage.setItem("chats", JSON.stringify(chats));
}

// =====================
// RENDER HISTORY
// =====================
function renderHistory() {
    historyBox.innerHTML = "";

    chats.forEach(chat => {
        const div = document.createElement("div");
        div.className = "history-item";
        if (chat.id === currentChatId) div.classList.add("active");

        const title = document.createElement("span");
        title.innerText = chat.title;

        // DELETE BUTTON
        const del = document.createElement("button");
        del.innerText = "✖";
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

        div.onclick = () => {
            currentChatId = chat.id;
            renderHistory();
            renderChat();
        };

        div.appendChild(title);
        div.appendChild(del);
        historyBox.appendChild(div);
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
}

// =====================
// AUTO TITLE (SUMMARY)
// =====================
function generateTitle(text) {
    text = text.toLowerCase();

    if (text.includes("hasil")) {
        return text.replace("apa", "").trim();
    }

    if (text.length > 20) {
        return text.slice(0, 20) + "...";
    }

    return text;
}

// =====================
// ADD MESSAGE
// =====================
function addMessage(text, sender, file=null, save=true) {
    const div = document.createElement("div");
    div.className = sender;

    const p = document.createElement("p");
    p.textContent = text;
    div.appendChild(p);

    chatBox.appendChild(div);

    if (save) {
        const chat = chats.find(c => c.id === currentChatId);
        if (!chat) return;

        chat.messages.push({ role: sender, text });

        // AUTO TITLE dari pesan pertama
        if (chat.messages.length === 1) {
            chat.title = generateTitle(text);
        }

        saveChats();
        renderHistory();
    }
}

// =====================
// SEND
// =====================
form.addEventListener("submit", async (e) => {
    e.preventDefault();

    const msg = input.value.trim();
    if (!msg) return;

    addMessage(msg, "user");

    input.value = "";

    const fd = new FormData();
    fd.append("message", msg);

    const res = await fetch("/chat", {
        method: "POST",
        body: fd
    });

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
});

// =====================
// ENTER SEND
// =====================
input.addEventListener("keydown", (e) => {
    if (window.innerWidth > 768 && e.key === "Enter" && !e.shiftKey) {
        e.preventDefault();
        form.requestSubmit();
    }
});

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
