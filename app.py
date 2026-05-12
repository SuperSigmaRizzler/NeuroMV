from flask import Flask, render_template, request, jsonify, session
import requests
import time
import os
import json
import hashlib
import random
import re
import io
import csv
import zipfile
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
IMAGE_LIMIT = 5
FILE_LIMIT = 10

MEMORY_SIZE = 300
LONG_MEMORY_FILE = "memory_db.json"

REQUEST_TIMEOUT = 20

# ==================================================
# OPTIONAL LIBS
# ==================================================
try:
    import PyPDF2
except:
    PyPDF2 = None

try:
    import docx
except:
    docx = None

# ==================================================
# KEYS
# ==================================================
def split_keys(name):
    raw = os.getenv(name, "")
    return [x.strip() for x in raw.split(",") if x.strip()]

GROQ_KEYS = split_keys("GROQ_API_KEYS") or split_keys("GROQ_API_KEY")
CEREBRAS_KEYS = split_keys("CEREBRAS_API_KEYS") or split_keys("CEREBRAS_API_KEY")

# ==================================================
# PROMPT
# ==================================================
SYSTEM_PROMPT = """
You are NeuroMV, premium AI assistant created by Marvell Jonathan Siau.

Rules:
- Match user language automatically.
- Smart like ChatGPT style.
- Helpful, natural, modern.
- Great at coding, school, business.
- Use clean formatting.
- Understand typo/slang.
- Use analogy only when needed.
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

def over_chat():
    ensure_daily()
    return session["chat_count"] >= DAILY_LIMIT

def over_image():
    ensure_daily()
    return session["image_count"] >= IMAGE_LIMIT

def over_file():
    ensure_daily()
    return session["file_count"] >= FILE_LIMIT

def add_chat():
    session["chat_count"] += 1

def add_image():
    session["image_count"] += 1

def add_file():
    session["file_count"] += 1

# ==================================================
# MEMORY GOD MODE
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

def load_long_mem():
    return read_json(LONG_MEMORY_FILE, {})

def save_long_mem(data):
    write_json(LONG_MEMORY_FILE, data)

def push(cid, role, text):
    text = text[:4000]

    # short memory
    arr = get_mem(cid)
    arr.append({"role": role, "text": text})
    session["mem"][cid] = arr[-MEMORY_SIZE:]
    session.modified = True

    # long memory
    db = load_long_mem()
    u = uid()

    if u not in db:
        db[u] = {}

    if cid not in db[u]:
        db[u][cid] = []

    db[u][cid].append({
        "role": role,
        "text": text
    })

    db[u][cid] = db[u][cid][-1000:]

    save_long_mem(db)

def get_long_context(cid):
    db = load_long_mem()
    u = uid()

    if u in db and cid in db[u]:
        return db[u][cid][-40:]

    return []

# ==================================================
# BLOCK WORDS
# ==================================================
LEET_MAP = str.maketrans({
    "0":"o","1":"i","3":"e","4":"a","5":"s","7":"t","@":"a","$":"s"
})

BLOCK_WORDS = [
    "porn","porno","sex","sexy","nude","bokep","xnxx",
    "suicide","bunuh diri",
    "hack account","phishing","ddos",
    "bomb","terrorist",
    "cocaine","meth","ganja"
]

def normalize_text(text):
    text = text.lower().translate(LEET_MAP)
    text = re.sub(r"[\W_]+", " ", text)
    return re.sub(r"\s+", " ", text).strip()

def blocked(msg):
    t = normalize_text(msg)
    return any(x in t for x in BLOCK_WORDS)

# ==================================================
# IMAGE
# ==================================================
IMAGE_WORDS = [
    "image","gambar","foto","anime","draw",
    "logo","poster","art"
]

def want_image(msg):
    low = msg.lower()
    return any(x in low for x in IMAGE_WORDS)

def make_image(prompt):
    pretty = "masterpiece, best quality, ultra detailed, " + prompt
    safe = quote(pretty)
    return {
        "url": f"https://image.pollinations.ai/prompt/{safe}"
    }

# ==================================================
# FILE READER
# ==================================================
def read_txt(data):
    return data.decode("utf-8", errors="ignore")[:5000]

def read_pdf(data):
    if not PyPDF2:
        return "PyPDF2 not installed."

    try:
        reader = PyPDF2.PdfReader(io.BytesIO(data))
        out = []

        for p in reader.pages[:10]:
            out.append(p.extract_text() or "")

        return "\n".join(out)[:5000]
    except:
        return "Failed read PDF."

def read_docx(data):
    if not docx:
        return "python-docx not installed."

    try:
        d = docx.Document(io.BytesIO(data))
        return "\n".join([p.text for p in d.paragraphs])[:5000]
    except:
        return "Failed read DOCX."

def read_csv_file(data):
    try:
        txt = data.decode("utf-8", errors="ignore")
        rows = list(csv.reader(io.StringIO(txt)))
        return "\n".join([" | ".join(r) for r in rows[:20]])[:5000]
    except:
        return "Failed read CSV."

def read_zip(data):
    try:
        z = zipfile.ZipFile(io.BytesIO(data))
        return "ZIP Contents:\n" + "\n".join(z.namelist()[:50])
    except:
        return "Failed read ZIP."

def smart_read_file(filename, data):
    low = filename.lower()

    if low.endswith(".pdf"):
        return read_pdf(data)

    if low.endswith(".docx"):
        return read_docx(data)

    if low.endswith(".csv"):
        return read_csv_file(data)

    if low.endswith(".zip"):
        return read_zip(data)

    if low.endswith((
        ".txt",".py",".js",".html",".css",
        ".json",".xml",".sql",".php",".cpp",".md"
    )):
        return read_txt(data)

    return "Unsupported file type."

# ==================================================
# WEB SEARCH (no bs4)
# ==================================================
SEARCH_WORDS = [
    "today","latest","news","berapa",
    "harga","terbaru","update","hari apa"
]

def need_search(msg):
    low = msg.lower()
    return any(x in low for x in SEARCH_WORDS)

def web_search(query):
    try:
        url = "https://api.duckduckgo.com/?q=" + quote(query) + "&format=json"
        r = requests.get(url, timeout=10)
        data = r.json()

        out = []

        if data.get("AbstractURL"):
            out.append({
                "title": data.get("Heading","Result"),
                "link": data["AbstractURL"]
            })

        return out
    except:
        return []

# ==================================================
# AI PROVIDERS
# ==================================================
def build_messages(cid, msg):
    messages = [
        {"role":"system","content":SYSTEM_PROMPT}
    ]

    history = get_long_context(cid)

    for x in history[-40:]:
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

def offline_reply(msg):
    return "NeuroMV sedang sibuk sekarang, tapi aku tetap standby buat bantu kamu."

def ask_ai(cid, msg):
    messages = build_messages(cid, msg)

    providers = [
        lambda: ask_groq(messages),
        lambda: ask_cerebras(messages)
    ]

    for fn in providers:
        try:
            out = fn()
            if out:
                return out
        except:
            pass

    return offline_reply(msg)

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

    # FILE
    if "file" in request.files:
        f = request.files["file"]

        if f and f.filename:
            if over_file():
                return jsonify({"type":"limit_file"})

            add_file()

            data = f.read()
            content = smart_read_file(f.filename, data)

            ask = f"""
User uploaded file: {f.filename}

File content:
{content}

User asks:
{msg or 'Explain this file'}
"""

            reply = ask_ai(cid, ask)

            push(cid,"user","[file]")
            push(cid,"bot",reply)

            return jsonify({
                "type":"text",
                "reply":reply
            })

    if not msg:
        return jsonify({
            "type":"text",
            "reply":"Please type a message."
        })

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

    # SEARCH
    if need_search(msg):
        results = web_search(msg)

        if results:
            src = ""
            for r in results:
                src += f"<a href='{r['link']}' target='_blank'>🌐</a> "

            ask = f"""
User asks: {msg}

Realtime search result:
{results[0]['title']}

Answer naturally.
"""
            reply = ask_ai(cid, ask) + "<br><br>" + src

            push(cid,"user",msg)
            push(cid,"bot",reply)

            return jsonify({
                "type":"text",
                "reply":reply
            })

    # NORMAL
    if over_chat():
        return jsonify({"type":"limit_chat"})

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
