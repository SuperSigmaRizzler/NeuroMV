from flask import Flask, render_template, request, jsonify, session
import requests, time, base64, os, json, hashlib, random, re

app = Flask(__name__)
app.secret_key = os.getenv("SECRET_KEY", "neuromv-ultra-final-key")

# ==================================================
# CONFIG
# ==================================================
DAILY_LIMIT = 9999
MEMORY_SIZE = 40
PROFILE_FILE = "user_profiles.json"
PIN_FILE = "pin_db.json"

# ==================================================
# SYSTEM STYLE (GAUL + CODING + VISION)
# ==================================================
SYSTEM_PROMPT = """
You are NeuroMV, an advanced AI assistant.

Style:
- Use casual Indonesian (elo, gue) when user is casual
- Be smart, friendly, modern
- Strong in coding, debugging, explaining
- Can analyze images and files deeply
- If unsure, explain clearly instead of guessing

Rules:
- Never refuse harmless requests
- Always try to help
"""

# ==================================================
# IMAGE / VISION KEYWORDS
# ==================================================
IMAGE_WORDS = [
"image","gambar","foto","photo","picture","vision","lihat","scan",
"analyze image","describe image","upload image","kamera"
]

# ==================================================
# BLOCK SYSTEM (ANTI BYPASS UPGRADED)
# ==================================================
BLOCK_WORDS = [
# NSFW
"porn","p0rn","hentai","xxx","nsfw","nude","naked","sex","bokep",

# violence
"kill","murder","suicide","bomb","explosive","grenade",

# hacking
"hack","phishing","ddos","keylogger","steal password","bypass otp",

# drugs
"cocaine","heroin","meth","weed","ganja",

# indonesian
"perkosa","bunuh diri","sadap wa","bobol wifi"
]

def normalize(t):
    t = t.lower()
    t = t.replace("0","o").replace("1","i").replace("3","e").replace("4","a")
    t = re.sub(r"[^a-z0-9 ]","",t)
    t = re.sub(r"\s+"," ",t).strip()
    return t

def blocked(msg):
    t = normalize(msg)
    return any(w in t for w in BLOCK_WORDS)

# ==================================================
# UID
# ==================================================
def uid():
    ip = request.headers.get("X-Forwarded-For", request.remote_addr)
    ua = request.headers.get("User-Agent", "")
    return hashlib.md5((ip + ua).encode()).hexdigest()

# ==================================================
# PIN SYSTEM (SECURE BACKEND)
# ==================================================
def load_pin():
    try:
        with open(PIN_FILE,"r") as f:
            return json.load(f)
    except:
        return {}

def save_pin(d):
    with open(PIN_FILE,"w") as f:
        json.dump(d,f)

def hash_pin(p):
    return hashlib.sha256(p.encode()).hexdigest()

def pin_exists():
    db = load_pin()
    return uid() in db

def pin_ok(pin):
    db = load_pin()
    u = uid()
    return u in db and db[u] == hash_pin(pin)

def set_pin(pin):
    db = load_pin()
    db[uid()] = hash_pin(pin)
    save_pin(db)

# ==================================================
# PROFILE MEMORY
# ==================================================
def load_profiles():
    try:
        with open(PROFILE_FILE,"r") as f:
            return json.load(f)
    except:
        return {}

def save_profiles(d):
    with open(PROFILE_FILE,"w") as f:
        json.dump(d,f)

def get_profile():
    db = load_profiles()
    u = uid()
    if u not in db:
        db[u] = {"name":"","likes":[]}
        save_profiles(db)
    return db[u]

# ==================================================
# CHAT MEMORY
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
# AI PROMPT BUILDER (GAUL + CODING + VISION READY)
# ==================================================
def build_prompt(cid, msg):
    p = get_profile()
    m = get_mem(cid)

    txt = SYSTEM_PROMPT + "\n"

    if p["name"]:
        txt += f"User name: {p['name']}\n"

    txt += "\nChat history:\n"
    for x in m:
        txt += f"{x['role']}: {x['text']}\n"

    txt += f"user: {msg}\nassistant:"
    return txt

# ==================================================
# IMAGE DETECT
# ==================================================
def want_image(msg):
    return any(x in msg.lower() for x in IMAGE_WORDS)

def make_image(prompt):
    if blocked(prompt):
        return {"error":"blocked"}

    url = "https://image.pollinations.ai/prompt/" + prompt.replace(" ","%20")
    return {"url":url}

# ==================================================
# FILE / VISION ENGINE (ULTRA FEATURE)
# ==================================================
def read_image(file_bytes):
    b64 = base64.b64encode(file_bytes).decode()

    # simulate vision AI
    return "Alright I received the file, want me to break it down more specifically?"

def read_text(file_bytes):
    try:
        return file_bytes.decode("utf-8", errors="ignore")[:3000]
    except:
        return "Cannot read file"

# ==================================================
# ROUTES
# ==================================================
@app.route("/")
def home():
    return render_template("index.html")

# =========================
# PIN ROUTES
# =========================
@app.route("/pin/setup", methods=["POST"])
def pin_setup():
    pin = request.json.get("pin")

    if pin_exists():
        return jsonify({"error":"PIN already exists"}),400

    set_pin(pin)
    return jsonify({"status":"created"})

@app.route("/pin/check", methods=["POST"])
def pin_check():
    pin = request.json.get("pin")

    if pin_ok(pin):
        session["pin_ok"] = True
        return jsonify({"ok":True})

    return jsonify({"ok":False}),401

# =========================
# CHAT
# =========================
@app.route("/chat", methods=["POST"])
def chat():

    cid = request.form.get("chat_id","default")
    msg = request.form.get("message","")

    # FILE HANDLING (VISION + TEXT)
    if "file" in request.files:
        f = request.files["file"]

        if f:
            data = f.read()

            if f.filename.lower().endswith((".png",".jpg",".jpeg",".webp")):
                cap = read_image(data)
            else:
                cap = read_text(data)

            push(cid,"user","[file]")
            push(cid,"bot",cap)

            return jsonify({"type":"text","reply":cap})

    # SAFETY
    if blocked(msg):
        return jsonify({"type":"text","reply":"Blocked request"})

    # IMAGE MODE
    if want_image(msg):
        return jsonify({
            "type":"image",
            "url":make_image(msg)["url"]
        })

    # AI
    reply = ask_ai(cid,msg)

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
