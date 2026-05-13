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
import base64
import tempfile
from urllib.parse import quote, urlparse, parse_qs, unquote

# ==================================================
# OPTIONAL LIBS
# ==================================================
try:
    from bs4 import BeautifulSoup
except Exception:
    BeautifulSoup = None

try:
    import PyPDF2
except Exception:
    PyPDF2 = None

try:
    import docx
except Exception:
    docx = None

try:
    from paddleocr import PaddleOCR
except Exception:
    PaddleOCR = None

# ==================================================
# APP
# ==================================================
app = Flask(__name__)
app.secret_key = os.getenv("SECRET_KEY", "neuromv-omega-final-secret")

# ==================================================
# CONFIG
# ==================================================
DAILY_LIMIT = int(os.getenv("DAILY_LIMIT", "200"))
IMAGE_LIMIT = int(os.getenv("IMAGE_LIMIT", "15"))
FILE_LIMIT = int(os.getenv("FILE_LIMIT", "20"))

MEMORY_SIZE = int(os.getenv("MEMORY_SIZE", "120"))
LONG_MEMORY_KEEP = int(os.getenv("LONG_MEMORY_KEEP", "5000"))

LONG_MEMORY_FILE = os.getenv("LONG_MEMORY_FILE", "memory_db.json")
PROFILE_FILE = os.getenv("PROFILE_FILE", "profile_db.json")

REQUEST_TIMEOUT = int(os.getenv("REQUEST_TIMEOUT", "25"))
MAX_RETRIES = int(os.getenv("MAX_RETRIES", "10"))

FORCE_SEARCH = os.getenv("FORCE_SEARCH", "true").lower() != "false"

# ==================================================
# API KEYS
# ==================================================
def split_keys(name):
    raw = os.getenv(name, "")
    keys = []

    for x in raw.split(","):
        x = x.strip()
        if x and x not in keys:
            keys.append(x)

    return keys


def shuffled(arr):
    tmp = arr[:]
    random.shuffle(tmp)
    return tmp


GROQ_KEYS = split_keys("GROQ_API_KEYS") or split_keys("GROQ_API_KEY")
CEREBRAS_KEYS = split_keys("CEREBRAS_API_KEYS") or split_keys("CEREBRAS_API_KEY")
GEMINI_KEYS = split_keys("GEMINI_API_KEYS") or split_keys("GEMINI_API_KEY")

TAVILY_KEYS = split_keys("TAVILY_API_KEYS") or split_keys("TAVILY_API_KEY")
SERPER_KEYS = split_keys("SERPER_API_KEYS") or split_keys("SERPER_API_KEY")
SERPAPI_KEYS = split_keys("SERPAPI_KEYS") or split_keys("SERPAPI_KEY")
BRAVE_KEYS = split_keys("BRAVE_SEARCH_API_KEYS") or split_keys("BRAVE_SEARCH_API_KEY")

GOOGLE_API_KEYS = split_keys("GOOGLE_API_KEYS") or split_keys("GOOGLE_API_KEY")
GOOGLE_CSE_IDS = split_keys("GOOGLE_CSE_IDS") or split_keys("GOOGLE_CSE_ID")

OCR_SPACE_KEYS = split_keys("OCR_SPACE_API_KEYS") or split_keys("OCR_SPACE_API_KEY")
HF_KEYS = split_keys("HF_API_KEYS") or split_keys("HF_API_KEY")

CLOUDFLARE_ACCOUNT_IDS = split_keys("CLOUDFLARE_ACCOUNT_IDS") or split_keys("CLOUDFLARE_ACCOUNT_ID")
CLOUDFLARE_API_TOKENS = split_keys("CLOUDFLARE_API_TOKENS") or split_keys("CLOUDFLARE_API_TOKEN")

# ==================================================
# SYSTEM PROMPT
# ==================================================
SYSTEM_PROMPT = """
You are NeuroMV, a premium AI assistant created by Marvell Jonathan Siau.

Identity:
- Keep your identity as NeuroMV.
- Do not claim to be ChatGPT.
- You can feel similar in quality to a premium modern AI assistant, but your name is NeuroMV.

Response style:
- Match the user's language and tone automatically.
- If the user is formal, answer formally.
- If the user is casual, answer smart-casual.
- Be warm, sharp, helpful, and natural.
- Use emojis lightly and only when helpful.
- Praise users naturally when they succeed or make progress.
- Use clean formatting with headings and steps when useful.
- For code, use neat fenced code blocks.
- Use analogies only when they genuinely help.
- Do not overuse "Bayangin".
- Understand typos, slang, and short messy messages.

Factual/current information:
- If live search results are provided, prioritize them over memory and model knowledge.
- Never override live search results with old memory.
- For current leaders, prices, dates, news, releases, schedules, and events, do not guess.
- If current web data is unavailable or unclear, say so honestly.

Vision:
- If OCR text and visual description are provided, combine both.
- OCR text is for reading text inside images.
- Vision description is for understanding the actual scene, objects, layout, and context.

Memory:
- Use memory when relevant.
- If user asks what they discussed earlier, answer from memory context if available.
- If memory is not enough, say you do not have enough saved context instead of pretending.
"""

# ==================================================
# JSON HELPERS
# ==================================================
def read_json(path, default):
    try:
        if not os.path.exists(path):
            return default

        with open(path, "r", encoding="utf-8") as f:
            return json.load(f)

    except Exception:
        return default


def write_json(path, data):
    try:
        with open(path, "w", encoding="utf-8") as f:
            json.dump(data, f, indent=2, ensure_ascii=False)

    except Exception:
        pass

# ==================================================
# USER ID
# ==================================================
def uid():
    if "neuromv_user_id" in session:
        return session["neuromv_user_id"]

    client_id = request.form.get("user_id") or request.headers.get("X-NeuroMV-User")

    if client_id:
        base = hashlib.sha256(client_id.encode()).hexdigest()
    else:
        ip = request.headers.get("X-Forwarded-For", request.remote_addr or "")
        ua = request.headers.get("User-Agent", "")
        base = hashlib.sha256((ip + ua).encode()).hexdigest()

    session["neuromv_user_id"] = base
    session.modified = True

    return base

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
    return session.get("chat_count", 0) >= DAILY_LIMIT


def over_image():
    ensure_daily()
    return session.get("image_count", 0) >= IMAGE_LIMIT


def over_file():
    ensure_daily()
    return session.get("file_count", 0) >= FILE_LIMIT


def add_chat():
    ensure_daily()
    session["chat_count"] = session.get("chat_count", 0) + 1


def add_image():
    ensure_daily()
    session["image_count"] = session.get("image_count", 0) + 1


def add_file():
    ensure_daily()
    session["file_count"] = session.get("file_count", 0) + 1

# ==================================================
# MEMORY SYSTEM
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


def load_long():
    return read_json(LONG_MEMORY_FILE, {})


def save_long(data):
    write_json(LONG_MEMORY_FILE, data)


def normalize_memory_db(db, u):
    if u not in db:
        db[u] = {
            "global": [],
            "chats": {}
        }
        return db[u]

    if isinstance(db[u], dict) and "global" in db[u] and "chats" in db[u]:
        return db[u]

    old = db[u]

    new = {
        "global": [],
        "chats": {}
    }

    if isinstance(old, dict):
        for cid, arr in old.items():
            if isinstance(arr, list):
                new["chats"][cid] = arr

                for item in arr:
                    if isinstance(item, dict):
                        copy = dict(item)
                        copy["chat_id"] = cid
                        new["global"].append(copy)

    db[u] = new
    return db[u]


def push(cid, role, text):
    text = str(text or "")[:5000]
    now = int(time.time())

    item = {
        "role": role,
        "text": text,
        "time": now,
        "chat_id": cid
    }

    arr = get_mem(cid)
    arr.append(item)
    session["mem"][cid] = arr[-MEMORY_SIZE:]
    session.modified = True

    db = load_long()
    u = uid()

    bucket = normalize_memory_db(db, u)

    if cid not in bucket["chats"]:
        bucket["chats"][cid] = []

    bucket["chats"][cid].append(item)
    bucket["chats"][cid] = bucket["chats"][cid][-LONG_MEMORY_KEEP:]

    bucket["global"].append(item)
    bucket["global"] = bucket["global"][-LONG_MEMORY_KEEP:]

    save_long(db)


def all_long_memory():
    db = load_long()
    u = uid()

    if u not in db:
        return []

    bucket = normalize_memory_db(db, u)

    out = bucket.get("global", [])
    out.sort(key=lambda x: x.get("time", 0))

    return out[-500:]


def memory_summary_text(limit=80):
    items = all_long_memory()[-limit:]

    if not items:
        return ""

    lines = []

    for x in items:
        role = "assistant" if x.get("role") == "bot" else "user"
        txt = str(x.get("text", ""))[:800]
        lines.append(f"{role}: {txt}")

    return "\n".join(lines)

# ==================================================
# PROFILE / INTEREST SYSTEM
# ==================================================
def get_profile():
    db = read_json(PROFILE_FILE, {})
    u = uid()

    if u not in db:
        db[u] = {
            "likes": [],
            "tone": ""
        }
        write_json(PROFILE_FILE, db)

    return db[u]


def save_profile(profile):
    db = read_json(PROFILE_FILE, {})
    db[uid()] = profile
    write_json(PROFILE_FILE, db)


def learn_interest(msg):
    low = msg.lower()
    p = get_profile()

    tags = []

    if any(x in low for x in [
        "python", "html", "css", "javascript", "js",
        "coding", "programming", "flask", "github",
        "app.py", "script.js"
    ]):
        tags.append("coding")

    if any(x in low for x in ["anime", "manga", "waifu"]):
        tags.append("anime")

    if any(x in low for x in ["game", "gaming", "mlbb", "minecraft", "roblox"]):
        tags.append("gaming")

    if any(x in low for x in ["ai", "chatbot", "neuro", "neuromv", "machine learning"]):
        tags.append("ai projects")

    for t in tags:
        if t not in p.get("likes", []):
            p.setdefault("likes", []).append(t)

    if tags:
        save_profile(p)

# ==================================================
# QUANTUM SENTINEL BLOCKER
# ==================================================
LEET_MAP = str.maketrans({
    "0": "o",
    "1": "i",
    "2": "z",
    "3": "e",
    "4": "a",
    "5": "s",
    "6": "g",
    "7": "t",
    "8": "b",
    "9": "g",
    "@": "a",
    "$": "s",
    "!": "i",
    "+": "t",
    "|": "i"
})

BLOCK_WORDS = [
    "porn", "porno", "sex", "sexy", "nude", "nudity",
    "bokep", "hentai", "xnxx", "xvideo", "onlyfans",
    "telanjang", "bugil",

    "kill", "murder", "bomb", "terrorist", "shoot",
    "stab", "bunuh", "bom", "racun",

    "suicide", "selfharm", "killmyself", "bunuhdiri", "matiaja",

    "hack", "phishing", "ddos", "malware", "ransomware",
    "stealpassword", "retas", "bobolakun", "curipassword", "hackwifi",

    "scam", "fakeid", "ktppalsu",

    "cocaine", "heroin", "meth", "ganja", "weed", "sabu", "narkoba"
]

INTENT_PATTERNS = [
    r"(cara|how).*(hack|retas|bobol|masuk).*(akun|account)",
    r"(ambil|curi).*(password|otp|sandi)",
    r"(sadap|spy).*(wa|whatsapp|ig|instagram|gmail)",
    r"(cara).*(bunuh diri|kill myself)",
    r"(ingin|pengen|want).*(mati|die)",
    r"(cara).*(bomb|bom|racun)",
    r"(buat|make).*(ktp palsu|fake id)"
]


def normalize_text(text):
    text = str(text or "").lower()
    text = text.translate(LEET_MAP)
    text = re.sub(r"[\u200b-\u200d\uFEFF]", "", text)
    text = re.sub(r"[^a-z0-9\s]", "", text)
    text = text.replace(" ", "")
    text = re.sub(r"(.)\1{2,}", r"\1", text)
    return text


def collapse_spaced_text(text):
    return "".join(re.findall(r"[a-zA-Z]", str(text or "").lower()))


def blocked(msg):
    raw = str(msg or "").lower()
    norm = normalize_text(msg)
    compact = re.sub(r"[\W_]+", "", raw)
    collapsed = collapse_spaced_text(msg)

    for word in BLOCK_WORDS:
        w = normalize_text(word)

        if w in norm or w in compact or w in collapsed:
            return True

    for pattern in INTENT_PATTERNS:
        if re.search(pattern, raw):
            return True

    return False

# ==================================================
# IMAGE GENERATION
# ==================================================
IMAGE_WORDS = [
    "gambar",
    "image",
    "draw",
    "generate image",
    "buat gambar",
    "logo",
    "poster",
    "illustration",
    "anime art"
]


def want_image(msg):
    low = msg.lower()
    return any(x in low for x in IMAGE_WORDS)


def make_image(prompt):
    style = "masterpiece, best quality, ultra detailed, cinematic lighting, sharp focus, "
    safe = quote(style + prompt)

    return {
        "url": f"https://image.pollinations.ai/prompt/{safe}"
    }

# ==================================================
# FILE READER
# ==================================================
def read_txt(data):
    return data.decode("utf-8", errors="ignore")[:7000]


def read_pdf(data):
    if not PyPDF2:
        return "PDF module missing. Install PyPDF2."

    try:
        reader = PyPDF2.PdfReader(io.BytesIO(data))
        out = []

        for p in reader.pages[:12]:
            out.append(p.extract_text() or "")

        text = "\n".join(out).strip()

        return text[:7000] if text else "PDF has no readable text."

    except Exception:
        return "Failed reading PDF."


def read_docx(data):
    if not docx:
        return "DOCX module missing. Install python-docx."

    try:
        d = docx.Document(io.BytesIO(data))
        text = "\n".join([x.text for x in d.paragraphs])

        return text[:7000] if text.strip() else "DOCX is empty."

    except Exception:
        return "Failed reading DOCX."


def read_csv_file(data):
    try:
        txt = data.decode("utf-8", errors="ignore")
        rows = list(csv.reader(io.StringIO(txt)))

        return "\n".join([" | ".join(r) for r in rows[:40]])[:7000]

    except Exception:
        return "Failed reading CSV."


def read_zip(data):
    try:
        z = zipfile.ZipFile(io.BytesIO(data))
        return "ZIP Contents:\n" + "\n".join(z.namelist()[:80])

    except Exception:
        return "Failed reading ZIP."


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
        ".txt", ".py", ".js", ".html", ".css",
        ".json", ".xml", ".sql", ".php", ".cpp",
        ".java", ".md", ".yml", ".yaml"
    )):
        return read_txt(data)

    return read_txt(data)

# ==================================================
# URL READER
# ==================================================
def extract_url(text):
    m = re.search(r"https?://[^\s]+", text or "")

    if not m:
        return None

    return m.group(0).strip().rstrip(".,)")


def html_to_text(html):
    if BeautifulSoup:
        soup = BeautifulSoup(html, "html.parser")

        for tag in soup(["script", "style", "noscript", "svg"]):
            tag.extract()

        title = soup.title.get_text(" ", strip=True) if soup.title else ""
        body = soup.get_text(" ", strip=True)
        body = re.sub(r"\s+", " ", body)

        return (f"Title: {title}\n\n{body}")[:8000]

    html = re.sub(r"<script[\s\S]*?</script>", " ", html, flags=re.I)
    html = re.sub(r"<style[\s\S]*?</style>", " ", html, flags=re.I)
    text = re.sub(r"<[^>]+>", " ", html)
    text = re.sub(r"\s+", " ", text)

    return text[:8000]


def read_url_content(link):
    try:
        r = requests.get(
            link,
            headers={"User-Agent": "Mozilla/5.0"},
            timeout=12,
            allow_redirects=True
        )

        content_type = r.headers.get("content-type", "").lower()

        if "text/html" not in content_type and "text/plain" not in content_type and content_type:
            return f"URL opened, but content type is not readable text: {content_type}"

        return html_to_text(r.text)

    except Exception:
        return "Failed reading URL."

# ==================================================
# SEARCH ENGINE
# ==================================================
CURRENT_TRIGGERS = [
    "siapa", "berapa", "presiden", "menteri", "gubernur",
    "hari raya", "today", "latest", "news", "harga",
    "update", "sekarang", "current", "tanggal",
    "tahun ini", "apa itu", "kapan", "dimana", "rilis",
    "2024", "2025", "2026", "2027"
]

CASUAL_NO_SEARCH = [
    "halo", "hai", "hi", "hello", "makasih",
    "thanks", "ok", "oke", "wkwk", "hehe", "lol"
]


def need_search(msg):
    low = msg.lower().strip()

    if low in CASUAL_NO_SEARCH:
        return False

    if extract_url(msg):
        return False

    if any(x in low for x in CURRENT_TRIGGERS):
        return True

    if FORCE_SEARCH and "?" in msg and len(msg.split()) >= 3:
        return True

    return False


def clean_result_link(link):
    if not link:
        return ""

    if link.startswith("//"):
        return "https:" + link

    if "duckduckgo.com/l/?" in link:
        try:
            qs = parse_qs(urlparse(link).query)

            if "uddg" in qs:
                return unquote(qs["uddg"][0])

        except Exception:
            pass

    return link


def tavily_search(query):
    if not TAVILY_KEYS:
        return []

    for key in shuffled(TAVILY_KEYS):
        for _ in range(MAX_RETRIES):
            try:
                r = requests.post(
                    "https://api.tavily.com/search",
                    headers={"Content-Type": "application/json"},
                    json={
                        "api_key": key,
                        "query": query,
                        "search_depth": "advanced",
                        "include_answer": True,
                        "include_raw_content": False,
                        "max_results": 5
                    },
                    timeout=12
                )

                if r.status_code == 200:
                    data = r.json()
                    out = []

                    if data.get("answer"):
                        out.append({
                            "title": "Tavily Answer",
                            "text": data.get("answer", ""),
                            "link": "",
                            "source": "Tavily"
                        })

                    for item in data.get("results", []):
                        out.append({
                            "title": item.get("title", ""),
                            "text": item.get("content", ""),
                            "link": item.get("url", ""),
                            "source": "Tavily"
                        })

                    return [x for x in out if x["title"] or x["text"]]

                if r.status_code in [401, 403, 429]:
                    break

            except Exception:
                pass

            time.sleep(0.4)

    return []


def serper_search(query):
    if not SERPER_KEYS:
        return []

    for key in shuffled(SERPER_KEYS):
        for _ in range(MAX_RETRIES):
            try:
                r = requests.post(
                    "https://google.serper.dev/search",
                    headers={
                        "X-API-KEY": key,
                        "Content-Type": "application/json"
                    },
                    json={
                        "q": query,
                        "gl": "id",
                        "hl": "id",
                        "num": 5
                    },
                    timeout=12
                )

                if r.status_code == 200:
                    data = r.json()
                    out = []

                    for item in data.get("organic", [])[:5]:
                        out.append({
                            "title": item.get("title", ""),
                            "text": item.get("snippet", item.get("title", "")),
                            "link": item.get("link", ""),
                            "source": "Serper Google"
                        })

                    return [x for x in out if x["title"] or x["text"]]

                if r.status_code in [401, 403, 429]:
                    break

            except Exception:
                pass

            time.sleep(0.4)

    return []


def serpapi_search(query):
    if not SERPAPI_KEYS:
        return []

    for key in shuffled(SERPAPI_KEYS):
        for _ in range(MAX_RETRIES):
            try:
                r = requests.get(
                    "https://serpapi.com/search.json",
                    params={
                        "engine": "google",
                        "q": query,
                        "api_key": key,
                        "hl": "id"
                    },
                    timeout=12
                )

                if r.status_code == 200:
                    data = r.json()
                    out = []

                    for item in data.get("organic_results", [])[:6]:
                        out.append({
                            "title": item.get("title", ""),
                            "text": item.get("snippet", item.get("title", "")),
                            "link": item.get("link", ""),
                            "source": "Google SerpAPI"
                        })

                    return [x for x in out if x["title"] or x["text"]]

                if r.status_code in [401, 403, 429]:
                    break

            except Exception:
                pass

            time.sleep(0.4)

    return []


def google_cse_search(query):
    if not GOOGLE_API_KEYS or not GOOGLE_CSE_IDS:
        return []

    pairs = []
    for api_key in GOOGLE_API_KEYS:
        for cse_id in GOOGLE_CSE_IDS:
            pairs.append((api_key, cse_id))

    random.shuffle(pairs)

    for api_key, cse_id in pairs:
        for _ in range(MAX_RETRIES):
            try:
                r = requests.get(
                    "https://www.googleapis.com/customsearch/v1",
                    params={
                        "key": api_key,
                        "cx": cse_id,
                        "q": query,
                        "num": 5
                    },
                    timeout=12
                )

                if r.status_code == 200:
                    data = r.json()
                    out = []

                    for item in data.get("items", [])[:5]:
                        out.append({
                            "title": item.get("title", ""),
                            "text": item.get("snippet", item.get("title", "")),
                            "link": item.get("link", ""),
                            "source": "Google CSE"
                        })

                    return [x for x in out if x["title"] or x["text"]]

                if r.status_code in [401, 403, 429]:
                    break

            except Exception:
                pass

            time.sleep(0.4)

    return []


def brave_search(query):
    if not BRAVE_KEYS:
        return []

    for key in shuffled(BRAVE_KEYS):
        for _ in range(MAX_RETRIES):
            try:
                r = requests.get(
                    "https://api.search.brave.com/res/v1/web/search",
                    params={
                        "q": query,
                        "count": 5
                    },
                    headers={
                        "X-Subscription-Token": key,
                        "Accept": "application/json"
                    },
                    timeout=12
                )

                if r.status_code == 200:
                    data = r.json()
                    out = []

                    for item in data.get("web", {}).get("results", [])[:5]:
                        out.append({
                            "title": item.get("title", ""),
                            "text": item.get("description", item.get("title", "")),
                            "link": item.get("url", ""),
                            "source": "Brave"
                        })

                    return [x for x in out if x["title"] or x["text"]]

                if r.status_code in [401, 403, 429]:
                    break

            except Exception:
                pass

            time.sleep(0.4)

    return []


def ddg_instant_search(query):
    try:
        r = requests.get(
            "https://api.duckduckgo.com/",
            params={
                "q": query,
                "format": "json",
                "no_html": 1,
                "no_redirect": 1
            },
            timeout=12
        )

        data = r.json()
        out = []

        if data.get("AbstractText"):
            out.append({
                "title": data.get("Heading", "DuckDuckGo Result"),
                "text": data.get("AbstractText", ""),
                "link": data.get("AbstractURL", ""),
                "source": "DuckDuckGo"
            })

        for x in data.get("RelatedTopics", [])[:8]:
            if isinstance(x, dict) and x.get("Text"):
                out.append({
                    "title": x.get("Text", "")[:120],
                    "text": x.get("Text", ""),
                    "link": x.get("FirstURL", ""),
                    "source": "DuckDuckGo"
                })

        return [x for x in out if x["title"] or x["text"]]

    except Exception:
        return []


def ddg_html_search(query):
    try:
        r = requests.get(
            "https://html.duckduckgo.com/html/",
            params={"q": query},
            headers={"User-Agent": "Mozilla/5.0"},
            timeout=12
        )

        out = []

        if BeautifulSoup:
            soup = BeautifulSoup(r.text, "html.parser")

            for result in soup.select(".result")[:6]:
                a = result.select_one(".result__a")
                snippet = result.select_one(".result__snippet")

                if a:
                    out.append({
                        "title": a.get_text(" ", strip=True),
                        "text": snippet.get_text(" ", strip=True) if snippet else a.get_text(" ", strip=True),
                        "link": a.get("href", ""),
                        "source": "DuckDuckGo HTML"
                    })

        else:
            links = re.findall(
                r'<a[^>]+class="result__a"[^>]+href="([^"]+)"[^>]*>(.*?)</a>',
                r.text,
                flags=re.I
            )

            for link, title_html in links[:6]:
                title = re.sub(r"<[^>]+>", "", title_html)

                out.append({
                    "title": title.strip(),
                    "text": title.strip(),
                    "link": link,
                    "source": "DuckDuckGo HTML"
                })

        return [x for x in out if x["title"] or x["text"]]

    except Exception:
        return []


def bing_rss_search(query):
    try:
        url = "https://www.bing.com/search?q=" + quote(query) + "&format=rss"

        r = requests.get(
            url,
            headers={"User-Agent": "Mozilla/5.0"},
            timeout=12
        )

        text = r.text
        out = []

        items = re.findall(r"<item>(.*?)</item>", text, flags=re.S | re.I)

        for item in items[:5]:
            title = re.search(r"<title>(.*?)</title>", item, flags=re.S | re.I)
            link = re.search(r"<link>(.*?)</link>", item, flags=re.S | re.I)
            desc = re.search(r"<description>(.*?)</description>", item, flags=re.S | re.I)

            t = re.sub(r"<[^>]+>", "", title.group(1)).strip() if title else ""
            l = link.group(1).strip() if link else ""
            d = re.sub(r"<[^>]+>", "", desc.group(1)).strip() if desc else t

            if t or d:
                out.append({
                    "title": t,
                    "text": d,
                    "link": l,
                    "source": "Bing RSS"
                })

        return out

    except Exception:
        return []


def wikipedia_search(query):
    try:
        r = requests.get(
            "https://en.wikipedia.org/api/rest_v1/page/summary/" + quote(query.replace(" ", "_")),
            headers={"User-Agent": "Mozilla/5.0"},
            timeout=10
        )

        data = r.json()

        if data.get("extract"):
            return [{
                "title": data.get("title", "Wikipedia"),
                "text": data.get("extract", ""),
                "link": data.get("content_urls", {}).get("desktop", {}).get("page", ""),
                "source": "Wikipedia"
            }]

        return []

    except Exception:
        return []


def web_search(query):
    results = []

    engines = [
        tavily_search,
        brave_search,
        serper_search,
        serpapi_search,
        google_cse_search,
        ddg_instant_search,
        ddg_html_search,
        bing_rss_search,
        wikipedia_search
    ]

    seen = set()

    for engine in engines:
        try:
            part = engine(query)

        except Exception:
            part = []

        for item in part:
            title = item.get("title", "").strip()
            text = item.get("text", "").strip()
            link = clean_result_link(item.get("link", "").strip())
            source = item.get("source", "Web")

            key = (title + link).lower()

            if not title and not text:
                continue

            if key in seen:
                continue

            seen.add(key)

            results.append({
                "title": title,
                "text": text or title,
                "link": link,
                "source": source
            })

        if len(results) >= 8:
            break

    return results[:10]


def favicon_html(link):
    try:
        domain = urlparse(link).netloc

        if not domain:
            return ""

        return (
            f"<a href='{link}' target='_blank' title='{domain}'>"
            f"<img src='https://www.google.com/s2/favicons?domain={domain}&sz=32' "
            f"style='width:16px;height:16px;border-radius:4px;vertical-align:middle;margin-right:6px;'>"
            f"</a>"
        )

    except Exception:
        return ""


def source_block(results):
    if not results:
        return ""

    html = "<br><br><span style='opacity:.85'>Sources: </span>"

    for r in results[:4]:
        link = r.get("link", "")

        if link:
            html += favicon_html(link)
        else:
            html += "🌐 "

    return html

# ==================================================
# AI PROVIDERS
# ==================================================
def build_messages(cid, msg):
    msgs = [
        {
            "role": "system",
            "content": SYSTEM_PROMPT
        }
    ]

    memory_text = memory_summary_text(limit=80)

    if memory_text:
        msgs.append({
            "role": "system",
            "content": "Relevant cross-chat memory:\n" + memory_text
        })

    profile = get_profile()

    if profile.get("likes"):
        msgs.append({
            "role": "system",
            "content": "User interests: " + ", ".join(profile["likes"])
        })

    msgs.append({
        "role": "user",
        "content": msg
    })

    return msgs


def messages_to_text(messages):
    out = []

    for m in messages:
        role = m.get("role", "user")
        content = m.get("content", "")

        if isinstance(content, str):
            out.append(f"{role}: {content}")

    return "\n".join(out)


def ask_groq(messages, model=None):
    if not GROQ_KEYS:
        return None

    keys = shuffled(GROQ_KEYS)

    models = []

    if model:
        models.append(model)

    env_model = os.getenv("GROQ_MODEL", "").strip()

    if env_model:
        models.append(env_model)

    models += [
        "llama-3.3-70b-versatile",
        "llama3-70b-8192",
        "llama-3.1-70b-versatile",
        "llama-3.1-8b-instant"
    ]

    models = list(dict.fromkeys(models))

    for model_name in models:
        for key in keys:
            for _ in range(MAX_RETRIES):
                try:
                    r = requests.post(
                        "https://api.groq.com/openai/v1/chat/completions",
                        headers={
                            "Authorization": f"Bearer {key}",
                            "Content-Type": "application/json"
                        },
                        json={
                            "model": model_name,
                            "messages": messages,
                            "temperature": 0.7
                        },
                        timeout=REQUEST_TIMEOUT
                    )

                    if r.status_code == 200:
                        return r.json()["choices"][0]["message"]["content"].strip()

                    if r.status_code in [400, 401, 403, 404, 429]:
                        break

                except Exception:
                    pass

                time.sleep(0.4)

    return None


def ask_cerebras(messages):
    if not CEREBRAS_KEYS:
        return None

    keys = shuffled(CEREBRAS_KEYS)

    for key in keys:
        for _ in range(MAX_RETRIES):
            try:
                r = requests.post(
                    "https://api.cerebras.ai/v1/chat/completions",
                    headers={
                        "Authorization": f"Bearer {key}",
                        "Content-Type": "application/json"
                    },
                    json={
                        "model": "llama3.1-8b",
                        "messages": messages
                    },
                    timeout=REQUEST_TIMEOUT
                )

                if r.status_code == 200:
                    return r.json()["choices"][0]["message"]["content"].strip()

                if r.status_code in [400, 401, 403, 404, 429]:
                    break

            except Exception:
                pass

            time.sleep(0.4)

    return None


def ask_gemini_text(prompt):
    if not GEMINI_KEYS:
        return None

    keys = shuffled(GEMINI_KEYS)

    for key in keys:
        for _ in range(MAX_RETRIES):
            try:
                url = f"https://generativelanguage.googleapis.com/v1beta/models/gemini-1.5-flash:generateContent?key={key}"

                r = requests.post(
                    url,
                    json={
                        "contents": [
                            {
                                "parts": [
                                    {
                                        "text": prompt
                                    }
                                ]
                            }
                        ]
                    },
                    timeout=REQUEST_TIMEOUT
                )

                if r.status_code == 200:
                    data = r.json()
                    return data["candidates"][0]["content"]["parts"][0]["text"].strip()

                if r.status_code in [400, 401, 403, 404, 429]:
                    break

            except Exception:
                pass

            time.sleep(0.4)

    return None


def local_fallback(msg):
    p = get_profile()
    low = msg.lower()

    if "ngobrol apa" in low:
        if "coding" in p.get("likes", []):
            return "Kita bisa ngobrol soal project coding baru 🚀 atau upgrade NeuroMV biar makin gila."

        return "Kita bisa ngobrol topik seru yang kamu suka 😄"

    return "Aku tetap siap bantu kamu. Coba tulis ulang sedikit lebih detail 🙂"


def ask_ai(cid, msg):
    messages = build_messages(cid, msg)

    providers = [
        lambda: ask_groq(messages),
        lambda: ask_cerebras(messages),
        lambda: ask_gemini_text(messages_to_text(messages))
    ]

    for fn in providers:
        try:
            out = fn()

            if out:
                return out

        except Exception:
            pass

    return local_fallback(msg)

# ==================================================
# OCR + VISION AI
# ==================================================
PADDLE_OCR_ENGINE = None


def image_mime(filename):
    low = filename.lower()

    if low.endswith(".png"):
        return "image/png"

    if low.endswith(".webp"):
        return "image/webp"

    return "image/jpeg"


def get_paddle_ocr():
    global PADDLE_OCR_ENGINE

    if PaddleOCR is None:
        return None

    if PADDLE_OCR_ENGINE is None:
        PADDLE_OCR_ENGINE = PaddleOCR(
            use_angle_cls=True,
            lang="en"
        )

    return PADDLE_OCR_ENGINE


def ocr_paddle_image(image_bytes, filename="image.jpg"):
    try:
        engine = get_paddle_ocr()

        if engine is None:
            return ""

        suffix = ".jpg"

        low = filename.lower()
        if low.endswith(".png"):
            suffix = ".png"
        elif low.endswith(".webp"):
            suffix = ".webp"

        with tempfile.NamedTemporaryFile(delete=False, suffix=suffix) as tmp:
            tmp.write(image_bytes)
            path = tmp.name

        try:
            result = engine.ocr(path, cls=True)
        finally:
            try:
                os.remove(path)
            except Exception:
                pass

        lines = []

        if result:
            for page in result:
                if page:
                    for item in page:
                        try:
                            text = item[1][0]
                            if text:
                                lines.append(text)
                        except Exception:
                            pass

        return "\n".join(lines)[:5000]

    except Exception:
        return ""


def ocr_space_image(image_bytes):
    if not OCR_SPACE_KEYS:
        return ""

    for key in shuffled(OCR_SPACE_KEYS):
        for _ in range(MAX_RETRIES):
            try:
                r = requests.post(
                    "https://api.ocr.space/parse/image",
                    headers={
                        "apikey": key
                    },
                    files={
                        "filename": ("image.jpg", image_bytes)
                    },
                    data={
                        "language": "eng",
                        "isOverlayRequired": "false",
                        "OCREngine": "2"
                    },
                    timeout=25
                )

                if r.status_code == 200:
                    data = r.json()
                    parsed = data.get("ParsedResults", [])
                    text = []

                    for p in parsed:
                        t = p.get("ParsedText", "").strip()
                        if t:
                            text.append(t)

                    return "\n".join(text)[:5000]

                if r.status_code in [401, 403, 429]:
                    break

            except Exception:
                pass

            time.sleep(0.4)

    return ""


def ocr_image(image_bytes, filename):
    return (
        ocr_paddle_image(image_bytes, filename)
        or ocr_space_image(image_bytes)
    )


def cloudflare_vision(prompt, image_bytes):
    if not CLOUDFLARE_ACCOUNT_IDS or not CLOUDFLARE_API_TOKENS:
        return None

    model = "@cf/meta/llama-3.2-11b-vision-instruct"
    image_array = list(image_bytes)

    pairs = []

    for account_id in CLOUDFLARE_ACCOUNT_IDS:
        for token in CLOUDFLARE_API_TOKENS:
            pairs.append((account_id, token))

    random.shuffle(pairs)

    for account_id, token in pairs:
        url = f"https://api.cloudflare.com/client/v4/accounts/{account_id}/ai/run/{model}"

        for _ in range(MAX_RETRIES):
            try:
                payload = {
                    "prompt": prompt or "Describe this image clearly.",
                    "image": image_array,
                    "max_tokens": 900
                }

                r = requests.post(
                    url,
                    headers={
                        "Authorization": f"Bearer {token}",
                        "Content-Type": "application/json"
                    },
                    json=payload,
                    timeout=REQUEST_TIMEOUT
                )

                if r.status_code == 200:
                    data = r.json()
                    result = data.get("result", {})

                    if isinstance(result, dict):
                        text = (
                            result.get("response")
                            or result.get("text")
                            or result.get("description")
                        )

                        if text:
                            return text.strip()

                    if isinstance(result, str):
                        return result.strip()

                if r.status_code in [400, 401, 403, 404, 429]:
                    break

            except Exception:
                pass

            time.sleep(0.4)

    return None


def ask_vision_gemini(prompt, image_bytes, filename):
    if not GEMINI_KEYS:
        return None

    b64 = base64.b64encode(image_bytes).decode()
    mime = image_mime(filename)

    for key in shuffled(GEMINI_KEYS):
        for _ in range(MAX_RETRIES):
            try:
                url = f"https://generativelanguage.googleapis.com/v1beta/models/gemini-1.5-flash:generateContent?key={key}"

                payload = {
                    "contents": [
                        {
                            "parts": [
                                {
                                    "text": prompt or "Analyze this image clearly."
                                },
                                {
                                    "inline_data": {
                                        "mime_type": mime,
                                        "data": b64
                                    }
                                }
                            ]
                        }
                    ]
                }

                r = requests.post(url, json=payload, timeout=REQUEST_TIMEOUT)

                if r.status_code == 200:
                    data = r.json()
                    return data["candidates"][0]["content"]["parts"][0]["text"].strip()

                if r.status_code in [400, 401, 403, 404, 429]:
                    break

            except Exception:
                pass

            time.sleep(0.4)

    return None


def ask_vision_groq(prompt, image_bytes, filename):
    if not GROQ_KEYS:
        return None

    b64 = base64.b64encode(image_bytes).decode()
    mime = image_mime(filename)
    data_url = f"data:{mime};base64,{b64}"

    messages = [
        {
            "role": "user",
            "content": [
                {
                    "type": "text",
                    "text": prompt or "Analyze this image clearly."
                },
                {
                    "type": "image_url",
                    "image_url": {
                        "url": data_url
                    }
                }
            ]
        }
    ]

    vision_models = [
        "meta-llama/llama-4-scout-17b-16e-instruct",
        "llama-3.2-11b-vision-preview"
    ]

    for model in vision_models:
        out = ask_groq(messages, model=model)

        if out:
            return out

    return None


def hf_image_caption(image_bytes):
    if not HF_KEYS:
        return None

    model = "Salesforce/blip-image-captioning-large"

    for key in shuffled(HF_KEYS):
        for _ in range(MAX_RETRIES):
            try:
                r = requests.post(
                    f"https://api-inference.huggingface.co/models/{model}",
                    headers={
                        "Authorization": f"Bearer {key}"
                    },
                    data=image_bytes,
                    timeout=30
                )

                if r.status_code == 200:
                    data = r.json()

                    if isinstance(data, list) and data:
                        text = data[0].get("generated_text", "")

                        if text:
                            return text.strip()

                if r.status_code in [400, 401, 403, 404, 429]:
                    break

            except Exception:
                pass

            time.sleep(0.4)

    return None


def vision_image(prompt, image_bytes, filename):
    return (
        cloudflare_vision(prompt, image_bytes)
        or ask_vision_gemini(prompt, image_bytes, filename)
        or ask_vision_groq(prompt, image_bytes, filename)
        or hf_image_caption(image_bytes)
    )


def analyze_image_full(cid, user_msg, image_bytes, filename):
    ocr_text = ocr_image(image_bytes, filename)

    vision_text = vision_image(
        user_msg or "Describe this image clearly like a human observer.",
        image_bytes,
        filename
    )

    ask = f"""
User uploaded an image.

OCR text detected in image:
{ocr_text or 'No readable text detected.'}

Visual description from Vision AI:
{vision_text or 'No visual description available.'}

User question:
{user_msg or 'Explain this image clearly.'}

Answer naturally as NeuroMV.
Use OCR for text details.
Use visual description for objects, scenery, layout, and context.
If the image cannot be analyzed enough, say it honestly.
"""

    return ask_ai(cid, ask)

# ==================================================
# SEARCH ANSWER ENGINE
# ==================================================
def stale_guard(msg, reply, results):
    low = msg.lower()
    rlow = reply.lower()

    combined_sources = " ".join([
        (x.get("title", "") + " " + x.get("text", "")).lower()
        for x in results
    ])

    if "presiden" in low and "indonesia" in low:
        if ("joko widodo" in rlow or "jokowi" in rlow) and "prabowo" in combined_sources:
            return (
                "Berdasarkan hasil web yang ditemukan, Presiden Indonesia saat ini adalah "
                "**Prabowo Subianto**. Joko Widodo adalah presiden sebelumnya."
            )

        if ("joko widodo" in rlow or "jokowi" in rlow) and "prabowo" not in combined_sources:
            return (
                "Hasil web yang aku dapat belum cukup jelas untuk memastikan presiden Indonesia saat ini. "
                "Aku tidak akan memakai jawaban lama dari model."
            )

    return reply


def answer_with_search(cid, msg):
    results = web_search(msg)

    if not results:
        reply = (
            "Aku sudah mencoba mencari data online, tapi belum menemukan hasil web yang cukup jelas. "
            "Aku tidak mau menebak untuk pertanyaan yang butuh data terbaru. "
            "Coba tulis dengan kata kunci lebih spesifik ya."
        )

        push(cid, "user", msg)
        push(cid, "bot", reply)

        return jsonify({
            "type": "text",
            "status": "searching",
            "reply": "🔎 Searching...<br><br>" + reply
        })

    context = "\n".join([
        f"- Title: {x['title']}\n  Snippet: {x['text']}\n  Source: {x['source']}\n  Link: {x['link']}"
        for x in results
    ])

    ask = f"""
You are answering using live web search results.

User question:
{msg}

Live web results:
{context}

Rules:
- Answer based only on the live web results above.
- Do not use old memory for current facts.
- Do not guess.
- If the results are unclear, say that the web results are unclear.
- Answer in the user's language.
- Keep it clear and helpful.
"""

    reply = ask_ai(cid, ask)
    reply = stale_guard(msg, reply, results)
    reply += source_block(results)

    push(cid, "user", msg)
    push(cid, "bot", reply)

    return jsonify({
        "type": "text",
        "status": "searching",
        "reply": "🔎 Searching...<br><br>" + reply
    })

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

    # FILE / IMAGE UPLOAD
    if "file" in request.files:
        f = request.files["file"]

        if f and f.filename:
            if over_file():
                return jsonify({
                    "type": "limit_file"
                })

            add_file()

            data = f.read()
            low = f.filename.lower()

            # IMAGE ANALYSIS
            if low.endswith((".png", ".jpg", ".jpeg", ".webp")):
                reply = analyze_image_full(cid, msg, data, f.filename)

                if not reply:
                    reply = (
                        "🖼️ Aku menerima gambarnya, tapi Vision AI belum berhasil membaca gambar ini. "
                        "Pastikan CLOUDFLARE_API_TOKEN / GEMINI_API_KEY / GROQ_API_KEY aktif."
                    )

                push(cid, "user", "[image] " + f.filename + (" " + msg if msg else ""))
                push(cid, "bot", reply)

                return jsonify({
                    "type": "text",
                    "status": "analyzing_image",
                    "reply": "🖼️ Analyzing Image...<br><br>" + reply
                })

            # NORMAL FILE
            content = smart_read_file(f.filename, data)

            ask = f"""
User uploaded file: {f.filename}

File content:
{content}

User request:
{msg or 'Explain this file clearly.'}
"""

            reply = ask_ai(cid, ask)

            push(cid, "user", "[file] " + f.filename)
            push(cid, "bot", reply)

            return jsonify({
                "type": "text",
                "reply": reply
            })

    # EMPTY
    if not msg:
        return jsonify({
            "type": "text",
            "reply": "Tulis pesan dulu ya 🙂"
        })

    # BLOCKED
    if blocked(msg):
        return jsonify({
            "type": "text",
            "reply": "I can't help with that request."
        })

    learn_interest(msg)

    # URL READER
    link = extract_url(msg)

    if link:
        content = read_url_content(link)

        ask = f"""
User sent this URL:
{link}

Webpage content:
{content}

Task:
Explain, summarize, or answer based on the webpage. Use the user's language.
"""

        reply = ask_ai(cid, ask)

        push(cid, "user", msg)
        push(cid, "bot", reply)

        return jsonify({
            "type": "text",
            "status": "reading_url",
            "reply": "🌐 Reading URL...<br><br>" + reply + "<br><br>" + favicon_html(link)
        })

    # IMAGE GENERATION
    if want_image(msg):
        if over_image():
            return jsonify({
                "type": "limit_image"
            })

        add_image()

        img = make_image(msg)

        return jsonify({
            "type": "image",
            "status": "creating",
            "url": img["url"]
        })

    # SEARCH MODE
    if need_search(msg):
        return answer_with_search(cid, msg)

    # NORMAL CHAT
    if over_chat():
        return jsonify({
            "type": "limit_chat"
        })

    reply = ask_ai(cid, msg)

    push(cid, "user", msg)
    push(cid, "bot", reply)

    add_chat()

    return jsonify({
        "type": "text",
        "reply": reply
    })

# ==================================================
# RUN
# ==================================================
if __name__ == "__main__":
    port = int(os.getenv("PORT", 5000))

    app.run(
        host="0.0.0.0",
        port=port,
        debug=False
    )
