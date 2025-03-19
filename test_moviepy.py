# test_moviepy.py
import moviepy.editor as mpy

print(f"moviepy version: {mpy.__version__}")

try:
    # Try to create a very simple video clip (doesn't even need to be valid)
    clip = mpy.ColorClip((640, 480), color=(255, 0, 0), duration=1)  # 1-second red clip
    clip.close()
    print("moviepy seems to be working (basic test)")
except Exception as e:
    print(f"moviepy test failed: {e}")