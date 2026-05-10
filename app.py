from flask import Flask, render_template, request, jsonify, session
import requests, time, base64, os, json, hashlib, random, re

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

# ==================================================
# API KEYS
# ==================================================
def split_keys(name):
    raw = os.getenv(name, "")
    return [x.strip() for x in raw.split(",") if x.strip()]

GROQ_KEYS = split_keys("GROQ_API_KEYS")
if not GROQ_KEYS:
    one = os.getenv("GROQ_API_KEY", "").strip()
    if one:
        GROQ_KEYS = [one]

CEREBRAS_KEYS = split_keys("CEREBRAS_API_KEYS")
if not CEREBRAS_KEYS:
    one = os.getenv("CEREBRAS_API_KEY", "").strip()
    if one:
        CEREBRAS_KEYS = [one]

GEMINI_KEYS = split_keys("GEMINI_API_KEYS")
if not GEMINI_KEYS:
    one = os.getenv("GEMINI_API_KEY", "").strip()
    if one:
        GEMINI_KEYS = [one]

# ==================================================
# SYSTEM PROMPT (ENGLISH / AI STYLE)
# ==================================================
SYSTEM_PROMPT = """
You are NeuroMV, a highly capable next-generation AI assistant.

Core Identity:
- Intelligent, fast, helpful, modern, accurate.
- Friendly and natural in conversation.
- If the user speaks Indonesian casually, you may reply casually too.
- If the user speaks English, reply professionally and naturally.

Capabilities:
- Advanced coding, debugging, scripting, architecture.
- Analyze files, text, images, screenshots, and data.
- Explain complex topics clearly.
- Solve problems step-by-step.
- Generate creative and practical ideas.

Behavior Rules:
- Be concise when possible, detailed when needed.
- Never pretend to know something uncertain.
- If unclear, ask smart follow-up questions.
- Prioritize usefulness and correctness.
- Sound like a premium AI assistant.
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
# BLOCK WORDS (100+)
# ==================================================
BLOCK_WORDS = [
"porn","xxx","nsfw","bokep","nude","naked","sex","hentai","milf","onlyfans",
"rape","rapist","molest","incest","pedo","pedophile","child porn",
"kill","murder","assassinate","slaughter","stab","shoot","massacre",
"suicide","self harm","hang myself","cut myself","die now",
"bomb","grenade","explosive","terrorist","terrorism","isis","jihad attack",
"hack","hacker","phishing","ddos","malware","virus","ransomware",
"keylogger","steal password","bypass otp","crack wifi","bobol wifi",
"drugs","cocaine","heroin","meth","lsd","ecstasy","weed","ganja",
"opium","fentanyl","amphetamine","morphine",
"gun","pistol","rifle","ak47","weapon","ammo",
"fake id","counterfeit","money laundering","fraud","scam",
"credit card steal","carding","dark web","deep web drugs",
"perkosa","bunuh diri","sadap wa","bobol akun","hack ig",
"membunuh","racun","merakit bom","senjata api",
"porno","telanjang","ngentot","kontol","memek","vagina"
"قتل","اباحية","اغتصاب","انتحار",
"убить","порно","самоубийство",
"杀人","色情","自杀",
"殺人","ポルノ","自殺",
"violence","bloodbath","behead","execution","hostage"
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
    ip = request.headers.get("X-Forwarded-For", request.remote_addr)
    ua = request.headers.get("User-Agent", "")
    return hashlib.md5((ip + ua).encode()).hexdigest()

# ==================================================
# DAILY COUNTER
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
# PIN SYSTEM
# ==================================================
def load_pin():
    try:
        with open(PIN_FILE,"r",encoding="utf-8") as f:
            return json.load(f)
    except:
        return {}

def save_pin(d):
    with open(PIN_FILE,"w",encoding="utf-8") as f:
        json.dump(d,f,indent=2)

def hash_pin(p):
    return hashlib.sha256(p.encode()).hexdigest()

def pin_exists():
    return uid() in load_pin()

def pin_ok(pin):
    db = load_pin()
    u = uid()
    return u in db and db[u] == hash_pin(pin)

def set_pin(pin):
    db = load_pin()
    db[uid()] = hash_pin(pin)
    save_pin(db)

# ==================================================
# PROFILE
# ==================================================
def load_profiles():
    try:
        with open(PROFILE_FILE,"r",encoding="utf-8") as f:
            return json.load(f)
    except:
        return {}

def save_profiles(d):
    with open(PROFILE_FILE,"w",encoding="utf-8") as f:
        json.dump(d,f,indent=2)

def get_profile():
    db = load_profiles()
    u = uid()

    if u not in db:
        db[u] = {"name":"","likes":[]}
        save_profiles(db)

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
    m = get_mem(cid)
    m.append({"role":role,"text":text})

    if len(m) > MEMORY_SIZE:
        m.pop(0)

    session["mem"][cid] = m

# ==================================================
# PROMPT
# ==================================================
def build_prompt(cid, msg):
    p = get_profile()
    m = get_mem(cid)

    txt = SYSTEM_PROMPT + "\n\n"

    if p["name"]:
        txt += f"User name: {p['name']}\n"

    txt += "Conversation Memory:\n"

    for x in m:
        txt += f"{x['role']}: {x['text']}\n"

    txt += f"user: {msg}\nassistant:"
    return txt

# ==================================================
# AI PROVIDERS
# ==================================================
def ask_groq(prompt):
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
                timeout=18
            )

            if r.status_code == 200:
                return r.json()["choices"][0]["message"]["content"].strip()
        except:
            pass

    return None

def ask_cerebras(prompt):
    random.shuffle(CEREBRAS_KEYS)

    for key in CEREBRAS_KEYS:
        try:
            r = requests.post(
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
                timeout=18
            )

            if r.status_code == 200:
                return r.json()["choices"][0]["message"]["content"].strip()
        except:
            pass

    return None

def ask_gemini(prompt):
    for key in GEMINI_KEYS:
        try:
            url = f"https://generativelanguage.googleapis.com/v1beta/models/gemini-1.5-flash:generateContent?key={key}"

            r = requests.post(
                url,
                json={
                    "contents":[{"parts":[{"text":prompt}]}]
                },
                timeout=18
            )

            if r.status_code == 200:
                data = r.json()
                return data["candidates"][0]["content"]["parts"][0]["text"].strip()
        except:
            pass

    return None

def ask_pollinations(prompt):
    try:
        r = requests.get(
            "https://text.pollinations.ai/" + prompt,
            timeout=15
        )
        if r.status_code == 200:
            return r.text.strip()
    except:
        pass

    return None

def ask_ai(cid, msg):
    prompt = build_prompt(cid, msg)

    for fn in [ask_cerebras, ask_groq, ask_gemini, ask_pollinations]:
        try:
            out = fn(prompt)
            if out:
                return out
        except:
            pass

    return "NeuroMV is temporarily unavailable. Please try again shortly."

# ==================================================
# IMAGE
# ==================================================
def want_image(msg):
    low = msg.lower()
    return any(x in low for x in IMAGE_WORDS)

def make_image(prompt):
    return {
        "url":"https://image.pollinations.ai/prompt/" + prompt.replace(" ","%20")
    }

# ==================================================
# FILE / VISION
# ==================================================
def read_image(file_bytes):
    return "Image received successfully. I can describe the photo, detect objects, explain the scene, or analyze details if you'd like."

def read_text(file_bytes):
    try:
        txt = file_bytes.decode("utf-8", errors="ignore")[:1500]

        if not txt.strip():
            return "File received, but the content appears to be empty or unreadable."

        return "This file contains:\n\n" + txt + "\n\nWould you like a summary or deeper explanation?"
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
    pin = request.json.get("pin","")
    if pin_exists():
        return jsonify({"error":"PIN already exists"}),400

    set_pin(pin)
    return jsonify({"status":"created"})

@app.route("/pin/check", methods=["POST"])
def pin_check():
    pin = request.json.get("pin","")

    if pin_ok(pin):
        session["pin_ok"] = True
        return jsonify({"ok":True})

    return jsonify({"ok":False}),401

@app.route("/chat", methods=["POST"])
def chat():
    cid = request.form.get("chat_id","default")
    msg = request.form.get("message","").strip()

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

            push(cid,"user","[file]")
            push(cid,"bot",reply)

            return jsonify({"type":"text","reply":reply})

    # BLOCK
    if blocked(msg):
        return jsonify({"type":"text","reply":"I can't help with that request."})

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

    push(cid,"user",msg)
    push(cid,"bot",reply)

    return jsonify({
        "type":"text",
        "reply":reply
    })

# ==================================================
# RUN
# ==================================================
if __name__ == "__main__":
    app.run(host="0.0.0.0", port=5000, debug=True)
