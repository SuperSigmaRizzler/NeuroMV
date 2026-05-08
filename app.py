from flask import Flask, render_template, request, jsonify, session
import requests, time, base64, os, json, hashlib, random, re

app = Flask(__name__)
app.secret_key = os.getenv("SECRET_KEY", "neuromv-v5-titan")

# ==================================================
# CONFIG
# ==================================================
DAILY_LIMIT = 9999
IMAGE_LIMIT = 80
MEMORY_SIZE = 32
PROFILE_FILE = "user_profiles.json"

# ==================================================
# API KEYS
# ==================================================
RAW_KEYS = os.getenv("GROQ_API_KEYS", "")
GROQ_KEYS = [x.strip() for x in RAW_KEYS.split(",") if x.strip()]

if not GROQ_KEYS:
    single = os.getenv("GROQ_API_KEY", "").strip()
    if single:
        GROQ_KEYS = [single]

CEREBRAS_API_KEY = os.getenv("CEREBRAS_API_KEY", "")
GEMINI_API_KEY = os.getenv("GEMINI_API_KEY", "")

# ==================================================
# IDENTITY
# ==================================================
SYSTEM_PROMPT = """
You are NeuroMV.

Identity Rules:
- Your name is NeuroMV
- You are an advanced AI assistant
- You were created by Marvell Jonathan Siau
- If asked who created you, answer exactly:
Marvell Jonathan Siau
- Never deny your identity
- Speak naturally
- Be intelligent, modern, helpful, friendly
- Give useful answers
- Never output random broken code
"""

# ==================================================
# IMAGE KEYWORDS
# ==================================================
IMAGE_WORDS = [
"image","gambar","foto","draw","drawing","art","anime",
"generate","create image","buat gambar","paint","poster",
"wallpaper","avatar","logo","portrait","landscape",
"pic","picture","render","scene","3d","realistic",
"character","robot","dragon","car","house","city",
"space","moon","planet","fantasy","comic"
]

# ==================================================
# MODERATION
# ==================================================
RISK_WORDS = [
"porn","nsfw","18+","hentai","rule34","r34",
"nude","explicit","illegal","forced","minor"
]

def normalize_text(text):
    text = text.lower()
    text = text.replace("0","o").replace("1","i")
    text = text.replace("3","e").replace("4","a")
    text = text.replace("5","s").replace("@","a")
    text = re.sub(r'[_\-.]+', ' ', text)
    text = re.sub(r'\s+', ' ', text).strip()
    return text

def blocked_chat(msg):
    t = normalize_text(msg)

    bad = [
        "child exploit",
        "minor sex",
        "forced sex",
        "illegal abuse",
        "animal sex",
        "rape fantasy"
    ]

    if any(x in t for x in bad):
        return True

    return False

def blocked_image(msg):
    t = normalize_text(msg)

    if any(x in t for x in RISK_WORDS):
        return True

    suspicious = [
        "adult image",
        "naked version",
        "remove clothes",
        "sex image",
        "private body"
    ]

    if any(x in t for x in suspicious):
        return True

    return False

# ==================================================
# UTIL
# ==================================================
def today_key():
    return int(time.time() // 86400)

def ensure_counter():
    if session.get("day") != today_key():
        session["day"] = today_key()
        session["count"] = 0
        session["img"] = 0

def count_chat():
    ensure_counter()
    session["count"] = session.get("count", 0) + 1

def count_img():
    ensure_counter()
    session["img"] = session.get("img", 0) + 1

def user_id():
    ip = request.headers.get("X-Forwarded-For", request.remote_addr)
    ua = request.headers.get("User-Agent", "")
    raw = ip + ua
    return hashlib.md5(raw.encode()).hexdigest()

# ==================================================
# PROFILE MEMORY
# ==================================================
def load_profiles():
    try:
        with open(PROFILE_FILE, "r", encoding="utf-8") as f:
            return json.load(f)
    except:
        return {}

def save_profiles(data):
    with open(PROFILE_FILE, "w", encoding="utf-8") as f:
        json.dump(data, f, indent=2)

def get_profile():
    uid = user_id()
    db = load_profiles()

    if uid not in db:
        db[uid] = {
            "likes": [],
            "facts": [],
            "name": "",
            "style": ""
        }
        save_profiles(db)

    return db[uid]

def update_profile_from_message(msg):
    uid = user_id()
    db = load_profiles()

    if uid not in db:
        db[uid] = {
            "likes": [],
            "facts": [],
            "name": "",
            "style": ""
        }

    low = msg.lower()

    interests = [
        "game","gaming","anime","coding",
        "music","football","basketball",
        "movie","crypto","ai","robot",
        "mlbb","free fire","pubg"
    ]

    for x in interests:
        if x in low and x not in db[uid]["likes"]:
            db[uid]["likes"].append(x)

    if "my name is " in low:
        try:
            name = low.split("my name is ")[1].split(" ")[0]
            db[uid]["name"] = name.title()
        except:
            pass

    db[uid]["likes"] = db[uid]["likes"][:20]
    save_profiles(db)

# ==================================================
# CHAT MEMORY
# ==================================================
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

def build_prompt(chat_id, msg):
    mem = get_memory(chat_id)
    profile = get_profile()

    txt = SYSTEM_PROMPT + "\n\n"

    if profile["name"]:
        txt += f"User Name: {profile['name']}\n"

    if profile["likes"]:
        txt += "User Interests: " + ", ".join(profile["likes"]) + "\n"

    txt += "\nRecent Chat Memory:\n"

    for m in mem:
        txt += f"{m['role']}: {m['text']}\n"

    txt += f"user: {msg}\nNeuroMV:"
    return txt

# ==================================================
# AI PROVIDERS
# ==================================================
def ask_groq(prompt):
    if not GROQ_KEYS:
        return None

    random.shuffle(GROQ_KEYS)

    for key in GROQ_KEYS:
        try:
            r = requests.post(
                "https://api.groq.com/openai/v1/chat/completions",
                headers={
                    "Authorization": f"Bearer {key}",
                    "Content-Type":"application/json"
                },
                json={
                    "model":"llama3-70b-8192",
                    "messages":[
                        {"role":"system","content":SYSTEM_PROMPT},
                        {"role":"user","content":prompt}
                    ]
                },
                timeout=12
            )

            if r.status_code == 200:
                return r.json()["choices"][0]["message"]["content"].strip()
        except:
            pass

    return None

def ask_cerebras(prompt):
    if not CEREBRAS_API_KEY:
        return None

    try:
        r = requests.post(
            "https://api.cerebras.ai/v1/chat/completions",
            headers={
                "Authorization": f"Bearer {CEREBRAS_API_KEY}",
                "Content-Type":"application/json"
            },
            json={
                "model":"llama3.1-8b",
                "messages":[
                    {"role":"system","content":SYSTEM_PROMPT},
                    {"role":"user","content":prompt}
                ]
            },
            timeout=14
        )

        if r.status_code == 200:
            return r.json()["choices"][0]["message"]["content"].strip()
    except:
        pass

    return None

def ask_pollinations(prompt):
    try:
        r = requests.get(
            "https://text.pollinations.ai/" + prompt,
            timeout=10
        )
        if r.status_code == 200 and r.text.strip():
            return r.text.strip()
    except:
        pass
    return None

def ask_ai(chat_id, msg):
    prompt = build_prompt(chat_id, msg)

    for fn in [ask_groq, ask_cerebras, ask_pollinations]:
        x = fn(prompt)
        if x:
            return x

    return "I'm NeuroMV. Temporary AI network issue, but I'm still here with you."

# ==================================================
# IMAGE
# ==================================================
def wants_image(msg):
    low = msg.lower()
    return any(x in low for x in IMAGE_WORDS)

def make_image(prompt):
    if blocked_image(prompt):
        return {
            "error":"⚠️ NeuroMV Safety System blocked that image request."
        }

    count_img()

    q = prompt + ", ultra detailed, cinematic lighting, 4k"
    url = "https://image.pollinations.ai/prompt/" + q.replace(" ","%20")

    return {"url":url}

# ==================================================
# OCR
# ==================================================
def image_caption(img_bytes):
    try:
        b64 = base64.b64encode(img_bytes).decode()

        prompt = "Read text and describe image briefly: data:image/png;base64," + b64

        r = requests.get(
            "https://text.pollinations.ai/" + prompt,
            timeout=12
        )

        if r.status_code == 200 and r.text.strip():
            return r.text.strip()

    except:
        pass

    return "I can see the image, but reading failed."

# ==================================================
# ROUTES
# ==================================================
@app.route("/")
def home():
    return render_template("index.html")

@app.route("/chat", methods=["POST"])
def chat():

    chat_id = request.form.get("chat_id", "default")
    msg = request.form.get("message", "").strip()

    count_chat()

    # FILE IMAGE
    if "file" in request.files:
        f = request.files["file"]

        if f and f.filename:
            cap = image_caption(f.read())

            push_memory(chat_id, "user", "[image]")
            push_memory(chat_id, "bot", cap)

            return jsonify({
                "type":"text",
                "reply":cap
            })

    # MODERATION
    if blocked_chat(msg):
        return jsonify({
            "type":"text",
            "reply":"⚠️ NeuroMV cannot assist with that request."
        })

    # IMAGE MODE
    if wants_image(msg):
        out = make_image(msg)

        if "error" in out:
            return jsonify({
                "type":"text",
                "reply":out["error"]
            })

        return jsonify({
            "type":"image",
            "url":out["url"]
        })

    # MEMORY PROFILE
    update_profile_from_message(msg)

    # AI
    reply = ask_ai(chat_id, msg)

    push_memory(chat_id, "user", msg)
    push_memory(chat_id, "bot", reply)

    return jsonify({
        "type":"text",
        "reply":reply
    })

# ==================================================
# RUN
# ==================================================
if __name__ == "__main__":
    app.run(host="0.0.0.0", port=5000, debug=True)
