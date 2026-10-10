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
