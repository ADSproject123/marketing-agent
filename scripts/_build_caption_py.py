#!/usr/bin/env python3
"""Generate api/app/llm/caption.py from skeleton + base64 Khmer snippets."""

from __future__ import annotations

import ast
import base64
import re
from pathlib import Path

ROOT = Path(__file__).resolve().parents[1]
OUT = ROOT / "api" / "app" / "llm" / "caption.py"
NLM = ROOT / "api" / "app" / "notebooklm" / "client.py"
GUIDED_TEST = ROOT / "api" / "tests" / "test_guided_campaign.py"
SKELETON = Path(__file__).with_name("_caption_skeleton.py")

# ASCII-only storage for Khmer fallbacks (decoded at build time).
B64 = {
    "km_title": "4Z6A4Z624Z6g4Z+S4Z6c4Z+B4Z6h4Z624Z6P4Z+B4Z6W4Z634Z6f4Z+B4Z6f4Z6F4Z674Z6E4Z6f4Z6U4Z+S4Z6P4Z624Z6g4Z+N",
    "km_brief": "4Z6Z4Z674Z6R4Z+S4Z6S4Z6T4Z624Z6A4Z624Z6a4Z6c4Z644Z6K4Z+B4Z6i4Z684Z6B4Z+S4Z6b4Z644Z6f4Z6Y4Z+S4Z6a4Z624Z6U4Z+L4Z6g4Z624Z6E4Z6A4Z624Z6g4Z+S4Z6c4Z+B4Z6A4Z+S4Z6T4Z674Z6E4Z6P4Z+G4Z6U4Z6T4Z+L4Z+UIOGeleGfkuGen+GeluGfkuGenOGeleGfkuGen+GetuGemeGegOGetuGemuGeleGfkuGej+Gem+Gfi+Geh+GevOGek+Gek+GfheGeheGeu+GehOGen+GelOGfkuGej+GetuGeoOGfjeGek+GfgeGfh+Geh+GetuGel+GetuGen+GetuGegeGfkuGemOGfguGemuGflA==",
    "km_caption": "4Z6F4Z674Z6E4Z6f4Z6U4Z+S4Z6P4Z624Z6g4Z+N4Z6T4Z+B4Z+HIOGegOGetuGek+Gfi+Gej+GfguGemuGeuOGegOGemuGetuGemeGeh+GetuGemOGeveGemeGegOGetuGeoOGfkuGenOGfgSEg4Z6Y4Z6A4Z6g4Z624Z6E4Z6l4Z6h4Z684Z6c4Z6T4Z+B4Z+H4Z+UICPhnoDhnrbhnqDhn5Lhnpzhn4EgI+GeheGeu+GehOGen+GelOGfkuGej+GetuGeoOGfjQ==",
    "km_hook": "4Z6U4Z6E4Z+S4Z6g4Z624Z6J4Z6A4Z624Z6a4Z6F4Z624Z6A4Z+L4Z6A4Z624Z6g4Z+S4Z6c4Z+B",
    "km_beat1": "4Z6U4Z6E4Z+S4Z6g4Z624Z6J4Z6A4Z624Z6a4Z6V4Z+S4Z6P4Z6b4Z+L4Z6H4Z684Z6T",
    "km_beat2": "4Z6U4Z6E4Z+S4Z6g4Z624Z6J4Z6X4Z+B4Z6f4Z6H4Z+S4Z6H4Z+I",
    "km_beat3": "4Z6i4Z6J4Z+S4Z6H4Z6+4Z6J4Z6Y4Z6A4Z6g4Z624Z6E",
    "km_offer": "4Z6A4Z624Z6a4Z6V4Z+S4Z6P4Z6b4Z+L4Z6H4Z684Z6T4Z6F4Z674Z6E4Z6f4Z6U4Z+S4Z6P4Z624Z6g4Z+N",
    "km_cta": "4Z6Y4Z6A4Z6g4Z624Z6E4Z6T4Z+F4Z6F4Z674Z6E4Z6f4Z6U4Z+S4Z6P4Z624Z6g4Z+N4Z6T4Z+B4Z+H",
    "km_beat3_ensure": "4Z6U4Z6E4Z+S4Z6g4Z624Z6J4Z6i4Z6P4Z+S4Z6Q4Z6U4Z+S4Z6a4Z6Z4Z+E4Z6H4Z6T4Z+NIOGek+Get+GehOGegOGetuGemuGeouGfhuGeluGetuGenOGek+GetuGenA==",
    "km_must_not": "4Z6P4Z6Y4Z+S4Z6b4Z+DIOGerOGegOGetuGemuGeleGfkuGeiuGem+Gfi+Geh+GevOGek+GeiuGfguGem+GemOGet+Gek+GelOGetuGek+GeleGfkuGeiuGem+Gfiw==",
    "no_offer_km": "4Z6Y4Z634Z6T4Z6Y4Z624Z6T4Z6A4Z624Z6a4Z6V4Z+S4Z6K4Z6b4Z+L4Z6H4Z684Z6T4Z6W4Z634Z6f4Z+B4Z6f",
    "khmer_word": "4Z6B4Z+S4Z6Y4Z+C4Z6a",
}


def b64(key: str) -> str:
    return base64.b64decode(B64[key]).decode("utf-8")


def main() -> None:
    nlm = NLM.read_text(encoding="utf-8")
    parts = re.findall(r'"([^"\n]*[\u1780-\u17ff][^"\n]*)"', nlm)
    if len(parts) < 5:
        raise SystemExit(f"Expected >=5 Khmer snippets from notebooklm client, got {len(parts)}")
    guided_test = GUIDED_TEST.read_text(encoding="utf-8")
    guided_heading = re.search(r'"(សេច[^"]+)"', guided_test).group(1)

    values = {
        "guided_heading": guided_heading,
        "khmer_word": b64("khmer_word"),
        "no_offer_km": b64("no_offer_km"),
        "km_lang_1": parts[2],
        "km_lang_2": parts[3],
        "km_lang_3": parts[4],
        "km_vert_1": parts[0],
        "km_vert_2": parts[1],
        "km_title": b64("km_title"),
        "km_brief": b64("km_brief"),
        "km_caption": b64("km_caption"),
        "km_hook": b64("km_hook"),
        "km_beat1": b64("km_beat1"),
        "km_beat2": b64("km_beat2"),
        "km_beat3": b64("km_beat3"),
        "km_offer": b64("km_offer"),
        "km_cta": b64("km_cta"),
        "km_beat3_ensure": b64("km_beat3_ensure"),
        "km_must_not": b64("km_must_not"),
    }

    skeleton = SKELETON.read_text(encoding="utf-8")

    def repl(match: re.Match[str]) -> str:
        return repr(values[match.group(1)])

    content = re.sub(r"<<<([a-z0-9_]+)>>>", repl, skeleton)
    OUT.write_text(content, encoding="utf-8")
    ast.parse(content)
    print(f"wrote {OUT} ({OUT.stat().st_size} bytes)")


if __name__ == "__main__":
    main()
