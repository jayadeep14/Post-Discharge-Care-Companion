"""Personal WhatsApp Web bridge webhook and Gemini reply handling."""

import asyncio
import logging
import os
import time
from collections import OrderedDict
from pathlib import Path
from typing import Any

import httpx
from dotenv import load_dotenv
from fastapi import APIRouter, BackgroundTasks, HTTPException, Query, Request
from fastapi.responses import PlainTextResponse
from google import genai

load_dotenv(Path(__file__).resolve().parent / ".env")

logger = logging.getLogger("personal_whatsapp_bot")
router = APIRouter()

GEMINI_API_KEY = os.getenv("GEMINI_API_KEY", "").strip()
LOCAL_GATEWAY_URL = os.getenv(
    "LOCAL_GATEWAY_URL", "http://localhost:3000/send"
).strip()
VERIFY_TOKEN = os.getenv("VERIFY_TOKEN", "").strip()
if not GEMINI_API_KEY:
    raise RuntimeError("GEMINI_API_KEY is missing from backend/.env")
if not VERIFY_TOKEN:
    raise RuntimeError("VERIFY_TOKEN is missing from backend/.env")

gemini_client = genai.Client(api_key=GEMINI_API_KEY)
processed_ids: OrderedDict[str, float] = OrderedDict()
processed_ids_lock = asyncio.Lock()
MESSAGE_ID_TTL_SECONDS = 24 * 60 * 60
MAX_PROCESSED_IDS = 20_000


def _string(*values: Any) -> str | None:
    for value in values:
        if isinstance(value, str) and value.strip():
            return value.strip()
    return None


def _extract_message(payload: dict[str, Any]) -> dict[str, str] | None:
    message: Any = payload.get("message", payload)
    data = payload.get("data")
    if isinstance(data, dict) and isinstance(data.get("message"), dict):
        message = data["message"]
    if not isinstance(message, dict):
        return None

    if message.get("fromMe") is True or message.get("from_me") is True:
        return None

    message_id = _string(
        message.get("id"), message.get("message_id"),
        message.get("messageId"), payload.get("id"), payload.get("message_id"),
    )
    sender = _string(
        message.get("from"), message.get("sender"), message.get("sender_id"),
        message.get("phone"), payload.get("from"), payload.get("sender"),
        payload.get("phone"),
    )
    text = message.get("text")
    if isinstance(text, dict):
        text = text.get("body")
    body = _string(
        text if isinstance(text, str) else None,
        message.get("body"), payload.get("text"), payload.get("body"),
    )
    if not message_id or not sender or not body:
        return None
    return {"message_id": message_id, "sender": sender, "text": body}


async def _already_processed(message_id: str) -> bool:
    now = time.time()
    async with processed_ids_lock:
        expired = [
            key for key, timestamp in processed_ids.items()
            if now - timestamp > MESSAGE_ID_TTL_SECONDS
        ]
        for key in expired:
            processed_ids.pop(key, None)
        if message_id in processed_ids:
            return True
        processed_ids[message_id] = now
        while len(processed_ids) > MAX_PROCESSED_IDS:
            processed_ids.popitem(last=False)
        return False


async def _generate_reply(text: str) -> str:
    try:
        response = await gemini_client.aio.models.generate_content(
            model="gemini-2.5-flash",
            contents=text,
        )
        answer = (response.text or "").strip()
        if not answer:
            raise RuntimeError("Gemini returned an empty response")
        return answer
    except Exception:
        logger.exception("Gemini request failed")
        raise


async def _send_message(to: str, message: str) -> bool:
    payload = {"to": to, "message": message[:4096]}
    async with httpx.AsyncClient(timeout=httpx.Timeout(15.0)) as client:
        for attempt in range(1, 4):
            try:
                response = await client.post(LOCAL_GATEWAY_URL, json=payload)
                if response.is_success:
                    logger.info("Reply sent to %s through local WhatsApp bridge", to)
                    return True
                try:
                    error_payload: Any = response.json()
                except ValueError:
                    error_payload = response.text
                logger.error(
                    "Bridge returned HTTP %s (attempt %d/3): %s",
                    response.status_code, attempt, error_payload,
                )
                if response.status_code < 500 and response.status_code != 429:
                    return False
            except (httpx.TimeoutException, httpx.NetworkError) as exc:
                logger.error(
                    "Bridge connection failed (attempt %d/3): %s",
                    attempt, exc, exc_info=True,
                )
                if attempt == 3:
                    return False
            except httpx.HTTPError:
                logger.exception("HTTP error calling local WhatsApp bridge")
                return False
            if attempt < 3:
                await asyncio.sleep(2 ** (attempt - 1))
    return False


async def _process_message(message: dict[str, str]) -> None:
    try:
        try:
            answer = await _generate_reply(message["text"])
        except Exception:
            answer = "Sorry, I’m having trouble replying right now. Please try again shortly."
        sent = await _send_message(message["sender"], answer)
        if not sent and "trouble replying right now" not in answer:
            await _send_message(
                message["sender"],
                "Sorry, I couldn’t send that reply. Please try again shortly.",
            )
    except Exception:
        logger.exception("Unexpected failure handling message ID %s", message["message_id"])


@router.get("/webhook", response_class=PlainTextResponse)
async def verify_webhook(
    token: str | None = Query(default=None),
    verify_token: str | None = Query(default=None),
) -> PlainTextResponse:
    if (token or verify_token) != VERIFY_TOKEN:
        raise HTTPException(status_code=403, detail="Invalid verification token")
    return PlainTextResponse("verified")


@router.post("/webhook")
async def receive_webhook(
    request: Request,
    background_tasks: BackgroundTasks,
) -> dict[str, str]:
    try:
        payload = await request.json()
        if not isinstance(payload, dict):
            raise ValueError("Webhook body must be a JSON object")
    except Exception as exc:
        logger.exception("Could not parse incoming webhook JSON")
        raise HTTPException(status_code=400, detail="Invalid JSON payload") from exc

    message = _extract_message(payload)
    if message is None:
        return {"status": "ignored"}
    if await _already_processed(message["message_id"]):
        return {"status": "duplicate"}
    background_tasks.add_task(_process_message, message)
    return {"status": "accepted"}
