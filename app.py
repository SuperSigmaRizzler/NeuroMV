from flask import Flask, request, jsonify, render_template
import requests
import os

app = Flask(__name__)

@app.route("/")
def home():
    return render_template("index.html")

@app.route("/chat", methods=["POST"])
def chat():
    API_KEY = os.environ.get("API_KEY", "").strip()

    if not API_KEY:
        return jsonify({"reply":"❌ API_KEY belum terbaca di server (runtime)"})

    msg = request.json["message"]

    headers = {
        "Authorization": f"Bearer {API_KEY}",
        "Content-Type": "application/json"
    }

    data = {
        "model":"llama-3.1-8b-instant",
        "messages":[
            {"role":"user","content":msg}
        ]
    }

    r = requests.post(
        "https://api.groq.com/openai/v1/chat/completions",
        headers=headers,
        json=data
    )

    res = r.json()

    reply = res["choices"][0]["message"]["content"]

    return jsonify({"reply":reply})

app.run(host="0.0.0.0", port=int(os.environ.get("PORT",8080")))
