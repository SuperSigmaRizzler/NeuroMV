from flask import Flask, render_template, request, jsonify, session
import requests, time, hashlib, os

app = Flask(__name__)
app.secret_key = os.getenv("SECRET_KEY", "neuromv-key")

DAILY_LIMIT = 50
IMAGE_LIMIT = 10
MEMORY_SIZE = 12

# ================= PIN =================
def hash_pin(pin):
    return hashlib.sha256(pin.encode()).hexdigest()

def set_pin(pin):
    session["pin"] = hash_pin(pin)

def verify_pin(pin):
    return session.get("pin") == hash_pin(pin)

# ================= MEMORY =================
def get_mem(chat_id):
    if "mem" not in session:
        session["mem"] = {}
    if chat_id not in session["mem"]:
        session["mem"][chat_id] = []
    return session["mem"][chat_id]

def push(chat_id, role, text):
    mem = get_mem(chat_id)
    mem.append({"role": role, "text": text})
    if len(mem) > MEMORY_SIZE:
        mem.pop(0)
    session["mem"][chat_id] = mem

def build_prompt(chat_id, msg):
    mem = get_mem(chat_id)
    context = "You are NeuroMV created by Marvell Jonathan Siau.\n"
    for m in mem:
        context += f"{m['role']}: {m['text']}\n"
    context += f"user: {msg}\nassistant:"
    return context

# ================= AI =================
def ai(prompt):
    try:
        r = requests.get(
            "https://text.pollinations.ai/",
            params={"prompt": prompt},
            timeout=12
        )
        if r.text.strip():
            return r.text.strip()
    except:
        pass
    return "⚠️ NeuroMV is temporarily unavailable."

# ================= IMAGE =================
def image(prompt):
    bad = ["sex","porn","nude","nsfw"]
    if any(b in prompt.lower() for b in bad):
        return {"error":"Content blocked by safety system."}

    url = "https://image.pollinations.ai/prompt/" + prompt.replace(" ","%20")
    return {"url": url}

# ================= ROUTES =================
@app.route("/")
def home():
    return render_template("index.html")

@app.route("/chat", methods=["POST"])
def chat():
    chat_id = request.form.get("chat_id","default")
    msg = request.form.get("message","")

    if any(x in msg.lower() for x in ["image","draw","art"]):
        out = image(msg)
        if "error" in out:
            return jsonify({"type":"text","reply":out["error"]})
        return jsonify({"type":"image","url":out["url"]})

    reply = ai(build_prompt(chat_id,msg))

    push(chat_id,"user",msg)
    push(chat_id,"bot",reply)

    return jsonify({"type":"text","reply":reply})

# ================= PIN =================
@app.route("/set_pin", methods=["POST"])
def setpin():
    set_pin(request.json.get("pin"))
    return jsonify({"ok":True})

@app.route("/verify_pin", methods=["POST"])
def checkpin():
    pin = request.json.get("pin")
    return jsonify({"ok": verify_pin(pin)})

@app.route("/check_unlock")
def unlock():
    return jsonify({"unlocked": session.get("unlocked", False)})

if __name__ == "__main__":
    app.run(debug=True)
