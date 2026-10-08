This program runs a server side app to play YouTube videos.
Features: no ads, accept requests by GET 
To run:
cd to directory containing this file
source .venv/bin/activate
python3 linux_yt.py
# Classroom Music Lab

This local FastAPI app provides a classroom API challenge and a YouTube-backed
request queue. The teacher runs the player on a computer on the classroom LAN.

## Setup

From this directory, create and activate the environment, then install the
dependencies:

Windows PowerShell:

```powershell
py -m venv .venv
.venv\Scripts\Activate.ps1
python -m pip install -r requirements.txt
python -m camoufox fetch
```

Linux:

```sh
python3 -m venv .venv
source .venv/bin/activate
python -m pip install -r requirements.txt
python -m camoufox fetch
```

Start the player with `python linux_yt.py`. Open the printed LAN address with
`/classroom` for the challenge board or `/docs` for the API reference.

## Student API

- `GET /api/v1/challenge` describes the challenge.
- `GET /api/v1/hints/1`, `/2`, or `/3` reveals progressively more detail.
- `GET /api/v1/videos/search?q=...` searches for candidate videos.
- `GET /api/v1/queue` reads current and upcoming tracks.
- `POST /api/v1/requests` accepts JSON such as `{"video_id":"ZbZSe6N_BXs"}`.
- `POST /api/v1/skip-votes` casts a skip vote.

Example request from PowerShell:

```powershell
$base = "http://TEACHER-COMPUTER:8000"
curl.exe "$base/api/v1/videos/search?q=lofi"
curl.exe -X POST "$base/api/v1/requests" -H "Content-Type: application/json" -d '{"video_id":"ZbZSe6N_BXs"}'
```

The existing `/url_add`, `/title_add`, `/read`, and `/skip` routes remain
available for compatibility. This initial classroom version is intended for a
trusted local network; it does not yet include teacher authentication or a
separate teacher control panel.

YouTube playback is not guaranteed to be ad-free. Teacher-approved ad-safe
sources and a dedicated teacher playback mode are planned follow-up work.
