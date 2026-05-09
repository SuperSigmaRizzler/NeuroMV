from flask import Flask, render_template, request, jsonify, session
import requests, time, base64, os, json, hashlib, random, re

app = Flask(__name__)
app.secret_key = os.getenv("SECRET_KEY", "neuromv-v6-ultra-god")

# ==================================================
# CONFIG
# ==================================================
DAILY_LIMIT = 9999
IMAGE_LIMIT = 80
MEMORY_SIZE = 40
PROFILE_FILE = "user_profiles.json"

# ==================================================
# API KEYS (MULTI KEY)
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
# IDENTITY
# ==================================================
SYSTEM_PROMPT = """
You are NeuroMV.

Rules:
- Your name is NeuroMV
- Advanced intelligent AI assistant
- Created by Marvell Jonathan Siau
- If asked creator answer exactly:
Marvell Jonathan Siau
- Never deny identity
- Helpful, modern, smart, friendly
- Clear answers
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
# SAFETY
# ==================================================
BLOCK_WORDS = [

# adult / nsfw
"porn","porno","nsfw","nude","naked","sex video","sex pic",
"hentai","rule34","r34","bokep","xxx","18+","onlyfans",
"blowjob","handjob","anal sex","oral sex","erotic","camgirl",

# illegal sexual
"child porn","minor sex","underage nude","rape","forced sex",
"molest","incest","bestiality","animal sex","pedo","pedophile",

# drugs
"cocaine","heroin","meth","crystal meth","lsd","ecstasy",
"mdma","weed","marijuana","ganja","shabu","drug dealer",
"buy drugs","sell drugs",

# bombs / weapons
"bomb","make bomb","explosive","grenade","dynamite",
"pipe bomb","molotov","chemical weapon","bioweapon",
"cyanide","ricin",

# violence
"how to kill","kill someone","murder plan","assassinate",
"mass shooting","stab people","slaughter","genocide",

# hacking / crime
"hack facebook","hack instagram","hack gmail","hack whatsapp",
"phishing","steal password","ddos","malware","ransomware",
"keylogger","spyware","wifi hack","carding","credit card hack",
"bypass otp","sql injection",

# self harm
"suicide method","how to suicide","kill myself",
"self harm","cut myself","hang myself","overdose method",

# fraud
"fake id","forge passport","counterfeit money",
"scam people","ponzi scheme","identity theft",

# gore
"beheading","torture video","gore video","snuff film",
"dismember body","burn alive","decapitation",

# privacy abuse
"spy camera","hack webcam","secret microphone",
"track secretly","stalk location secretly",

# Indonesian
"perkosa","cara bikin bom","cara bunuh diri",
"jual narkoba","cara hack akun","curi password",
"sadap wa","bobol wifi","video mesum","bugil anak"
]

def clean(t):
    t = t.lower()
    t = re.sub(r"[_\-.]+", " ", t)
    t = re.sub(r"\s+", " ", t).strip()
    return t

def blocked(msg):
    t = clean(msg)
    return any(x in t for x in BLOCK_WORDS)

# ==================================================
# UTIL
# ==================================================
def today():
    return int(time.time() // 86400)

def ensure_counter():
    if session.get("day") != today():
        session["day"] = today()
        session["count"] = 0
        session["img"] = 0

def add_chat():
    ensure_counter()
    session["count"] = session.get("count", 0) + 1

def add_img():
    ensure_counter()
    session["img"] = session.get("img", 0) + 1

def uid():
    ip = request.headers.get("X-Forwarded-For", request.remote_addr)
    ua = request.headers.get("User-Agent", "")
    return hashlib.md5((ip + ua).encode()).hexdigest()

# ==================================================
# PROFILE MEMORY
# ==================================================
def load_profiles():
    try:
        with open(PROFILE_FILE, "r", encoding="utf-8") as f:
            return json.load(f)
    except:
        return {}

def save_profiles(x):
    with open(PROFILE_FILE, "w", encoding="utf-8") as f:
        json.dump(x, f, indent=2)

def get_profile():
    db = load_profiles()
    u = uid()

    if u not in db:
        db[u] = {
            "name":"",
            "likes":[]
        }
        save_profiles(db)

    return db[u]

def learn(msg):
    db = load_profiles()
    u = uid()

    if u not in db:
        db[u] = {"name":"","likes":[]}

    low = msg.lower()

    if "my name is " in low:
        try:
            db[u]["name"] = low.split("my name is ")[1].split(" ")[0].title()
        except:
            pass

    likes = [
        "anime","game","gaming","coding","music",
        "football","basketball","crypto","ai",
        "mlbb","free fire","pubg"
    ]

    for x in likes:
        if x in low and x not in db[u]["likes"]:
            db[u]["likes"].append(x)

    db[u]["likes"] = db[u]["likes"][:20]
    save_profiles(db)

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

def prompt_build(cid, msg):
    p = get_profile()
    m = get_mem(cid)

    txt = SYSTEM_PROMPT + "\n\n"

    if p["name"]:
        txt += "User Name: " + p["name"] + "\n"

    if p["likes"]:
        txt += "User Likes: " + ", ".join(p["likes"]) + "\n"

    txt += "\nRecent Chat:\n"

    for x in m:
        txt += f"{x['role']}: {x['text']}\n"

    txt += f"user: {msg}\nNeuroMV:"
    return txt

# ==================================================
# PROVIDERS
# ==================================================
def ask_groq(prompt):
    random.shuffle(GROQ_KEYS)

    for key in GROQ_KEYS:
        try:
            r = requests.post(
                "https://api.groq.com/openai/v1/chat/completions",
                headers={
                    "Authorization":f"Bearer {key}",
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
    random.shuffle(CEREBRAS_KEYS)

    for key in CEREBRAS_KEYS:
        try:
            r = requests.post(
                "https://api.cerebras.ai/v1/chat/completions",
                headers={
                    "Authorization":f"Bearer {key}",
                    "Content-Type":"application/json"
                },
                json={
                    "model":"llama3.1-8b",
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

def ask_pollinations(prompt):
    try:
        r = requests.get(
            "https://text.pollinations.ai/" + prompt,
            timeout=10
        )
        if r.status_code == 200:
            return r.text.strip()
    except:
        pass
    return None

def ask_ai(cid, msg):
    p = prompt_build(cid, msg)

    for fn in [ask_cerebras, ask_groq, ask_pollinations]:
        try:
            x = fn(p)
            if x:
                return x
        except:
            pass

    return "NeuroMV temporary network issue."

# ==================================================
# IMAGE
# ==================================================
def want_image(msg):
    low = msg.lower()
    return any(x in low for x in IMAGE_WORDS)

def make_image(prompt):
    if blocked(prompt):
        return {"error":"⚠️ Image request blocked."}

    add_img()

    q = prompt + ", ultra detailed, cinematic lighting, 4k"
    url = "https://image.pollinations.ai/prompt/" + q.replace(" ","%20")

    return {"url":url}

# ==================================================
# OCR
# ==================================================
def read_image(b):
    try:
        b64 = base64.b64encode(b).decode()
        q = "Read text and describe image briefly: data:image/png;base64," + b64

        r = requests.get(
            "https://text.pollinations.ai/" + q,
            timeout=12
        )

        if r.status_code == 200:
            return r.text.strip()
    except:
        pass

    return "Image detected."

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

    add_chat()

    if session.get("count",0) > DAILY_LIMIT:
        return jsonify({
            "type":"text",
            "reply":"Daily limit reached."
        })

    # FILE
    if "file" in request.files:
        f = request.files["file"]

        if f and f.filename:
            cap = read_image(f.read())

            push(cid,"user","[image]")
            push(cid,"bot",cap)

            return jsonify({
                "type":"text",
                "reply":cap
            })

    # SAFETY
    if blocked(msg):
        return jsonify({
            "type":"text",
            "reply":"⚠️ NeuroMV cannot assist with that."
        })

    # IMAGE MODE
    if want_image(msg):
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

    # LEARN USER
    learn(msg)

    # AI CHAT
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
