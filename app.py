from flask import Flask, render_template, request, jsonify, session
import requests, time, hashlib

app = Flask(__name__)
app.secret_key = "neuromv-secure"

DAILY_LIMIT = 50
IMAGE_LIMIT = 10
MEMORY_SIZE = 12

# ===== PIN =====
def hash_pin(pin):
    return hashlib.sha256(pin.encode()).hexdigest()

def set_pin(pin):
    session["pin"] = hash_pin(pin)

def verify_pin(pin):
    return session.get("pin") == hash_pin(pin)

# ===== MEMORY =====
def get_mem(chat_id):
    if "mem" not in session:
        session["mem"] = {}
    if chat_id not in session["mem"]:
        session["mem"][chat_id] = []
    return session["mem"][chat_id]

def push(chat_id, role, text):
    m = get_mem(chat_id)
    m.append({"role": role, "text": text})
    if len(m) > MEMORY_SIZE:
        m.pop(0)
    session["mem"][chat_id] = m

def build_prompt(chat_id, msg):
    mem = get_mem(chat_id)
    ctx = "You are NeuroMV created by Marvell Jonathan Siau.\n"
    for m in mem:
        ctx += f"{m['role']}: {m['text']}\n"
    ctx += f"user: {msg}\nassistant:"
    return ctx

# ===== AI =====
def ai(prompt):
    try:
        r = requests.get("https://text.pollinations.ai/", params={"prompt": prompt}, timeout=10)
        if r.text:
            return r.text
    except:
        pass
    return "NeuroMV is temporarily unavailable."

# ===== IMAGE =====
def gen_image(prompt):
    bad = ["sex","nsfw","porn","nude"]
    if any(b in prompt.lower() for b in bad):
        return None
    url = "https://image.pollinations.ai/prompt/" + prompt.replace(" ","%20")
    return url

@app.route("/")
def home():
    return render_template("index.html")

@app.route("/chat", methods=["POST"])
def chat():
    chat_id = request.form.get("chat_id")
    msg = request.form.get("message","")

    # image mode
    if any(x in msg.lower() for x in ["image","draw","art"]):
        url = gen_image(msg)
        if url:
            return jsonify({"type":"image","url":url})
        return jsonify({"type":"error","reply":"Content blocked."})

    reply = ai(build_prompt(chat_id,msg))

    push(chat_id,"user",msg)
    push(chat_id,"bot",reply)

    return jsonify({"type":"text","reply":reply})

# ===== PIN =====
@app.route("/verify_pin", methods=["POST"])
def vp():
    pin = request.json.get("pin")
    if verify_pin(pin):
        session["unlocked"] = True
        return jsonify({"ok":True})
    return jsonify({"ok":False})

@app.route("/check_unlock")
def cu():
    return jsonify({"unlocked":session.get("unlocked",False)})

if __name__ == "__main__":
    app.run(debug=True)
