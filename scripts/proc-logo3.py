from PIL import Image
import sys

src = "/tmp/logo1.png"
dst = "/app/public/enterprise-logo.png"

im = Image.open(src).convert("RGBA")
px = im.load()
w, h = im.size

# Make white / near-white background transparent with a soft edge.
for y in range(h):
    for x in range(w):
        r, g, b, a = px[x, y]
        mx = max(r, g, b)
        mn = min(r, g, b)
        # near-white and low-saturation -> treat as background
        if mn >= 235 and (mx - mn) <= 12:
            px[x, y] = (r, g, b, 0)
        elif mn >= 215 and (mx - mn) <= 18:
            # feather semi-transparent
            alpha = int((235 - mn) / 20 * 255)
            alpha = max(0, min(255, alpha))
            px[x, y] = (r, g, b, alpha)

# Crop to content bounding box to center nicely
bbox = im.getbbox()
if bbox:
    im = im.crop(bbox)

im.save(dst)
print("saved", dst, im.size)
