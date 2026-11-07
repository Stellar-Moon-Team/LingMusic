"""
把本机安装的 Blueaka 字体裁成网页用的 woff2 子集。

收录：ASCII、常用中文标点、GB2312 一级汉字（3755 个常用字），
以及 src/data/tracks.ts 里出现的所有字符 —— 以后加的短句里有生僻字，重新跑一次即可：

    python scripts/subset-font.py [字体路径]

依赖：pip install fonttools brotli
"""
import os
import sys
from pathlib import Path

from fontTools import subset

ROOT = Path(__file__).resolve().parent.parent
DEFAULT_FONT = Path(os.environ.get("LOCALAPPDATA", "")) / "Microsoft/Windows/Fonts/font_0.ttf"
OUT = ROOT / "public/fonts/blueaka-subset.woff2"

src = Path(sys.argv[1]) if len(sys.argv) > 1 else DEFAULT_FONT
if not src.exists():
    sys.exit(f"找不到字体文件：{src}\n用法：python scripts/subset-font.py <Blueaka 字体路径>")

chars = set(chr(c) for c in range(0x20, 0x7F))
chars |= set("，。、！？；：…—·『』「」《》（）～“”‘’【】〈〉")
# GB2312 一级汉字：区 16~55
for hi in range(0xB0, 0xD8):
    for lo in range(0xA1, 0xFF):
        try:
            chars.add(bytes([hi, lo]).decode("gb2312"))
        except UnicodeDecodeError:
            pass
chars |= set((ROOT / "src/data/tracks.ts").read_text(encoding="utf-8"))
chars = {c for c in chars if c.isprintable()}

opts = subset.Options()
opts.flavor = "woff2"
opts.layout_features = ["*"]
opts.name_IDs = ["*"]
opts.notdef_outline = True
font = subset.load_font(str(src), opts)
sub = subset.Subsetter(opts)
sub.populate(text="".join(sorted(chars)))
sub.subset(font)
OUT.parent.mkdir(parents=True, exist_ok=True)
subset.save_font(font, str(OUT), opts)
print(f"{len(chars)} 个字符 → {OUT.relative_to(ROOT)} ({OUT.stat().st_size / 1024:.0f} KB)")
