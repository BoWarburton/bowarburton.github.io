import socket
import uvicorn
import time
import threading
import subprocess
import shutil
from pathlib import Path
from camoufox.sync_api import Camoufox
from fastapi import FastAPI, HTTPException, Query, Request
from fastapi.responses import FileResponse
from pydantic import BaseModel, Field
from playwright.sync_api import TimeoutError as PlaywrightTimeoutError

QUEUE = []
QUEUE_LOCK = threading.Lock()
SKIP_FLAG = False
REPEAT_FLAG = False
CURRENT_SONG = ""
SKIP_VOTES_REQUIRED = 1
SKIP_VOTES: set[str] = set()
SKIP_VOTE_LOCK = threading.Lock()
END_SKIP_BUFFER_SECONDS = 1.5

HINTS = [
    "Start with a read-only GET request to search for a video.",
    "The search route is /api/v1/videos/search and its query parameter is q.",
    "To request a result, POST JSON to /api/v1/requests with its video_id. Skip votes use /api/v1/skip-votes.",
]


class VideoRequest(BaseModel):
    video_id: str = Field(pattern=r"^[A-Za-z0-9_-]{11}$")

# volume timer (5 seconds)
last_volume = 0
# repeat timer (120 seconds)
last_repeat = 0


# -------------------------------------- #


def should_reset_video(playback, has_next=False):
    if not playback:
        return False
    if playback.get("is_short"):
        return True

    duration = float(playback.get("duration") or 0)
    current_time = float(playback.get("currentTime") or 0)
    if duration <= 0:
        return False
    if current_time <= 0:
        return False
    if playback.get("ended"):
        return True
    return has_next and current_time >= duration - END_SKIP_BUFFER_SECONDS


def get_player_state(page):
    try:
        return page.evaluate(
            """
            () => {
                const video = document.querySelector('video');
                if (!video) {
                    return null;
                }

                const duration = Number.isFinite(video.duration) ? video.duration : 0;
                const currentTime = Number.isFinite(video.currentTime) ? video.currentTime : 0;
                const url = new URL(window.location.href);
                const isShort = url.pathname.startsWith('/shorts/') || (
                    video.videoWidth > 0 &&
                    video.videoHeight > 0 &&
                    video.videoHeight >= video.videoWidth &&
                    duration > 0 &&
                    duration <= 180
                );

                return {
                    ended: Boolean(video.ended),
                    duration,
                    currentTime,
                    is_short: isShort,
                    is_watch_page: url.pathname.startsWith('/watch') || url.pathname.startsWith('/shorts/'),
                };
            }
            """
        )
    except Exception:
        return None


def start_video_if_paused(page):
    player_video = page.locator("video").first
    if not player_video.evaluate("video => video.paused"):
        return

    play_button = page.locator("button.ytp-large-play-button")
    if play_button.is_visible():
        play_button.click()
    else:
        player_video.click()


# -------------------------------------- #

def go_home(page):
    page.goto("https://youtube.com")

# main loop
def run_browser():
    global QUEUE
    global CURRENT_SONG
    global SKIP_FLAG
    global REPEAT_FLAG
    with Camoufox(headless=False, humanize=True) as browser:
        page = browser.new_page()
        go_home(page)
        CURRENT_SONG = ""

        while True:
            try:
                if SKIP_FLAG == True:
                    with SKIP_VOTE_LOCK:
                        SKIP_FLAG = False
                        CURRENT_SONG = ""
                        SKIP_VOTES.clear()
                    go_home(page)

                if REPEAT_FLAG == True:
                    REPEAT_FLAG = False
                    if CURRENT_SONG != "":
                        with QUEUE_LOCK:
                            QUEUE.insert(0, CURRENT_SONG)

                if CURRENT_SONG:
                    playback = get_player_state(page)
                    with QUEUE_LOCK:
                        has_next = bool(QUEUE)
                    if (
                        playback
                        and playback.get("is_watch_page")
                        and should_reset_video(playback, has_next=has_next)
                    ):
                        with SKIP_VOTE_LOCK:
                            CURRENT_SONG = ""
                            SKIP_VOTES.clear()
                        go_home(page)

                if not CURRENT_SONG:
                    with QUEUE_LOCK:
                        next_song = QUEUE.pop(0) if QUEUE else None
                    if next_song is None:
                        time.sleep(0.5)
                        continue
                    with SKIP_VOTE_LOCK:
                        CURRENT_SONG = next_song
                        SKIP_VOTES.clear()
                    if CURRENT_SONG.startswith("https://") and ("youtube.com/watch?v=" in CURRENT_SONG or "youtube.com/shorts/" in CURRENT_SONG):
                        page.goto(CURRENT_SONG)
                    else:
                        search_bar = page.locator('input[name="search_query"]')
                        search_bar.wait_for(state="visible", timeout=10000)
                        search_bar.click()
                        search_bar.press_sequentially(CURRENT_SONG, delay=100)
                        time.sleep(0.75)
                        search_bar.press("Enter")

                        video_link = page.locator(
                            'ytd-video-renderer a#video-title:not([href*="/shorts/"])'
                        ).first
                        try:
                            video_link.wait_for(state="visible", timeout=2500)
                        except PlaywrightTimeoutError:
                            with SKIP_VOTE_LOCK:
                                CURRENT_SONG = ""
                                SKIP_VOTES.clear()
                            go_home(page)
                            continue

                        time.sleep(0.75)
                        video_link.click()

                    player_video = page.locator("video").first
                    try:
                        player_video.wait_for(state="attached", timeout=15000)
                        page.wait_for_function(
                            """
                            () => {
                                const video = document.querySelector('video');
                                return !!video && Number.isFinite(video.duration) && video.duration > 0;
                            }
                            """,
                            timeout=15000,
                        )
                        start_video_if_paused(page)
                    except PlaywrightTimeoutError:
                        with SKIP_VOTE_LOCK:
                            CURRENT_SONG = ""
                            SKIP_VOTES.clear()
                        go_home(page)
                        continue

            except Exception as e:
                print(f"Browser automation error: {e}")
                with SKIP_VOTE_LOCK:
                    CURRENT_SONG = ""
                    SKIP_VOTES.clear()

            time.sleep(0.5)

# -------------------------------------- #

# api helpers

def add_url_to_queue(url):
    global QUEUE
    url = url.strip()
    if not url:
        return "URL cannot be empty"

    with QUEUE_LOCK:
        QUEUE.append(url)
    return f"added {url} to queue"

def add_title_to_queue(title):
    global QUEUE
    title = title.strip()
    if not title:
        return "title cannot be empty"

    with QUEUE_LOCK:
        QUEUE.append(title)
    return f"added {title} to queue"

def skip_current_song(client_ip: str):
    global SKIP_FLAG

    with SKIP_VOTE_LOCK:
        if CURRENT_SONG == "":
            return {"message": "cannot skip, no currently playing song"}
        if SKIP_FLAG:
            return {"message": "skip already approved"}
        if client_ip in SKIP_VOTES:
            return {
                "message": f"vote already counted ({len(SKIP_VOTES)}/{SKIP_VOTES_REQUIRED})"
            }

        SKIP_VOTES.add(client_ip)
        vote_count = len(SKIP_VOTES)
        if vote_count >= SKIP_VOTES_REQUIRED:
            SKIP_FLAG = True
            return {"message": f"skip approved ({vote_count}/{SKIP_VOTES_REQUIRED} votes)"}

        return {
            "message": f"skip vote recorded ({vote_count}/{SKIP_VOTES_REQUIRED})"
        }

def read_queue():
    global CURRENT_SONG
    global QUEUE
    with QUEUE_LOCK:
        queued_items = list(QUEUE)
    with SKIP_VOTE_LOCK:
        current_song = CURRENT_SONG
    queue_dict = {f"queue_{i+1}": item for i, item in enumerate(queued_items)}
    return {"playing": current_song, **queue_dict}

def repeat_current_song():
    global REPEAT_FLAG
    global CURRENT_SONG
    global last_repeat
    now = time.monotonic()
    if (120 - (now - last_repeat)) > 0:
        return f"wait {(120 - (now - last_repeat)):.0f}s before trying to repeat again"

    last_repeat = time.monotonic()
    if CURRENT_SONG == "":
        return {"message": "cannot repeat, no currently playing song"}
    REPEAT_FLAG = True
    return {"message": "repeated current title"}

def set_current_volume(volume):
    global last_volume
    now = time.monotonic()
    if (5 - (now - last_volume)) > 0:
        return f"wait {(5 - (now - last_volume)):.0f}s before trying to set volume again"
    last_volume = time.monotonic()

    if not isinstance(volume, int):
        return {"message": "volume must be an int"}
    if not (0 <= volume <= 100):
        return {"message": "volume must be between 0 and 100"}

    if shutil.which("pactl"):
        subprocess.run(["pactl", "set-sink-volume", "@DEFAULT_SINK@", f"{volume}%"], check=True)
    elif shutil.which("amixer"):
        subprocess.run(["amixer", "-q", "sset", "Master", f"{volume}%"], check=True)
    else:
        return {"message": "volume control not supported on this Linux system"}

    return {"message": f"set volume to {volume}"}


yt = FastAPI(title="Music Player")

@yt.get("/classroom")
def classroom_page():
    return FileResponse(
        Path(__file__).with_name("classroom.html"), media_type="text/html"
    )

@yt.get("/api/v1/challenge")
def classroom_challenge():
    return {
        "name": "Queue Quest",
        "goal": "Find a video and add it to the classroom queue.",
        "hint_levels": len(HINTS),
    }

@yt.get("/api/v1/hints/{level}")
def get_challenge_hint(level: int):
    if not 1 <= level <= len(HINTS):
        raise HTTPException(status_code=404, detail="Hint level not found")
    return {"level": level, "hint": HINTS[level - 1]}

@yt.get("/api/v1/videos/search")
def search_videos(
    q: str = Query(min_length=2, max_length=150),
    limit: int = Query(default=5, ge=1, le=10),
):
    try:
        import yt_dlp

        options = {"quiet": True, "no_warnings": True, "extract_flat": True}
        with yt_dlp.YoutubeDL(options) as youtube:
            search_results = youtube.extract_info(
                f"ytsearch{limit}:{q}", download=False
            )
    except Exception as error:
        raise HTTPException(status_code=502, detail="YouTube search failed") from error

    videos = []
    for result in search_results.get("entries", []):
        if not result:
            continue
        video_id = result.get("id")
        title = result.get("title")
        if not video_id or len(video_id) != 11 or not title:
            continue
        videos.append(
            {
                "video_id": video_id,
                "title": title,
                "channel": result.get("channel") or result.get("uploader"),
            }
        )
    return {"results": videos}

@yt.get("/api/v1/queue")
def get_classroom_queue():
    with QUEUE_LOCK:
        queued_items = list(QUEUE)
    with SKIP_VOTE_LOCK:
        current_song = CURRENT_SONG
        vote_count = len(SKIP_VOTES)
    return {
        "playing": current_song or None,
        "up_next": queued_items,
        "skip_votes": {"count": vote_count, "required": SKIP_VOTES_REQUIRED},
    }

@yt.post("/api/v1/requests")
def request_video(video_request: VideoRequest):
    video_url = f"https://www.youtube.com/watch?v={video_request.video_id}"
    with QUEUE_LOCK:
        QUEUE.append(video_url)
        queue_position = len(QUEUE)
    return {
        "message": "video added to classroom queue",
        "video_id": video_request.video_id,
        "queue_position": queue_position,
    }

@yt.post("/api/v1/skip-votes")
def cast_skip_vote(request: Request):
    if request.client is None:
        raise HTTPException(status_code=400, detail="Unable to determine client IP")
    result = skip_current_song(request.client.host)
    with SKIP_VOTE_LOCK:
        vote_count = len(SKIP_VOTES)
    return {
        **result,
        "votes": vote_count,
        "required": SKIP_VOTES_REQUIRED,
    }

@yt.get("/")
def read_root():
    return {"message": "connected: try /help or /docs for more information"}

@yt.get("/help")
def help():
    return {
        "student_api": {
            "challenge": "GET /api/v1/challenge",
            "hints": "GET /api/v1/hints/{level}",
            "search": "GET /api/v1/videos/search?q={query}",
            "queue": "GET /api/v1/queue",
            "request": "POST /api/v1/requests with JSON {\"video_id\": \"...\"}",
            "skip_vote": "POST /api/v1/skip-votes",
        },
        "legacy_routes": [
            "GET /title_add?title=... (legacy; adds a title for the player to search)",
            "GET /url_add?url=... (legacy)",
            "GET /read, /skip, /repeat, and /volume (legacy)",
        ],
    }

@yt.get("/read")
def get_queue():
  return read_queue()

@yt.get(
    "/title_add",
    deprecated=True,
    description="Legacy route. Classroom clients should search, then POST a video_id to /api/v1/requests.",
)
def add_title(title: str):
    return {"message": add_title_to_queue(title)}

@yt.get("/url_add", deprecated=True, description="Legacy queue route.")
def add_url(url: str):
    return {"message": add_url_to_queue(url)}

@yt.get("/skip")
def skip_song(request: Request):
    if request.client is None:
        raise HTTPException(status_code=400, detail="Unable to determine client IP")
    return skip_current_song(request.client.host)

@yt.get("/repeat")
def repeat_song():
  return repeat_current_song()

@yt.get("/volume")
def set_volume(volume: int):
  return {"message": set_current_volume(volume)}

# -------------------------------------- #


def get_lan_ip():
    with socket.socket(socket.AF_INET, socket.SOCK_DGRAM) as connection:
        connection.connect(("8.8.8.8", 80))
        return connection.getsockname()[0]

if __name__ == "__main__":
    lan_ip = get_lan_ip()
    print(f"\033[35mLINK\033[0m:     Open at \033[1mhttp://{lan_ip}:8000/\033[0m")
    thread = threading.Thread(target=run_browser, daemon=True)
    thread.start()
    uvicorn.run(yt, host="0.0.0.0", port=8000)
