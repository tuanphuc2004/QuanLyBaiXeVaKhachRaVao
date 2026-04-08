from __future__ import annotations

import re
from typing import Tuple

_EASYOCR_READER = None


def normalize_plate_text(text: str) -> str:
    raw = (text or "").upper().strip()
    # Keep only common plate characters.
    cleaned = re.sub(r"[^0-9A-Z-]", "", raw)
    cleaned = re.sub(r"-{2,}", "-", cleaned)
    return cleaned


def ocr_plate_from_jpeg_bytes(image_bytes: bytes) -> Tuple[str, float]:
    """
    Server-side OCR MVP using EasyOCR (no Tesseract dependency) + OpenCV preprocessing.
    Returns (plateNumber, confidence). If not recognized, plateNumber = "".
    """
    try:
        import cv2  # type: ignore
        import numpy as np  # type: ignore
    except Exception as e:
        raise RuntimeError("Thiếu dependencies OCR (opencv-python/numpy). Hãy cài theo requirements rồi restart server.") from e

    try:
        import easyocr  # type: ignore
    except Exception as e:
        raise RuntimeError(
            "Thiếu thư viện EasyOCR. Hãy chạy 'pip install easyocr' (hoặc pip install -r requirements.txt) rồi restart server."
        ) from e

    if not image_bytes:
        return ("", 0.0)

    np_arr = np.frombuffer(image_bytes, np.uint8)
    img = cv2.imdecode(np_arr, cv2.IMREAD_COLOR)
    if img is None:
        return ("", 0.0)

    # EasyOCR works with RGB images.
    rgb = cv2.cvtColor(img, cv2.COLOR_BGR2RGB)

    global _EASYOCR_READER
    if _EASYOCR_READER is None:
        # gpu=False for portability.
        _EASYOCR_READER = easyocr.Reader(["en"], gpu=False)

    # Run OCR: returns list of (bbox, text, confidence).
    # Use allowlist to reduce noise and improve plate parsing.
    results = _EASYOCR_READER.readtext(
        rgb,
        detail=1,
        allowlist="0123456789ABCDEFGHIJKLMNOPQRSTUVWXYZ-",
    )

    tokens = []
    for _bbox, text, conf in results:
        norm = normalize_plate_text(text)
        if not norm:
            continue
        try:
            score = float(conf) if conf is not None else 0.0
        except Exception:
            score = 0.0
        tokens.append((norm, score))

    if not tokens:
        return ("", 0.0)

    def normalize_compact(s: str) -> str:
        return re.sub(r"[^0-9A-Z]", "", (s or "").upper())

    def is_valid_plate(candidate: str) -> bool:
        c = normalize_compact(candidate)
        # Loose VN-like pattern: 2 digits + 1-2 alnum + 4-6 digits
        return re.match(r"^\d{2}[A-Z0-9]{1,2}\d{4,6}$", c) is not None

    best_plate = ""
    best_conf = 0.0

    # 1) Prefer single-token matches.
    for norm, score in tokens:
        if is_valid_plate(norm) and score >= best_conf:
            best_plate = norm
            best_conf = score

    if best_plate:
        return (best_plate, min(0.95, best_conf))

    # 2) Try combining top tokens (EasyOCR often splits plates into 2 parts).
    tokens_sorted = sorted(tokens, key=lambda x: x[1], reverse=True)[:6]
    for i in range(len(tokens_sorted)):
        for j in range(len(tokens_sorted)):
            if i == j:
                continue
            a, sa = tokens_sorted[i]
            b, sb = tokens_sorted[j]
            combined = f"{a}{b}"
            if is_valid_plate(combined):
                conf = min(sa, sb)
                if conf >= best_conf:
                    best_plate = normalize_plate_text(combined)
                    best_conf = conf

    return (best_plate, min(0.95, best_conf)) if best_plate else ("", 0.0)

