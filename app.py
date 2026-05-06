from flask import Flask, render_template, request, jsonify, session
import requests, os

app = Flask(__name__)
app.secret_key = os.getenv("SECRET_KEY", "neuromv")

MEMORY_SIZE = 12

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
    ctx = ""
    for m in mem:
        ctx += f"{m['role']}: {m['text']}\n"
    ctx += f"user: {msg}\nNeuroMV:"
    return ctx

# ===== DETECT =====
def is_search(msg):
    keys = ["what","who","when","where","why","news","weather"]
    return any(k in msg.lower() for k in keys)

IMAGE_KEYS = ["image","draw","anime","art","picture","generate image"]
NSFW = ["sex","nude","porn","nsfw","explicit","18+"]

def is_image(msg):
    return any(k in msg.lower() for k in IMAGE_KEYS)

def is_nsfw(msg):
    return any(k in msg.lower() for k in NSFW)

# ===== AI =====
def ai(prompt):
    try:
        r = requests.get(f"https://text.pollinations.ai/{prompt}", timeout=10)
        return r.text
    except:
        return "⚠️ NeuroMV encountered an error."

def search(msg):
    try:
        r = requests.get(f"https://api.duckduckgo.com/?q={msg}&format=json")
        data = r.json()
        return data.get("AbstractText") or "No results found."
    except:
        return "⚠️ Search failed."

# ===== ROUTES =====
@app.route("/")
def index():
    return render_template("index.html")

@app.route("/chat", methods=["POST"])
def chat():
    chat_id = request.form.get("chat_id")
    msg = request.form.get("message", "")

    # FILE
    if "file" in request.files:
        return jsonify({"type":"text","reply":"🧠 NeuroMV is analyzing your file."})

    # IMAGE
    if is_image(msg):
        if is_nsfw(msg):
            return jsonify({
                "type":"error",
                "reply":"⚠️ NeuroMV Content Guard activated.\nThis image request violates generation policies."
            })

        url = "https://image.pollinations.ai/prompt/" + msg.replace(" ","%20")
        return jsonify({"type":"image","url":url})

    # SEARCH
    if is_search(msg):
        res = search(msg)
        push(chat_id,"user",msg)
        push(chat_id,"bot",res)
        return jsonify({"type":"search","reply":res})

    # AI
    prompt = build_prompt(chat_id,msg)
    res = ai(prompt)

    push(chat_id,"user",msg)
    push(chat_id,"bot",res)

    return jsonify({"type":"text","reply":res})

@app.route("/clear_chat", methods=["POST"])
def clear_chat():
    chat_id = request.json.get("chat_id")
    if "mem" in session and chat_id in session["mem"]:
        session["mem"].pop(chat_id)
    return jsonify({"ok":True})

if __name__ == "__main__":
    app.run(debug=True)
