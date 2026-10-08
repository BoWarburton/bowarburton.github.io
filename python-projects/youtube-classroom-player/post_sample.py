import json
from urllib.request import Request, urlopen

url = "http://127.0.0.1:8000/api/v1/requests"
body = json.dumps({"video_id": "ZbZSe6N_BXs"}).encode()

request = Request(
    url,
    data=body,
    headers={"Content-Type": "application/json"},
    method="POST",
)

with urlopen(request) as response:
    print(response.read().decode())