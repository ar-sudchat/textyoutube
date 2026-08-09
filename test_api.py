from fastapi.testclient import TestClient
from server import app

client = TestClient(app)

def test_health():
    response = client.get("/api/health")
    assert response.status_code == 200
    assert response.json()["status"] == "ok"
    print("Health check passed!")

def test_extract_endpoint():
    response = client.post("/api/extract", json={
        "url": "https://www.youtube.com/watch?v=jNQXAC9IVRw",
        "languages": ["en"]
    })
    assert response.status_code == 200
    data = response.json()
    assert data["success"] is True
    assert "full_text_clean" in data
    print("Extract endpoint test passed!")
    print("Sample transcript:", data["full_text_clean"][:100])

if __name__ == "__main__":
    test_health()
    test_extract_endpoint()
