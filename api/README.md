# Marketing Agent API

FastAPI backend + Telegram approval gate.

## Run

```bash
# from project root
source .venv/bin/activate
cd api
python run.py
```

Listens on [http://127.0.0.1:8787](http://127.0.0.1:8787).

The guided web flow creates a saved script draft before starting video generation. Draft edits and focused revisions stay account-owned; rendering requires the latest saved version. A revision of a finished campaign creates a separate draft and preserves the previous video's Telegram review.

Video finishing requires `ffmpeg` and `ffprobe`. Khmer captions also require a Khmer font and Pango (`pango-view`) or Pillow built with RAQM. The output report checks the actual dimensions, duration and presence of audio, and records which business details were added in the end card. Captions use approved narration with planned timing; listen to the preview to confirm alignment.

## Layout

```
api/
  run.py           # entrypoint
  requirements.txt
  app/
    webapp.py      # HTTP routes + auth
    main.py        # process wiring
    config.py
    auth/
    jobs/
    llm/
    notebooklm/
    facebook/
    telegram_bot/
```
