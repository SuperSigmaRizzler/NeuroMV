import os, time, random, requests
from flask import Flask, request, jsonify, render_template, session

app = Flask(__name__)
app.secret_key = "neuromv-ultra-stable"

# =========================
# CONFIG
# =========================
# Bisa 1 atau banyak key: "key1,key2,key3"
GROQ_KEYS = [k.strip() for k in os.getenv("GROQ_API_KEYS", "").split(",") if k.strip()]
GROQ_MODEL = "llama3-8b-8192"

# =========================
# MEMORY
# =========================
def get_memory():
    if "mem" not in session:
        session["mem"] = []
    return session["mem"]

def add_memory(role, content):
    mem = get_memory()
    mem.append({"role": role, "content": content})
    if len(mem) > 12:
        mem.pop(0)
    session["mem"] = mem

# =========================
# GROQ (MULTI KEY + RETRY)
# =========================
def ask_groq(prompt, retries=2):
    if not GROQ_KEYS:
        return None

    keys = GROQ_KEYS.copy()
    random.shuffle(keys)

    for key in keys:
        for attempt in range(retries + 1):
            try:
                r = requests.post(
                    "https://api.groq.com/openai/v1/chat/completions",
                    headers={
                        "Authorization": f"Bearer {key}",
                        "Content-Type": "application/json"
                    },
                    json={
                        "model": GROQ_MODEL,
                        "messages": get_memory() + [{"role": "user", "content": prompt}]
                    },
                    timeout=8
                )

                # SUCCESS
                if r.status_code == 200:
                    return r.json()["choices"][0]["message"]["content"]

                # RATE LIMIT → coba lagi
                if r.status_code == 429:
                    time.sleep(1.2 * (attempt + 1))
                    continue

                # UNAUTHORIZED / KEY INVALID → skip key
                if r.status_code in [401, 403]:
                    break

                # ERROR LAIN → retry dikit
                time.sleep(0.8)

            except:
                time.sleep(0.8)

    return None

# =========================
# POLLINATIONS TEXT (FREE)
# =========================
def ask_pollinations(prompt):
    try:
        url = f"https://text.pollinations.ai/{prompt.replace(' ', '%20')}"
        r = requests.get(url, timeout=8)
        if r.status_code == 200 and r.text.strip():
            return r.text
    except:
        pass
    return None

# =========================
# FINAL AI (AUTO SWITCH)
# =========================
def ask_ai(prompt):

    # 1. Groq (utama)
    reply = ask_groq(prompt)
    if reply:
        add_memory("user", prompt)
        add_memory("assistant", reply)
        return reply

    # 2. Pollinations (fallback gratis)
    reply = ask_pollinations(prompt)
    if reply:
        add_memory("user", prompt)
        add_memory("assistant", reply)
        return reply

    # 3. Offline fallback (never blank)
    return f"🤖 (Offline Mode)\nAku belum bisa akses AI sekarang.\nTapi kamu bilang:\n{prompt}"

# =========================
# IMAGE (JANGAN DIUBAH)
# =========================
def generate_image(prompt):
    return f"https://image.pollinations.ai/prompt/{prompt.replace(' ','%20')}"

# =========================
# ROUTES
# =========================
@app.route("/")
def home():
    return render_template("index.html")

@app.route("/chat", methods=["POST"])
def chat():
    msg = request.form.get("message", "").strip()
    file = request.files.get("file")

    # =========================
    # VISION BASIC (optional)
    # =========================
    if file:
        return jsonify({
            "type": "text",
            "reply": "📷 Gambar diterima!"
        })

    # =========================
    # IMAGE GENERATION
    # =========================
    if any(x in msg.lower() for x in ["gambar","image","foto","anime","draw"]):
        return jsonify({
            "type": "image",
            "url": generate_image(msg)
        })

    # =========================
    # TEXT AI
    # =========================
    reply = ask_ai(msg)

    return jsonify({
        "type": "text",
        "reply": reply
    })

# =========================
# RUN
# =========================
if __name__ == "__main__":
    app.run(host="0.0.0.0", port=5000)
