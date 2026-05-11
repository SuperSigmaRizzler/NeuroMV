from flask import Flask, render_template, request, jsonify, session
import requests
import time
import os
import json
import hashlib
import random
import re
import base64
from urllib.parse import quote

# ==================================================
# APP
# ==================================================
app = Flask(__name__)
app.secret_key = os.getenv("SECRET_KEY", "neuromv-pro-secret-key")

# ==================================================
# CONFIG
# ==================================================
DAILY_LIMIT = 100
IMAGE_LIMIT = 20
FILE_LIMIT = 10
MEMORY_SIZE = 60
REQUEST_TIMEOUT = 25

PROFILE_FILE = "user_profiles.json"

# ==================================================
# HELPERS
# ==================================================
def split_keys(name):
    raw = os.getenv(name, "")
    return [x.strip() for x in raw.split(",") if x.strip()]

GROQ_KEYS = split_keys("GROQ_API_KEYS") or split_keys("GROQ_API_KEY")
GEMINI_KEYS = split_keys("GEMINI_API_KEYS") or split_keys("GEMINI_API_KEY")
CEREBRAS_KEYS = split_keys("CEREBRAS_API_KEYS") or split_keys("CEREBRAS_API_KEY")

SYSTEM_PROMPT = """
You are NeuroMV, a premium AI assistant.

Rules:
- Match user's language automatically.
- Understand typos and hidden intent deeply.
- Explain smartly with analogies when useful.
- Natural, modern, helpful, sharp.
- Remember previous conversation context.
- Good at coding, logic, school, writing, life advice.
- If user asks image prompts, be expert visual director.
"""

# ==================================================
# BLOCK WORDS (100+)
# ==================================================
BLOCK_WORDS = [
    "porn","porno","sex","seks","xxx","hentai","bokep","jav","xnxx","xvideo",
    "rape","rapist","molest","incest","pedo","pedophile","childporn","telanjang","bugil",
    "suicide","kill myself","self harm","hang myself","overdose","kontol","memek","rule34","Rule 34","r34"
    "murder","kill someone","bomb","grenade","terrorist","terrorism",
    "phishing","keylogger","malware","ransomware","trojan","rat virus",
    "ddos","sql injection","steal password","hack account","hack gmail",
    "hack whatsapp","carding","otp bypass","bruteforce","hack wifi",
    "cocaine","heroin","meth","weed","marijuana","ganja","lsd","mdma",
    "fake id","forged passport","counterfeit money","money laundering",
    "dark web","buy organs","stolen credit card",
    "قتل","انتحار","إباحية","قنبلة","اختراق",
    "色情","自杀","炸弹","黑客","毒品",
    "ポルノ","自殺","爆弾","ハッキング",
    "포르노","자살","폭탄","해킹",
    "порно","самоубийство","бомба","взлом",
    "violacion","matar","viol","tuer",
    "nude","nudity","deepthroat","blowjob","handjob","milf","bdsm",
    "bestiality","snuff","massacre","assassinate","shoot school",
    "drug lab","make meth","sabu","putaw","retas akun","curi password",
    "rakit bom","senjata api","granat","teroris"
]

def blocked(msg):
    t = msg.lower()
    for w in BLOCK_WORDS:
        if w in t:
            return True
    return False

# ==================================================
# BASIC
# ==================================================
def today():
    return int(time.time() // 86400)

def ensure_daily():
    if session.get("day") != today():
        session["day"] = today()
        session["chat_count"] = 0
        session["image_count"] = 0
        session["file_count"] = 0

def uid():
    ip = request.headers.get("X-Forwarded-For", request.remote_addr or "")
    ua = request.headers.get("User-Agent", "")
    return hashlib.md5((ip + ua).encode()).hexdigest()

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
        "text": text[:4000]
    })

    session["mem"][cid] = arr[-MEMORY_SIZE:]
    session.modified = True

# ==================================================
# IMAGE MEMORY
# ==================================================
def set_last_image(cid, desc):
    if "imgmem" not in session:
        session["imgmem"] = {}

    session["imgmem"][cid] = desc[:5000]
    session.modified = True

def get_last_image(cid):
    return session.get("imgmem", {}).get(cid, "")

# ==================================================
# PROVIDERS
# ==================================================
def post_json(url, headers, payload):
    return requests.post(
        url,
        headers=headers,
        json=payload,
        timeout=REQUEST_TIMEOUT
    )

# ---------------- GEMINI TEXT ----------------
def ask_gemini_text(prompt):
    if not GEMINI_KEYS:
        return None

    keys = GEMINI_KEYS[:]
    random.shuffle(keys)

    for key in keys:
        try:
            url = f"https://generativelanguage.googleapis.com/v1beta/models/gemini-1.5-flash:generateContent?key={key}"

            r = post_json(url, {}, {
                "contents": [{
                    "parts": [{"text": prompt}]
                }]
            })

            if r.status_code == 200:
                data = r.json()
                return data["candidates"][0]["content"]["parts"][0]["text"].strip()
        except:
            pass

    return None

# ---------------- GEMINI VISION ----------------
def ask_gemini_vision(prompt, image_bytes, mime="image/jpeg"):
    if not GEMINI_KEYS:
        return None

    b64 = base64.b64encode(image_bytes).decode()

    keys = GEMINI_KEYS[:]
    random.shuffle(keys)

    for key in keys:
        try:
            url = f"https://generativelanguage.googleapis.com/v1beta/models/gemini-1.5-flash:generateContent?key={key}"

            payload = {
                "contents": [{
                    "parts": [
                        {"text": prompt},
                        {
                            "inline_data": {
                                "mime_type": mime,
                                "data": b64
                            }
                        }
                    ]
                }]
            }

            r = post_json(url, {}, payload)

            if r.status_code == 200:
                data = r.json()
                return data["candidates"][0]["content"]["parts"][0]["text"].strip()
        except:
            pass

    return None

# ---------------- GROQ ----------------
def ask_groq(messages):
    if not GROQ_KEYS:
        return None

    keys = GROQ_KEYS[:]
    random.shuffle(keys)

    for key in keys:
        try:
            r = post_json(
                "https://api.groq.com/openai/v1/chat/completions",
                {
                    "Authorization": f"Bearer {key}",
                    "Content-Type": "application/json"
                },
                {
                    "model": "llama3-70b-8192",
                    "messages": messages,
                    "temperature": 0.7
                }
            )

            if r.status_code == 200:
                return r.json()["choices"][0]["message"]["content"].strip()
        except:
            pass

    return None

# ---------------- CEREBRAS ----------------
def ask_cerebras(messages):
    if not CEREBRAS_KEYS:
        return None

    keys = CEREBRAS_KEYS[:]
    random.shuffle(keys)

    for key in keys:
        try:
            r = post_json(
                "https://api.cerebras.ai/v1/chat/completions",
                {
                    "Authorization": f"Bearer {key}",
                    "Content-Type": "application/json"
                },
                {
                    "model": "llama3.1-8b",
                    "messages": messages
                }
            )

            if r.status_code == 200:
                return r.json()["choices"][0]["message"]["content"].strip()
        except:
            pass

    return None

# ==================================================
# SMART ASK AI
# ==================================================
def ask_ai(cid, msg):
    history = get_mem(cid)

    hist = "\n".join([
        f"{x['role']}: {x['text']}"
        for x in history[-20:]
    ])

    last_img = get_last_image(cid)

    prompt = SYSTEM_PROMPT + "\n\n"

    if hist:
        prompt += "Recent chat:\n" + hist + "\n\n"

    if last_img:
        prompt += "Last uploaded image summary:\n" + last_img + "\n\n"

    prompt += "User: " + msg

    providers = [
        lambda: ask_gemini_text(prompt),
        lambda: ask_groq([
            {"role": "system", "content": SYSTEM_PROMPT},
            {"role": "user", "content": prompt}
        ]),
        lambda: ask_cerebras([
            {"role": "system", "content": SYSTEM_PROMPT},
            {"role": "user", "content": prompt}
        ])
    ]

    for fn in providers:
        try:
            out = fn()
            if out:
                return out
        except:
            pass

    return "Sorry, NeuroMV is temporarily unavailable."

# ==================================================
# TYPO FIX
# ==================================================
def normalize_typo(msg):
    repl = {
        "pls":"please",
        "plss":"please",
        "gmn":"gimana",
        "gmn":"gimana",
        "ak":"aku",
        "aq":"aku",
        "sy":"saya",
        "knp":"kenapa",
        "tdk":"tidak",
        "bgt":"banget"
    }

    words = msg.split()
    out = []

    for w in words:
        out.append(repl.get(w.lower(), w))

    return " ".join(out)

# ==================================================
# ANIME PROMPT BOOSTER
# ==================================================
def make_anime_prompt(msg):
    return f"""
masterpiece, best quality, ultra detailed anime illustration,
cinematic lighting, vibrant colors, sharp focus,
beautiful composition, dynamic pose,
{msg},
high detail face, expressive eyes,
8k wallpaper, trending anime art
""".strip()

# ==================================================
# ROUTES
# ==================================================
@app.route("/")
def home():
    return render_template("index.html")

@app.route("/chat", methods=["POST"])
def chat():
    ensure_daily()

    cid = request.form.get("chat_id", "default")
    msg = request.form.get("message", "").strip()

    # ================= IMAGE / FILE =================
    if "file" in request.files:
        f = request.files["file"]

        if f and f.filename:
            data = f.read()
            low = f.filename.lower()

            if low.endswith((".png",".jpg",".jpeg",".webp")):
                q = msg or "Analyze this image clearly and explain details."

                reply = ask_gemini_vision(q, data)

                if not reply:
                    reply = "I analyzed the image but no result returned."

                set_last_image(cid, reply)

                push(cid, "user", "[image uploaded]")
                push(cid, "bot", reply)

                return jsonify({
                    "type":"text",
                    "reply":reply
                })

            # text file
            try:
                txt = data.decode("utf-8", errors="ignore")[:2500]
                reply = "File content preview:\n\n" + txt if txt.strip() else "File uploaded."
            except:
                reply = "File uploaded."

            push(cid, "user", "[file]")
            push(cid, "bot", reply)

            return jsonify({
                "type":"text",
                "reply":reply
            })

    # ================= EMPTY =================
    if not msg:
        return jsonify({
            "type":"text",
            "reply":"Please type a message."
        })

    # ================= BLOCK =================
    if blocked(msg):
        return jsonify({
            "type":"text",
            "reply":"I can't help with that request."
        })

    # ================= IMAGE GENERATOR =================
    low = msg.lower()

    if any(x in low for x in [
        "image","gambar","draw","foto","poster",
        "logo","art","illustration","anime"
    ]):
        session["image_count"] = session.get("image_count", 0) + 1

        prompt = make_anime_prompt(msg)
        safe = quote(prompt)

        return jsonify({
            "type":"image",
            "url":f"https://image.pollinations.ai/prompt/{safe}"
        })

    # ================= NORMAL CHAT =================
    clean = normalize_typo(msg)

    reply = ask_ai(cid, clean)

    push(cid, "user", msg)
    push(cid, "bot", reply)

    session["chat_count"] = session.get("chat_count", 0) + 1

    return jsonify({
        "type":"text",
        "reply":reply
    })

# ==================================================
# RUN
# ==================================================
if __name__ == "__main__":
    port = int(os.getenv("PORT", 5000))
    app.run(
        host="0.0.0.0",
        port=port,
        debug=False
    )
