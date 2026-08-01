from PIL import Image

SRC = "/app/public/pclinic-light.png"
ALPHA_CUT = 30  # drop faint halo/vignette pixels below this alpha

def clean(path):
    im = Image.open(path).convert("RGBA")
    px = im.load()
    w, h = im.size
    for y in range(h):
        for x in range(w):
            r, g, b, a = px[x, y]
            if a < ALPHA_CUT:
                px[x, y] = (0, 0, 0, 0)
    return im

def tight_crop(im):
    bbox = im.getbbox()  # bbox of non-zero-alpha pixels
    return im.crop(bbox) if bbox else im

# Header: full-color logo, transparent bg, tightly cropped
header = tight_crop(clean(SRC))
header.save("/app/public/pclinic-header.png")
print("header", header.size)

# Footer: white monochrome (recolor opaque pixels to white, keep alpha)
mono = header.copy()
mp = mono.load()
w, h = mono.size
for y in range(h):
    for x in range(w):
        r, g, b, a = mp[x, y]
        if a > 0:
            mp[x, y] = (255, 255, 255, a)
mono.save("/app/public/pclinic-footer.png")
print("footer", mono.size)
