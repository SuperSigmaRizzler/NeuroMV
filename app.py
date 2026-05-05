from flask import Flask, render_template, request, jsonify
import requests
import urllib.parse

app = Flask(__name__)

# =========================
# HOME
# =========================
@app.route("/")
def home():
    return render_template("index.html")

# =========================
# IMAGE GENERATOR
# =========================
def generate_image(prompt):
    prompt = urllib.parse.quote(prompt)
    return f"https://image.pollinations.ai/prompt/{prompt}?width=1024&height=1024&model=flux"

# =========================
# AI CHAT
# =========================
def ask_ai(prompt):
    try:
        url = f"https://text.pollinations.ai/{urllib.parse.quote(prompt)}"
        r = requests.get(url, timeout=15)
        if r.status_code == 200:
            return r.text.strip()
    except:
        pass

    return "❌ AI sedang error / limit."

# =========================
# CHAT API
# =========================
@app.route("/chat", methods=["POST"])
def chat():
    msg = request.form.get("message", "").strip()

    if not msg:
        return jsonify({"type":"text","reply":"..."})

    # detect image request
    trigger = ["gambar","image","foto","draw","anime","buatkan gambar","generate"]
    if any(x in msg.lower() for x in trigger):
        return jsonify({
            "type":"image",
            "url": generate_image(msg)
        })

    # text AI
    reply = ask_ai(msg)

    return jsonify({
        "type":"text",
        "reply": reply
    })

# =========================
if __name__ == "__main__":
    app.run(host="0.0.0.0", port=5000)
