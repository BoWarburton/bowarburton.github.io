import unittest
from unittest.mock import patch

from fastapi.testclient import TestClient

import linux_yt


class ClassroomApiTests(unittest.TestCase):
    @classmethod
    def setUpClass(cls):
        cls.client = TestClient(linux_yt.yt)

    def setUp(self):
        with linux_yt.QUEUE_LOCK:
            self.original_queue = list(linux_yt.QUEUE)
            linux_yt.QUEUE.clear()
        with linux_yt.SKIP_VOTE_LOCK:
            self.original_song = linux_yt.CURRENT_SONG
            self.original_votes = set(linux_yt.SKIP_VOTES)
            self.original_skip_flag = linux_yt.SKIP_FLAG
            self.original_skip_required = linux_yt.SKIP_VOTES_REQUIRED
            linux_yt.CURRENT_SONG = ""
            linux_yt.SKIP_VOTES.clear()
            linux_yt.SKIP_FLAG = False

    def tearDown(self):
        with linux_yt.QUEUE_LOCK:
            linux_yt.QUEUE[:] = self.original_queue
        with linux_yt.SKIP_VOTE_LOCK:
            linux_yt.CURRENT_SONG = self.original_song
            linux_yt.SKIP_VOTES.clear()
            linux_yt.SKIP_VOTES.update(self.original_votes)
            linux_yt.SKIP_FLAG = self.original_skip_flag
            linux_yt.SKIP_VOTES_REQUIRED = self.original_skip_required

    def test_progressive_hints_are_available(self):
        first_hint = self.client.get("/api/v1/hints/1")
        final_hint = self.client.get("/api/v1/hints/3")

        self.assertEqual(first_hint.status_code, 200)
        self.assertEqual(first_hint.json()["level"], 1)
        self.assertIn("GET", first_hint.json()["hint"])
        self.assertIn("POST", final_hint.json()["hint"])
        self.assertEqual(self.client.get("/api/v1/hints/4").status_code, 404)

    def test_classroom_page_is_served(self):
        response = self.client.get("/classroom")

        self.assertEqual(response.status_code, 200)
        self.assertIn("Queue Quest", response.text)
        self.assertIn("/api/v1/queue", response.text)

    def test_get_search_returns_video_candidates(self):
        with patch("yt_dlp.YoutubeDL") as youtube_dl:
            youtube = youtube_dl.return_value.__enter__.return_value
            youtube.extract_info.return_value = {
                "entries": [
                    {
                        "id": "ZbZSe6N_BXs",
                        "title": "Test song",
                        "channel": "Test channel",
                    }
                ]
            }

            response = self.client.get(
                "/api/v1/videos/search", params={"q": "test song"}
            )

        self.assertEqual(response.status_code, 200)
        self.assertEqual(response.json()["results"][0]["video_id"], "ZbZSe6N_BXs")
        self.assertEqual(response.json()["results"][0]["title"], "Test song")

    def test_post_request_validates_and_queues_video_id(self):
        invalid_response = self.client.post(
            "/api/v1/requests", json={"video_id": "not-a-video-id"}
        )
        self.assertEqual(invalid_response.status_code, 422)

        response = self.client.post(
            "/api/v1/requests", json={"video_id": "ZbZSe6N_BXs"}
        )

        self.assertEqual(response.status_code, 200)
        self.assertEqual(response.json()["queue_position"], 1)
        queue = self.client.get("/api/v1/queue").json()
        self.assertEqual(
            queue["up_next"], ["https://www.youtube.com/watch?v=ZbZSe6N_BXs"]
        )

    def test_skip_vote_uses_configured_threshold(self):
        linux_yt.CURRENT_SONG = "https://www.youtube.com/watch?v=ZbZSe6N_BXs"
        linux_yt.SKIP_VOTES_REQUIRED = 1

        response = self.client.post("/api/v1/skip-votes")

        self.assertEqual(response.status_code, 200)
        self.assertEqual(response.json()["votes"], 1)
        self.assertEqual(response.json()["required"], 1)
        self.assertIn("skip approved", response.json()["message"])


if __name__ == "__main__":
    unittest.main()