from flask import Flask, render_template, request, jsonify, session
import requests, time, base64

app = Flask(__name__)
app.secret_key = "neuromv-max-free"

# ======================
# CONFIG
# ======================
DAILY_LIMIT = 50
IMAGE_LIMIT = 10
MEMORY_SIZE = 12

# ======================
# UTILS
# ======================
def today_key():
    return int(time.time() // 86400)

def ensure_counters():
    if session.get("day") != today_key():
        session["day"] = today_key()
        session["count"] = 0
        session["img"] = 0

def check_chat_limit():
    ensure_counters()
    if session.get("count", 0) >= DAILY_LIMIT:
        return False
    session["count"] = session.get("count", 0) + 1
    return True

def check_image_limit():
    ensure_counters()
    if session.get("img", 0) >= IMAGE_LIMIT:
        return False
    session["img"] = session.get("img", 0) + 1
    return True

# ======================
# MEMORY PER CHAT (by client chat_id)
# ======================
def get_memory(chat_id):
    if "mem" not in session:
        session["mem"] = {}
    if chat_id not in session["mem"]:
        session["mem"][chat_id] = []
    return session["mem"][chat_id]

def push_memory(chat_id, role, text):
    mem = get_memory(chat_id)
    mem.append({"role": role, "text": text})
    if len(mem) > MEMORY_SIZE:
        mem.pop(0)
    session["mem"][chat_id] = mem

def build_prompt(chat_id, user_msg):
    mem = get_memory(chat_id)
    context = ""
    for m in mem:
        context += f"{m['role']}: {m['text']}\n"
    context += f"user: {user_msg}\nbot:"
    return context

# ======================
# AI ROUTER (FREE)
# ======================
def ai_pollinations(prompt):
    try:
        r = requests.get(f"https://text.pollinations.ai/{prompt}", timeout=10)
        if r.status_code == 200 and r.text.strip():
            return r.text.strip()
    except:
        pass
    return None

def ai_fallback(msg):
    # simple offline fallback
    if "halo" in msg.lower():
        return "Halo! Aku NeuroMV. Ada yang bisa dibantu?"
    return "⚠️ AI lagi sibuk / limit. Coba lagi beberapa saat."

def ask_ai(chat_id, msg):
    prompt = build_prompt(chat_id, msg)
    res = ai_pollinations(prompt)
    if res:
        return res
    return ai_fallback(msg)

# ======================
# IMAGE (Pollinations)
# ======================
BANNED = ["porn","sex","nude","bokep","nsfw"]

def generate_image(prompt):
    low = prompt.lower()
    if any(b in low for b in BANNED):
        return {"error": "❌ Konten tidak diperbolehkan."}
    if not check_image_limit():
        return {"error": "⚠️ Limit generate image tercapai (10x/hari)."}
    enhanced = f"{prompt}, high quality, detailed, 4k, anime style"
    url = "https://image.pollinations.ai/prompt/" + enhanced.replace(" ", "%20") + "?width=512&height=512"
    return {"url": url}

# ======================
# VISION (basic caption via Pollinations)
# ======================
def image_to_caption(img_bytes):
    # Pollinations juga bisa caption via prompt
    # kirim base64 (simple trick)
    try:
        b64 = base64.b64encode(img_bytes).decode("utf-8")
        prompt = f"describe this image briefly: data:image/jpeg;base64,{b64}"
        r = requests.get(f"https://text.pollinations.ai/{prompt}", timeout=12)
        if r.status_code == 200 and r.text.strip():
            return r.text.strip()
    except:
        pass
    return "⚠️ Vision gagal membaca gambar."

# ======================
# ROUTES
# ======================
@app.route("/")
def index():
    return render_template("index.html")

@app.route("/chat", methods=["POST"])
def chat():
    chat_id = request.form.get("chat_id", "default")
    msg = request.form.get("message", "").strip()

    if not check_chat_limit():
        return jsonify({"type":"limit","reply":"You've reached your daily limit for today, come back tomorrow!"})

    # file?
    if "file" in request.files:
        f = request.files["file"]
        if f and f.filename:
            caption = image_to_caption(f.read())
            push_memory(chat_id, "user", "[image]")
            push_memory(chat_id, "bot", caption)
            return jsonify({"type":"text","reply": caption})

    # image intent?
    if any(x in msg.lower() for x in ["gambar","image","foto","anime","draw"]):
        out = generate_image(msg)
        if "error" in out:
            return jsonify({"type":"text","reply": out["error"]})
        return jsonify({"type":"image","url": out["url"]})

    # text AI
    reply = ask_ai(chat_id, msg)
    push_memory(chat_id, "user", msg)
    push_memory(chat_id, "bot", reply)

    return jsonify({"type":"text","reply": reply})

if __name__ == "__main__":
    app.run(debug=True)
