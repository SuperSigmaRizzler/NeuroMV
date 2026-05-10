from flask import Flask, render_template, request, jsonify, session
import requests
import time
import os
import json
import hashlib
import random
import re

# ==================================================
# APP
# ==================================================
app = Flask(__name__)
app.secret_key = os.getenv("SECRET_KEY", "neuromv-pro-secret-key")

# ==================================================
# CONFIG
# ==================================================
DAILY_LIMIT = 100
IMAGE_LIMIT = 5
FILE_LIMIT = 5

MEMORY_SIZE = 10
PROFILE_FILE = "user_profiles.json"
PIN_FILE = "pin_db.json"

REQUEST_TIMEOUT = 20

# ==================================================
# PROVIDER KEYS
# ==================================================
def split_keys(name):
    raw = os.getenv(name, "")
    return [x.strip() for x in raw.split(",") if x.strip()]

GROQ_KEYS = split_keys("GROQ_API_KEYS") or split_keys("GROQ_API_KEY")
GEMINI_KEYS = split_keys("GEMINI_API_KEYS") or split_keys("GEMINI_API_KEY")
CEREBRAS_KEYS = split_keys("CEREBRAS_API_KEYS") or split_keys("CEREBRAS_API_KEY")

# ==================================================
# SYSTEM PROMPT
# ==================================================
SYSTEM_PROMPT = """
You are NeuroMV, a premium AI assistant created by Marvell Jonathan Siau.

Rules:
- Smart, accurate, natural.
- Match user's language automatically.
- Helpful for coding, reasoning, school, business, writing.
- If unsure, be honest.
- Never act robotic.
- Keep answers useful and clean.
"""

# ==================================================
# HELPERS
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
# PROFILE
# ==================================================
def get_profile():
    db = read_json(PROFILE_FILE, {})
    u = uid()

    if u not in db:
        db[u] = {
            "name": "",
            "likes": []
        }
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

    arr.append({
        "role": role,
        "text": text[:1200]
    })

    if len(arr) > MEMORY_SIZE:
        arr = arr[-MEMORY_SIZE:]

    session["mem"][cid] = arr


# ==================================================
# ADVANCED BLOCK WORDS (100+) MULTI LANGUAGE
# Anti bypass: 0=o, 1=i/l, 3=e, 4=a, 5=s, 7=t, etc
# ==================================================

LEET_MAP = str.maketrans({
    "0":"o",
    "1":"i",
    "3":"e",
    "4":"a",
    "5":"s",
    "6":"g",
    "7":"t",
    "8":"b",
    "9":"g",
    "@":"a",
    "$":"s",
    "!":"i"
})

BLOCK_WORDS = [

# sexual / exploitative
"porn","porno","pornography","xxx","sex","seks","sexual","nude","nudity",
"naked","hentai","bokep","jav","xnxx","xvideo","onlyfans","camgirl",
"camsex","fetish","blowjob","handjob","deepthroat","milf","bdsm",
"rape","rapist","molest","molestation","incest","pedophile","pedo",
"childporn","cp","underage sex","loli","bestiality",

# self harm
"suicide","kill myself","self harm","cut myself","hang myself",
"overdose","end my life","want to die","bunuh diri","gantung diri",
"melukai diri","mati saja","akhiri hidup",

# violence / weapons
"murder","kill someone","assassinate","stab","shoot","massacre",
"bomb","grenade","terrorist","terrorism","explode","how to kill",
"membunuh","bunuh orang","tembak","tikam","bom","rakit bom",
"senjata api","granat","teroris",

# cybercrime
"phishing","keylogger","malware","ransomware","trojan","rat virus",
"ddos","sql injection","steal password","hack account","hack ig",
"hack gmail","hack whatsapp","carding","otp bypass","bruteforce",
"bobol akun","retas akun","curi password","hack wifi",

# drugs
"cocaine","heroin","meth","weed","marijuana","ganja","lsd",
"ecstasy","mdma","drug lab","make meth","narkoba","sabu","putaw",

# fraud / illegal
"fake id","forged passport","counterfeit money","money laundering",
"dark web","buy organs","stolen credit card","jual data curian",

# Arabic
"قتل","انتحار","إباحية","قنبلة","اختراق","مخدرات","اغتصاب",

# Chinese
"色情","自杀","炸弹","黑客","毒品","强奸","杀人",

# Japanese
"ポルノ","自殺","爆弾","ハッキング","麻薬","レイプ","殺人",

# Korean
"포르노","자살","폭탄","해킹","마약","강간","살인",

# Russian
"порно","самоубийство","бомба","взлом","наркотики","изнасилование","убить",

# Spanish
"porno","suicidio","bomba","hackear","drogas","violacion","matar",

# French
"porno","suicide","bombe","piratage","drogue","viol","tuer"
]

def normalize_text(text):
    text = text.lower()
    text = text.translate(LEET_MAP)

    # remove separators / punctuation / spaces
    text = re.sub(r"[\W_]+", " ", text)
    text = re.sub(r"\s+", " ", text).strip()

    return text

def blocked(msg):
    t = normalize_text(msg)

    for word in BLOCK_WORDS:
        if word in t:
            return True

    return False 

# ==================================================
# IMAGE
# ==================================================
IMAGE_WORDS = [
    "image","gambar","foto","photo",
    "draw","buat gambar","logo","poster"
]

def want_image(msg):
    low = msg.lower()
    return any(x in low for x in IMAGE_WORDS)

def make_image(prompt):
    safe = prompt.replace(" ", "%20")
    return {
        "url": f"https://image.pollinations.ai/prompt/{safe}"
    }

# ==================================================
# PROMPT MESSAGES
# ==================================================
def build_messages(cid, msg):
    messages = [
        {"role":"system","content":SYSTEM_PROMPT}
    ]

    history = get_mem(cid)

    for x in history:
        role = "assistant" if x["role"] == "bot" else "user"
        messages.append({
            "role": role,
            "content": x["text"]
        })

    messages.append({
        "role":"user",
        "content": msg
    })

    return messages

# ==================================================
# PROVIDERS
# ==================================================
def ask_groq(messages):
    if not GROQ_KEYS:
        return None

    keys = GROQ_KEYS[:]
    random.shuffle(keys)

    for key in keys:
        try:
            r = requests.post(
                "https://api.groq.com/openai/v1/chat/completions",
                headers={
                    "Authorization": f"Bearer {key}",
                    "Content-Type":"application/json"
                },
                json={
                    "model":"llama3-70b-8192",
                    "messages": messages,
                    "temperature":0.7
                },
                timeout=REQUEST_TIMEOUT
            )

            if r.status_code == 200:
                return r.json()["choices"][0]["message"]["content"].strip()

        except:
            pass

    return None

def ask_cerebras(messages):
    if not CEREBRAS_KEYS:
        return None

    keys = CEREBRAS_KEYS[:]
    random.shuffle(keys)

    for key in keys:
        try:
            r = requests.post(
                "https://api.cerebras.ai/v1/chat/completions",
                headers={
                    "Authorization": f"Bearer {key}",
                    "Content-Type":"application/json"
                },
                json={
                    "model":"llama3.1-8b",
                    "messages": messages
                },
                timeout=REQUEST_TIMEOUT
            )

            if r.status_code == 200:
                return r.json()["choices"][0]["message"]["content"].strip()

        except:
            pass

    return None

def ask_gemini(cid, msg):
    if not GEMINI_KEYS:
        return None

    keys = GEMINI_KEYS[:]
    random.shuffle(keys)

    prompt = msg

    for key in keys:
        try:
            url = f"https://generativelanguage.googleapis.com/v1beta/models/gemini-1.5-flash:generateContent?key={key}"

            r = requests.post(
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

        except:
            pass

    return None

def ask_ai(cid, msg):
    messages = build_messages(cid, msg)

    providers = [
        lambda: ask_groq(messages),
        lambda: ask_cerebras(messages),
        lambda: ask_gemini(cid, msg)
    ]

    for fn in providers:
        try:
            out = fn()
            if out and len(out.strip()) > 1:
                return out.strip()
        except:
            pass

    return "Sorry, NeuroMV is temporarily unavailable. Please try again shortly."

# ==================================================
# FILE READER
# ==================================================
def read_image(_):
    return "Image received successfully. I can analyze or describe it."

def read_text(file_bytes):
    try:
        txt = file_bytes.decode("utf-8", errors="ignore")[:1800]

        if not txt.strip():
            return "This file appears empty."

        return f"File content preview:\n\n{txt}\n\nWould you like a summary?"

    except:
        return "File received, but format isn't readable yet."

# ==================================================
# ROUTES
# ==================================================
@app.route("/")
def home():
    return render_template("index.html")

@app.route("/chat", methods=["POST"])
def chat():

    cid = request.form.get("chat_id", "default")
    msg = request.form.get("message", "").strip()

    # CHAT LIMIT
    if over_chat():
        return jsonify({"type":"limit_chat"})

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

            return jsonify({
                "type":"text",
                "reply":reply
            })

    # EMPTY
    if not msg:
        return jsonify({
            "type":"text",
            "reply":"Please type a message."
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
            "url": img["url"]
        })

    # NORMAL CHAT
    reply = ask_ai(cid, msg)

    push(cid,"user",msg)
    push(cid,"bot",reply)

    add_chat()

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
