#!/usr/bin/env python3
"""把像素字体按「常用 / 生僻」拆成两个 woff2，配合 unicode-range 让浏览器按需下载。

用法：
    python scripts/build_fonts.py scripts/fonts/fusion-pixel-12px-src.woff2 public/fonts

输入是原始字体（已放在 scripts/fonts/ 下，不参与站点上传），输出 core / ext 两个
woff2 到 public/fonts/，同时把可直接粘贴进 src/styles/global.css 的 @font-face
规则写到 scripts/fonts/font-face.css。

拆分口径：
- core：ASCII、常用标点、全角符号，以及 GB2312 一级字库（最常用的 3755 个汉字）
- ext ：其余字符（GB2312 二级字库 + 扩展区），只有页面真的用到才会下载

输出 unicode-range 由脚本按连续码位自动合并，避免手写漏字。
"""
from __future__ import annotations

import sys
from pathlib import Path

from fontTools import subset
from fontTools.ttLib import TTFont

CORE_RANGES = [
    (0x0020, 0x007E),  # ASCII 可打印字符
    (0x00A0, 0x00FF),  # Latin-1 补充
    (0x2000, 0x206F),  # 常用标点
    (0x2190, 0x21FF),  # 箭头
    (0x2500, 0x257F),  # 制表符
    (0x25A0, 0x25FF),  # 几何图形
    (0x3000, 0x303F),  # CJK 标点
    (0xFF00, 0xFFEF),  # 全角字符
]


def gb2312_level(codepoint: int) -> int:
    """返回 GB2312 级别：1 一级字库、2 二级字库、0 不属于 GB2312。"""
    try:
        encoded = chr(codepoint).encode("gb2312")
    except (UnicodeEncodeError, ValueError):
        return 0
    if len(encoded) != 2:
        return 0
    lead = encoded[0]
    if 0xB0 <= lead <= 0xD7:
        return 1
    if 0xD8 <= lead <= 0xF7:
        return 2
    return 0


def is_core(codepoint: int) -> bool:
    if any(low <= codepoint <= high for low, high in CORE_RANGES):
        return True
    return gb2312_level(codepoint) == 1


def to_ranges(codepoints: list[int]) -> list[tuple[int, int]]:
    ranges: list[tuple[int, int]] = []
    for codepoint in sorted(codepoints):
        if ranges and codepoint == ranges[-1][1] + 1:
            ranges[-1] = (ranges[-1][0], codepoint)
        else:
            ranges.append((codepoint, codepoint))
    return ranges


def format_ranges(ranges: list[tuple[int, int]]) -> str:
    parts = []
    for low, high in ranges:
        parts.append(f"U+{low:04X}" if low == high else f"U+{low:04X}-{high:04X}")
    return ", ".join(parts)


def subset_font(source: Path, target: Path, codepoints: list[int]) -> None:
    options = subset.Options()
    options.flavor = "woff2"
    options.desubroutinize = True
    options.layout_features = ["*"]
    options.name_IDs = ["*"]
    options.name_legacy = True
    options.notdef_outline = True
    options.recalc_bounds = True

    font = TTFont(source)
    subsetter = subset.Subsetter(options=options)
    subsetter.populate(unicodes=codepoints)
    subsetter.subset(font)
    font.flavor = "woff2"
    font.save(target)
    font.close()


def main() -> None:
    if len(sys.argv) != 3:
        print(__doc__)
        raise SystemExit(2)
    source = Path(sys.argv[1])
    out_dir = Path(sys.argv[2])

    font = TTFont(source)
    codepoints = sorted(font.getBestCmap())
    font.close()

    core = [cp for cp in codepoints if is_core(cp)]
    ext = [cp for cp in codepoints if not is_core(cp)]

    out_dir.mkdir(parents=True, exist_ok=True)
    core_path = out_dir / "fusion-pixel-12px-core.woff2"
    ext_path = out_dir / "fusion-pixel-12px-ext.woff2"
    subset_font(source, core_path, core)
    subset_font(source, ext_path, ext)

    css = (
        "/* 由 scripts/build_fonts.py 生成，粘贴到 src/styles/global.css 的字体区。 */\n"
        '@font-face {\n  font-family: "Fusion Pixel 12";\n'
        '  src: url("/fonts/fusion-pixel-12px-core.woff2") format("woff2");\n'
        "  font-display: swap;\n  font-style: normal;\n  font-weight: 400;\n"
        f"  unicode-range: {format_ranges(to_ranges(core))};\n}}\n\n"
        '@font-face {\n  font-family: "Fusion Pixel 12";\n'
        '  src: url("/fonts/fusion-pixel-12px-ext.woff2") format("woff2");\n'
        "  font-display: swap;\n  font-style: normal;\n  font-weight: 400;\n"
        f"  unicode-range: {format_ranges(to_ranges(ext))};\n}}\n"
    )
    css_path = Path(__file__).resolve().parent / "fonts" / "font-face.css"
    css_path.write_text(css, encoding="utf-8")

    print("core:", len(core), "glyphs,", core_path.stat().st_size, "bytes")
    print("ext :", len(ext), "glyphs,", ext_path.stat().st_size, "bytes")
    print("css :", css_path, len(css), "bytes")


if __name__ == "__main__":
    main()
