from flask import Flask, render_template, request, jsonify, session
import requests, os, hashlib

app = Flask(__name__)
app.secret_key = os.getenv("SECRET_KEY", "neuromv")

MEMORY_SIZE = 12

# ===== PIN SYSTEM =====
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

# ===== PROMPT =====
def build_prompt(chat_id, msg):
    mem = get_mem(chat_id)
    ctx = "You are NeuroMV, created by Marvell Jonathan Siau.\n"
    for m in mem:
        ctx += f"{m['role']}: {m['text']}\n"
    ctx += f"user: {msg}\nNeuroMV:"
    return ctx

# ===== AI (SAFE) =====
def ai(prompt):
    try:
        r = requests.get("https://text.pollinations.ai/", params={"prompt":prompt}, timeout=10)
        if r.text.strip():
            return r.text.strip()
    except:
        pass
    return "⚠️ NeuroMV encountered an error. Please try again later / contact the owner of this app"

# ===== ROUTES =====
@app.route("/")
def index():
    return render_template("index.html")

@app.route("/chat", methods=["POST"])
def chat():
    chat_id = request.form.get("chat_id")
    msg = request.form.get("message","")

    res = ai(build_prompt(chat_id,msg))
    push(chat_id,"user",msg)
    push(chat_id,"bot",res)

    return jsonify({"type":"text","reply":res})

# ===== PIN ROUTES =====
@app.route("/set_pin", methods=["POST"])
def setpin():
    pin = request.json.get("pin")
    set_pin(pin)
    return jsonify({"ok":True})

@app.route("/verify_pin", methods=["POST"])
def verifypin():
    pin = request.json.get("pin")
    if verify_pin(pin):
        session["unlocked"] = True
        return jsonify({"ok":True})
    return jsonify({"ok":False})

@app.route("/check_unlock")
def check_unlock():
    return jsonify({"unlocked": session.get("unlocked", False)})

if __name__ == "__main__":
    app.run(debug=True)
