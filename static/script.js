const form = document.getElementById("chat-form");
const input = document.getElementById("message");
const chatBox = document.getElementById("chat-box");

form.addEventListener("submit", async (e) => {
    e.preventDefault();

    const msg = input.value.trim();
    if (!msg) return;

    addMessage(msg, "user");
    input.value = "";

    const formData = new FormData();
    formData.append("message", msg);

    const res = await fetch("/chat", {
        method: "POST",
        body: formData
    });

    const data = await res.json();

    // =====================
    // TEXT RESPONSE
    // =====================
    if (data.type === "text") {
        addMessage(data.reply, "bot");
    }

    // =====================
    // IMAGE RESPONSE (FIX)
    // =====================
    if (data.type === "image") {

        const wrapper = document.createElement("div");

        const status = document.createElement("div");
        status.innerText = "🎨 Creating Image...";

        const img = document.createElement("img");
        img.className = "chat-image";
        img.style.display = "none";

        wrapper.appendChild(status);
        wrapper.appendChild(img);
        chatBox.appendChild(wrapper);

        let retry = 0;

        function loadImage() {
            img.src = data.url + "?t=" + Date.now();

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
    }

    chatBox.scrollTop = chatBox.scrollHeight;
});

function addMessage(text, sender) {
    const div = document.createElement("div");
    div.className = sender;
    div.innerText = text;
    chatBox.appendChild(div);
}
