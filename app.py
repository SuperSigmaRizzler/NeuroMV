from flask import Flask, render_template, request, jsonify, session
import requests, time, os, json, hashlib, random, re
from requests.adapters import HTTPAdapter
from urllib3.util.retry import Retry

# ==================================================
# APP
# ==================================================
app = Flask(__name__)
app.secret_key = os.getenv("SECRET_KEY", "neuromv-ultra-final-key")

# ==================================================
# CONFIG
# ==================================================
DAILY_LIMIT = 100
IMAGE_LIMIT = 5
FILE_LIMIT = 5

MEMORY_SIZE = 40
PROFILE_FILE = "user_profiles.json"
PIN_FILE = "pin_db.json"

REQUEST_TIMEOUT = 18

# ==================================================
# HTTP SESSION (stable)
# ==================================================
http = requests.Session()

retry = Retry(
    total=2,
    backoff_factor=0.6,
    status_forcelist=[429, 500, 502, 503, 504],
    allowed_methods=["POST", "GET"]
)

adapter = HTTPAdapter(max_retries=retry, pool_connections=20, pool_maxsize=20)
http.mount("https://", adapter)
http.mount("http://", adapter)

# ==================================================
# API KEYS
# ==================================================
def split_keys(name):
    raw = os.getenv(name, "")
    return [x.strip() for x in raw.split(",") if x.strip()]

def load_keys(multi_name, single_name):
    arr = split_keys(multi_name)
    if arr:
        return arr

    one = os.getenv(single_name, "").strip()
    return [one] if one else []

GROQ_KEYS = load_keys("GROQ_API_KEYS", "GROQ_API_KEY")
CEREBRAS_KEYS = load_keys("CEREBRAS_API_KEYS", "CEREBRAS_API_KEY")
GEMINI_KEYS = load_keys("GEMINI_API_KEYS", "GEMINI_API_KEY")

# ==================================================
# SYSTEM PROMPT
# ==================================================
SYSTEM_PROMPT = """
You are NeuroMV, a next-generation premium AI assistant created by Marvell Jonathan Siau.

Identity:
- Smart, fast, accurate, modern, helpful.
- Friendly and natural.
- Match user language naturally.
- If user uses Indonesian, reply naturally in Indonesian.
- If user uses English, reply professionally.

Capabilities:
- Coding, debugging, architecture, scripting.
- Explain concepts clearly.
- Analyze files, screenshots, text, data.
- Give practical solutions.
- Strong reasoning.

Rules:
- Never pretend certainty when unsure.
- If needed, ask follow-up questions.
- Be concise unless detail is needed.
- Always maximize usefulness.
"""

# ==================================================
# IMAGE WORDS
# ==================================================
IMAGE_WORDS = [
    "image","gambar","foto","photo","picture",
    "draw","buat gambar","generate image",
    "wallpaper","anime","logo","poster"
]

# ==================================================
# BLOCK WORDS
# ==================================================
BLOCK_WORDS = [
"porn","xxx","nsfw","bokep","nude","naked","sex","hentai",
"rape","pedophile","child porn",
"kill","murder","assassinate","stab","shoot",
"suicide","self harm","hang myself",
"bomb","grenade","terrorist","terrorism",
"hack","phishing","ddos","malware","ransomware",
"keylogger","steal password","bypass otp",
"cocaine","heroin","meth","weed","ganja",
"fake id","carding","dark web",
"perkosa","bunuh diri","bobol akun","hack ig",
"membunuh","merakit bom","senjata api",
"قتل","色情","自殺","убить"
]

def normalize(t):
    t = t.lower()
    t = t.replace("0","o").replace("1","i").replace("3","e").replace("4","a")
    t = re.sub(r"[^a-z0-9 ]", "", t)
    t = re.sub(r"\s+", " ", t).strip()
    return t

def blocked(msg):
    t = normalize(msg)
    return any(x in t for x in BLOCK_WORDS)

# ==================================================
# USER ID
# ==================================================
def uid():
    ip = request.headers.get("X-Forwarded-For", request.remote_addr or "")
    ua = request.headers.get("User-Agent", "")
    return hashlib.md5((ip + ua).encode()).hexdigest()

# ==================================================
# DAILY LIMIT
# ==================================================
def today():
    return int(time.time() // 86400)

def ensure_daily():
    if session.get("day") != today():
        session["day"] = today()
        session["chat_count"] = 0
        session["image_count"] = 0
        session["file_count"] = 0

def add_chat():
    ensure_daily()
    session["chat_count"] += 1

def add_image():
    ensure_daily()
    session["image_count"] += 1

def add_file():
    ensure_daily()
    session["file_count"] += 1

def over_chat():
    ensure_daily()
    return session["chat_count"] >= DAILY_LIMIT

def over_image():
    ensure_daily()
    return session["image_count"] >= IMAGE_LIMIT

def over_file():
    ensure_daily()
    return session["file_count"] >= FILE_LIMIT

# ==================================================
# JSON HELPERS
# ==================================================
def read_json(path, default):
    try:
        with open(path, "r", encoding="utf-8") as f:
            return json.load(f)
    except:
        return default

def write_json(path, data):
    try:
        with open(path, "w", encoding="utf-8") as f:
            json.dump(data, f, indent=2, ensure_ascii=False)
    except:
        pass

# ==================================================
# PIN
# ==================================================
def hash_pin(pin):
    return hashlib.sha256(pin.encode()).hexdigest()

def pin_exists():
    db = read_json(PIN_FILE, {})
    return uid() in db

def pin_ok(pin):
    db = read_json(PIN_FILE, {})
    u = uid()
    return u in db and db[u] == hash_pin(pin)

def set_pin(pin):
    db = read_json(PIN_FILE, {})
    db[uid()] = hash_pin(pin)
    write_json(PIN_FILE, db)

# ==================================================
# PROFILE
# ==================================================
def get_profile():
    db = read_json(PROFILE_FILE, {})
    u = uid()

    if u not in db:
        db[u] = {"name":"", "likes":[]}
        write_json(PROFILE_FILE, db)

    return db[u]

# ==================================================
# MEMORY
# ==================================================
def mem():
    if "mem" not in session:
        session["mem"] = {}
    return session["mem"]

def get_mem(cid):
    m = mem()
    if cid not in m:
        m[cid] = []
    return m[cid]

def push(cid, role, text):
    arr = get_mem(cid)
    arr.append({"role":role, "text":text})

    if len(arr) > MEMORY_SIZE:
        arr.pop(0)

    session["mem"][cid] = arr

# ==================================================
# PROMPT
# ==================================================
def build_prompt(cid, msg):
    p = get_profile()
    history = get_mem(cid)

    txt = SYSTEM_PROMPT + "\n\n"

    if p["name"]:
        txt += f"User name: {p['name']}\n"

    txt += "Conversation Memory:\n"

    for x in history:
        txt += f"{x['role']}: {x['text']}\n"

    txt += f"user: {msg}\nassistant:"
    return txt

# ==================================================
# PROVIDERS
# ==================================================
def ask_groq(prompt):
    if not GROQ_KEYS:
        return None

    keys = GROQ_KEYS[:]
    random.shuffle(keys)

    for key in keys:
        try:
            r = http.post(
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
                timeout=REQUEST_TIMEOUT
            )

            if r.status_code == 200:
                return r.json()["choices"][0]["message"]["content"].strip()

        except Exception as e:
            print("GROQ ERROR:", e)

    return None

def ask_cerebras(prompt):
    if not CEREBRAS_KEYS:
        return None

    keys = CEREBRAS_KEYS[:]
    random.shuffle(keys)

    for key in keys:
        try:
            r = http.post(
                "https://api.cerebras.ai/v1/chat/completions",
                headers={
                    "Authorization": f"Bearer {key}",
                    "Content-Type":"application/json"
                },
                json={
                    "model":"llama3.1-8b",
                    "messages":[
                        {"role":"system","content":SYSTEM_PROMPT},
                        {"role":"user","content":prompt}
                    ]
                },
                timeout=REQUEST_TIMEOUT
            )

            if r.status_code == 200:
                return r.json()["choices"][0]["message"]["content"].strip()

        except Exception as e:
            print("CEREBRAS ERROR:", e)

    return None

def ask_gemini(prompt):
    if not GEMINI_KEYS:
        return None

    keys = GEMINI_KEYS[:]
    random.shuffle(keys)

    for key in keys:
        try:
            url = f"https://generativelanguage.googleapis.com/v1beta/models/gemini-1.5-flash:generateContent?key={key}"

            r = http.post(
                url,
                json={
                    "contents":[
                        {"parts":[{"text":prompt}]}
                    ]
                },
                timeout=REQUEST_TIMEOUT
            )

            if r.status_code == 200:
                data = r.json()
                return data["candidates"][0]["content"]["parts"][0]["text"].strip()

        except Exception as e:
            print("GEMINI ERROR:", e)

    return None

def ask_pollinations(prompt):
    try:
        r = http.get(
            "https://text.pollinations.ai/" + prompt,
            timeout=15
        )

        if r.status_code == 200:
            return r.text.strip()

    except Exception as e:
        print("POLLINATIONS ERROR:", e)

    return None

def ask_ai(cid, msg):
    prompt = build_prompt(cid, msg)

    providers = [
        ask_cerebras,
        ask_groq,
        ask_gemini,
        ask_pollinations
    ]

    for fn in providers:
        try:
            out = fn(prompt)
            if out:
                return out
        except Exception as e:
            print("PROVIDER FAIL:", e)

    return "NeuroMV is temporarily unavailable. Please try again shortly."

# ==================================================
# IMAGE
# ==================================================
def want_image(msg):
    low = msg.lower()
    return any(x in low for x in IMAGE_WORDS)

def make_image(prompt):
    return {
        "url":"https://image.pollinations.ai/prompt/" + prompt.replace(" ", "%20")
    }

# ==================================================
# FILE
# ==================================================
def read_image(_):
    return "Image received successfully. I can describe the photo, analyze objects, explain scenes, or inspect details."

def read_text(file_bytes):
    try:
        txt = file_bytes.decode("utf-8", errors="ignore")[:1500]

        if not txt.strip():
            return "File received, but content is empty or unreadable."

        return f"This file contains:\n\n{txt}\n\nWould you like a summary or detailed explanation?"

    except:
        return "File received, but this format is not readable yet."

# ==================================================
# ROUTES
# ==================================================
@app.route("/")
def home():
    return render_template("index.html")

@app.route("/pin/setup", methods=["POST"])
def pin_setup():
    pin = request.json.get("pin", "").strip()

    if not pin:
        return jsonify({"error":"PIN required"}), 400

    if pin_exists():
        return jsonify({"error":"PIN already exists"}), 400

    set_pin(pin)
    return jsonify({"status":"created"})

@app.route("/pin/check", methods=["POST"])
def pin_check():
    pin = request.json.get("pin", "").strip()

    if pin_ok(pin):
        session["pin_ok"] = True
        return jsonify({"ok":True})

    return jsonify({"ok":False}), 401

@app.route("/chat", methods=["POST"])
def chat():
    cid = request.form.get("chat_id", "default")
    msg = request.form.get("message", "").strip()

    # LIMIT CHAT
    if over_chat():
        return jsonify({"type":"limit_chat"})

    add_chat()

    # FILE
    if "file" in request.files:
        f = request.files["file"]

        if f and f.filename:

            if over_file():
                return jsonify({"type":"limit_file"})

            add_file()

            data = f.read()

            if f.filename.lower().endswith((".png",".jpg",".jpeg",".webp")):
                reply = read_image(data)
            else:
                reply = read_text(data)

            push(cid, "user", "[file]")
            push(cid, "bot", reply)

            return jsonify({
                "type":"text",
                "reply":reply
            })

    # BLOCKED
    if blocked(msg):
        return jsonify({
            "type":"text",
            "reply":"I can't help with that request."
        })

    # IMAGE
    if want_image(msg):

        if over_image():
            return jsonify({"type":"limit_image"})

        add_image()

        img = make_image(msg)

        return jsonify({
            "type":"image",
            "url":img["url"]
        })

    # NORMAL CHAT
    reply = ask_ai(cid, msg)

    push(cid, "user", msg)
    push(cid, "bot", reply)

    return jsonify({
        "type":"text",
        "reply":reply
    })

# ==================================================
# RUN
# ==================================================
if __name__ == "__main__":
    port = int(os.getenv("PORT", 5000))
    app.run(host="0.0.0.0", port=port, debug=False)
