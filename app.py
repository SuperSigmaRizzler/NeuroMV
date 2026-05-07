from flask import Flask, render_template, request, jsonify, session
import requests, time, base64, os, hashlib, re, random

app = Flask(__name__)
app.secret_key = os.getenv("SECRET_KEY", "neuromv-v3-godmode")

# ==================================================
# CONFIG
# ==================================================
DAILY_LIMIT = 9999
IMAGE_LIMIT = 50
MEMORY_SIZE = 18

GROQ_API_KEY = os.getenv("GROQ_API_KEY", "")

# ==================================================
# IDENTITY
# ==================================================
SYSTEM_PROMPT = """
You are NeuroMV.

Your identity:
- Your name is NeuroMV
- You are an intelligent AI assistant
- You were created by Marvell Jonathan Siau
- If user asks who created you, answer: Marvell Jonathan Siau
- Never deny your identity
- Always speak naturally
- Never output random code unless user explicitly asks programming help
- Be smart, modern, useful, friendly
"""

# ==================================================
# IMAGE KEYWORDS (100)
# ==================================================
IMAGE_WORDS = [
"image","gambar","foto","draw","drawing","anime","art","generate","create image",
"buat gambar","lukis","paint","painting","render","design","sketch","illustration",
"poster","wallpaper","avatar","profile pic","logo","scene","visual","make photo",
"make image","generate photo","generate picture","picture","pic","snap","portrait",
"landscape","cyberpunk","fantasy","3d","cinematic","realistic","photorealistic",
"manga","waifu","character","robot","spaceship","city","future city","sunset",
"ocean","mountain","forest","dragon","car","supercar","motorcycle","fashion",
"clothes","architecture","house","room","bedroom","kitchen","gaming room",
"cute cat","dog","animal","monster","weapon art","armor","knight","angel",
"demon","galaxy","space","planet","moon","mars","earth","storm","fire","ice",
"magic","wizard","castle","temple","samurai","ninja","battle","warrior","elf",
"fairy","neon","abstract","pixel art","retro","vaporwave","chibi","comic"
]

# ==================================================
# BANNED WORDS (100)
# ==================================================
BANNED = [
"porn","porno","sex","seks","nude","telanjang","bokep","hentai","rule34","r34",
"nsfw","xxx","blowjob","handjob","fetish","cum","milf","bdsm","rape","incest",
"loli","shota","vagina","penis","boobs","tits","nipple","ass","anal","orgasm",
"masturbate","jerkoff","semen","ejaculate","threesome","gangbang","slut","whore",
"escort","prostitute","deepthroat","horny","aroused","naked","undress","lingerie",
"cameltoe","onlyfans","camgirl","camsex","pornhub","xnxx","xvideos","jav",
"oppai","ecchi","yaoi","yuri","furry nsfw","gore sex","child porn","cp",
"pedo","pedophile","bestiality","zoophilia","necrophilia","rapeplay","molest",
"淫乱","裸体","色情","性爱","性","裸體","色情片","エロ","変態","裸","ポルノ",
"섹스","야동","포르노","누드","секc","порно","عرى","اباحي","جنس","pornoğrafi",
"seksueel","seksual","desnudo","sexo","pornografia","nua","putaria"
]

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

# ==================================================
# MEMORY
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

    txt = SYSTEM_PROMPT + "\n"

    for m in mem:
        txt += f"{m['role']}: {m['text']}\n"

    txt += f"user: {msg}\nNeuroMV:"
    return txt

# ==================================================
# AI ROUTER
# ==================================================
def ai_groq(prompt):
    if not GROQ_API_KEY:
        return None

    try:
        r = requests.post(
            "https://api.groq.com/openai/v1/chat/completions",
            headers={
                "Authorization": f"Bearer {GROQ_API_KEY}",
                "Content-Type": "application/json"
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

def ai_pollinations(prompt):
    try:
        r = requests.get(
            "https://text.pollinations.ai/",
            params={"prompt": prompt},
            timeout=10
        )
        if r.status_code == 200 and r.text.strip():
            return r.text.strip()
    except:
        pass
    return None

def ai_local(msg):
    low = msg.lower()

    if "halo" in low or "hai" in low:
        return "Halo! Aku NeuroMV. Ada yang bisa kubantu?"

    if "siapa kamu" in low:
        return "Aku NeuroMV, AI assistant cerdas."

    if "siapa penciptamu" in low or "who created you" in low:
        return "Aku diciptakan oleh Marvell Jonathan Siau."

    return "NeuroMV sedang menstabilkan sistem AI. Coba lagi sebentar."

def ask_ai(chat_id, msg):
    prompt = build_prompt(chat_id, msg)

    for fn in [ai_groq, ai_pollinations]:
        try:
            out = fn(prompt)
            if out:
                return out
        except:
            pass

    return ai_local(msg)

# ==================================================
# IMAGE DETECTION
# ==================================================
def wants_image(msg):
    low = msg.lower()
    for w in IMAGE_WORDS:
        if w in low:
            return True
    return False

def blocked_prompt(msg):
    low = msg.lower()
    for b in BANNED:
        if b in low:
            return True
    return False

def generate_image(prompt):
    if blocked_prompt(prompt):
        return {
            "error":"⚠️ Image request blocked by NeuroMV Safety Guard."
        }

    count_img()

    enhanced = prompt + ", ultra detailed, masterpiece, 4k, cinematic lighting"

    url = "https://image.pollinations.ai/prompt/" + enhanced.replace(" ","%20")

    return {"url": url}

# ==================================================
# OCR / VISION
# ==================================================
def read_image_text(img_bytes):
    try:
        b64 = base64.b64encode(img_bytes).decode()
        prompt = "Read all visible text in this image carefully: data:image/jpeg;base64," + b64

        r = requests.get(
            "https://text.pollinations.ai/",
            params={"prompt": prompt},
            timeout=14
        )

        if r.status_code == 200 and r.text.strip():
            return r.text.strip()

    except:
        pass

    return "Aku melihat gambar, tetapi teks sulit dibaca."

# ==================================================
# PIN
# ==================================================
def h(x):
    return hashlib.sha256(x.encode()).hexdigest()

@app.route("/set_pin", methods=["POST"])
def set_pin():
    pin = request.json.get("pin","")
    session["pin"] = h(pin)
    return jsonify({"ok":True})

@app.route("/verify_pin", methods=["POST"])
def verify_pin():
    pin = request.json.get("pin","")
    if session.get("pin") == h(pin):
        session["unlock"] = True
        return jsonify({"ok":True})
    return jsonify({"ok":False})

@app.route("/check_unlock")
def check_unlock():
    return jsonify({"unlocked": session.get("unlock", False)})

# ==================================================
# ROUTES
# ==================================================
@app.route("/")
def home():
    return render_template("index.html")

@app.route("/chat", methods=["POST"])
def chat():
    count_chat()

    chat_id = request.form.get("chat_id","default")
    msg = request.form.get("message","").strip()

    # FILE OCR
    if "file" in request.files:
        f = request.files["file"]
        if f and f.filename:
            txt = read_image_text(f.read())
            push_memory(chat_id,"user","[image]")
            push_memory(chat_id,"bot",txt)
            return jsonify({
                "type":"text",
                "reply":txt
            })

    # IMAGE MODE
    if wants_image(msg):
        out = generate_image(msg)

        if "error" in out:
            return jsonify({
                "type":"text",
                "reply": out["error"]
            })

        return jsonify({
            "type":"image",
            "url": out["url"]
        })

    # CHAT MODE
    reply = ask_ai(chat_id, msg)

    push_memory(chat_id,"user",msg)
    push_memory(chat_id,"bot",reply)

    return jsonify({
        "type":"text",
        "reply": reply
    })

# ==================================================
# RUN
# ==================================================
if __name__ == "__main__":
    app.run(debug=True)
