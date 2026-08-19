from PIL import Image, ImageDraw, ImageFont

def make_icon(path, size):
    img = Image.new("RGB", (size, size), "#0071CE")
    draw = ImageDraw.Draw(img)
    text = "RA"
    try:
        font = ImageFont.truetype("arialbd.ttf", int(size * 0.4))
    except Exception:
        font = ImageFont.load_default()
    bbox = draw.textbbox((0, 0), text, font=font)
    w, h = bbox[2] - bbox[0], bbox[3] - bbox[1]
    draw.text(((size - w) / 2 - bbox[0], (size - h) / 2 - bbox[1]), text, fill="white", font=font)
    img.save(path)

make_icon("static/icons/icon-192.png", 192)
make_icon("static/icons/icon-512.png", 512)
print("Iconos generados")
