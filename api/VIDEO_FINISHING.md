Video finishing runs after provider footage is downloaded and before its final
approval preview. It preserves the footage inside a 720 × 1280 canvas, burns in
approved narration and scene text, composes the exact selected campaign images,
and displays approved business, offer, and contact text on a closing card. Audio
is normalized, then the result is probed for dimensions, length, and audible audio.

The API server needs `ffmpeg` and `ffprobe` with the `libx264`, AAC, overlay, scale,
and loudnorm capabilities. Binaries are found on `PATH` or the standard Homebrew
locations. No FFmpeg subtitle or drawtext filter is required: text becomes PNG
overlays and is encoded into the final MP4.

For Khmer shaping, install Pango 1.50 or newer (`pango-view`) and a Khmer font. On macOS this
project uses the system Khmer Sangam MN font; Linux servers should install Noto
Sans Khmer. An alternative is Pillow with RAQM and a Khmer font. Plain Pillow
without a text shaper is rejected for Khmer rather than producing broken glyphs.
Pango's serialized layout is checked for missing glyphs before text is encoded.
Pillow is already in the Python requirements. On macOS the optional server tools
can be installed with `brew install ffmpeg pango`; Debian/Ubuntu servers can use
`apt install ffmpeg pango1.0-tools fonts-noto-core`.

Captions come from the approved narration, separately from the social post
caption. They follow planned scene timing scaled to the actual clip. They are
**not an audio transcription**: the quality report asks reviewers to check the
generated spoken words, Khmer pronunciation, and timing. Rendering approved facts
on the closing card verifies their insertion, not the truth of those facts or
the provider's generated visuals. No OCR or visual-content score is claimed.

Successful finishing returns `<video-stem>.finished.mp4` and its check report,
with a UTF-8 `<video-stem>.narration.srt` sidecar. The original clip remains.
Processing failures raise a retryable error and never silently return raw video.
Missing/silent audio is a failed quality check; clips outside 10–60 seconds and
substantial timing changes require review. An intentionally empty offer is
accepted without adding a new offer.

Run the synthetic integration checks without provider calls:

```sh
PYTHONPATH=api .venv/bin/python -m unittest discover -s api/tests -p test_video_finishing.py -v
```

The tests encode short English and Khmer samples, check real output pixels,
selected-photo composition, subtitles, audio, aspect ratio, missing audio,
invalid scene timing, and rejection of unauthorized asset identifiers.
