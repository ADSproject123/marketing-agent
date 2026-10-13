#!/usr/bin/env python3
"""Start the Rachana AI API + Telegram approval gate.

Usage (from this folder):
    python run.py

Or from the project root:
    python api/run.py
"""

from __future__ import annotations

import os
import sys
from pathlib import Path

API_DIR = Path(__file__).resolve().parent

# If executed with system/pyenv python instead of the project venv, auto-switch to .venv
def _ensure_venv() -> None:
    venv_candidates = [
        API_DIR / ".venv",
        API_DIR.parent / ".venv",
    ]
    current_prefix = Path(sys.prefix).resolve()
    for venv_dir in venv_candidates:
        if venv_dir.is_dir():
            python_bin = "Scripts/python.exe" if sys.platform == "win32" else "bin/python"
            target_python = venv_dir / python_bin
            if target_python.exists() and current_prefix != venv_dir.resolve():
                print(f"[*] Activating project virtual environment ({target_python})...", file=sys.stderr)
                os.execv(str(target_python), [str(target_python), *sys.argv])
            return

_ensure_venv()

if str(API_DIR) not in sys.path:
    sys.path.insert(0, str(API_DIR))

from app.main import main

if __name__ == "__main__":
    main()

