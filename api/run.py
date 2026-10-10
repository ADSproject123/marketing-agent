#!/usr/bin/env python3
"""Start the Marketing Agent API + Telegram approval gate.

Usage (from this folder):
    python run.py

Or from the project root:
    python api/run.py
"""

from __future__ import annotations

import sys
from pathlib import Path

API_DIR = Path(__file__).resolve().parent
if str(API_DIR) not in sys.path:
    sys.path.insert(0, str(API_DIR))

from app.main import main

if __name__ == "__main__":
    main()
