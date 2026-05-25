"""One-shot frame analysis for Node spawn (stdin JSON -> stdout JSON)."""
import json
import sys
from yolo_detector import analyze_frame

if __name__ == "__main__":
    data = json.load(sys.stdin)
    result = analyze_frame(data["frame"])
    result["source"] = "opencv"
    print(json.dumps(result))
