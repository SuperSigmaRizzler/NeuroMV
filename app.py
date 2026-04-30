from flask import Flask, render_template, request, jsonify
import requests
import os

app = Flask(__name__)

API_KEY = os.environ.get("API_KEY")

URL = "https://api.groq.com/openai/v1/chat/completions"

headers = {
    "Authorization": f"Bearer {API_KEY}",
    "Content-Type": "application/json"
}

@app.route("/")
def home():
    return render_template("index.html")

@app.route("/chat", methods=["POST"])
def chat():
    msg = request.json["message"]

    payload = {
        "model": "llama-3.1-8b-instant",
        "messages": [
            {
                "role": "system",
                "content": "You are NeuroMV. Reply in same language as user."
            },
            {
                "role": "user",
                "content": msg
            }
        ]
    }

    r = requests.post(URL, headers=headers, json=payload)

    data = r.json()

    try:
        reply = data["choices"][0]["message"]["content"]
    except:
        reply = "AI error"

    return jsonify({"reply": reply})

import os
app.run(host="0.0.0.0", port=int(os.environ.get("PORT", 5000)))
