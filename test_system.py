import unittest
from youtube_service import extract_video_id, YouTubeExtractor

class TestYouTubeExtractor(unittest.TestCase):
    def test_extract_video_id(self):
        urls = [
            ("https://www.youtube.com/watch?v=dQw4w9WgXcQ", "dQw4w9WgXcQ"),
            ("https://youtu.be/dQw4w9WgXcQ", "dQw4w9WgXcQ"),
            ("https://www.youtube.com/shorts/dQw4w9WgXcQ", "dQw4w9WgXcQ"),
            ("https://www.youtube.com/embed/dQw4w9WgXcQ", "dQw4w9WgXcQ"),
            ("dQw4w9WgXcQ", "dQw4w9WgXcQ"),
        ]
        for url, expected in urls:
            self.assertEqual(extract_video_id(url), expected)

    def test_public_video_transcript(self):
        extractor = YouTubeExtractor()
        # Test with a known public video with subtitles (e.g. YouTube's official video or TED talk)
        # video ID: jNQXAC9IVRw (First video on YouTube)
        result = extractor.get_transcript("jNQXAC9IVRw")
        print("Transcript Extraction Result:", result.get("success"), result.get("method"))
        self.assertTrue(result.get("success"))
        self.assertIn("full_text_clean", result)

if __name__ == "__main__":
    unittest.main()
