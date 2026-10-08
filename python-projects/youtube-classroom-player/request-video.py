from urllib.error import HTTPError, URLError
from urllib.parse import urlencode
from urllib.request import urlopen


PLAYER_URL = "http://192.168.0.64:8000"
RESULT_LIMIT = 5


def search_youtube(query):
    try:
        import yt_dlp
    except ImportError as error:
        raise RuntimeError(
            "yt-dlp is required. Install it with: python -m pip install yt-dlp"
        ) from error

    options = {"quiet": True, "no_warnings": True, "extract_flat": True}
    with yt_dlp.YoutubeDL(options) as youtube:
        results = youtube.extract_info(
            f"ytsearch{RESULT_LIMIT}:{query}", download=False
        )

    return [
        result
        for result in results.get("entries", [])
        if result and result.get("id") and result.get("title")
    ]


def add_video(video_url):
    request_url = f"{PLAYER_URL}/url_add?{urlencode({'url': video_url})}"
    try:
        with urlopen(request_url, timeout=10) as response:
            body = response.read().decode("utf-8", errors="replace")
            print(body or f"Player accepted the request (HTTP {response.status}).")
    except HTTPError as error:
        body = error.read().decode("utf-8", errors="replace")
        print(f"Player returned HTTP {error.code}: {body or error.reason}")
    except (URLError, TimeoutError) as error:
        print(f"Could not reach the music player: {error}")


def main():
    query = input("Search YouTube for: ").strip()
    if not query:
        print("No search terms entered.")
        return

    try:
        results = search_youtube(query)
    except Exception as error:
        print(f"YouTube search failed: {error}")
        return

    if not results:
        print("No matching videos found.")
        return

    for index, result in enumerate(results, start=1):
        channel = result.get("channel") or result.get("uploader") or "Unknown channel"
        print(f"{index}. {result['title']} ({channel})")

    selection = input("Choose a video number (or press Enter to cancel): ").strip()
    if not selection:
        print("Cancelled.")
        return
    if not selection.isdigit() or not 1 <= int(selection) <= len(results):
        print("That is not a valid result number.")
        return

    video = results[int(selection) - 1]
    video_url = f"https://www.youtube.com/watch?v={video['id']}"
    print(f"Selected: {video['title']}\n{video_url}")
    confirmation = input("Add this video to the music player? [y/N] ").strip().lower()
    if confirmation not in {"y", "yes"}:
        print("Cancelled.")
        return

    add_video(video_url)


if __name__ == "__main__":
    main()