import os
import smtplib
from email.message import EmailMessage
from typing import Optional

from logging_config import logger
from models import Visitor


def _get_env(name: str) -> Optional[str]:
  value = os.getenv(name)
  return value.strip() if isinstance(value, str) and value.strip() else None


def send_appointment_email(visitor: Visitor) -> None:
  if not visitor.email:
    return

  host = _get_env("SMTP_HOST")
  port = _get_env("SMTP_PORT")
  username = _get_env("SMTP_USERNAME")
  password = _get_env("SMTP_PASSWORD")
  sender = _get_env("SMTP_FROM") or username

  if not host or not port or not username or not password or not sender:
    logger.warning("SMTP config is missing, skip sending email for visitor_id=%s", visitor.visitorId)
    return

  try:
    port_int = int(port)
  except ValueError:
    logger.warning("Invalid SMTP_PORT value: %s", port)
    return

  subject = "Xác nhận lịch hẹn tại công ty"

  time_text = ""
  if visitor.appointmentDate or visitor.appointmentTime:
    date_part = visitor.appointmentDate or ""
    time_part = visitor.appointmentTime or ""
    time_text = f"{date_part} {time_part}".strip()

  host_text = visitor.hostName or "bộ phận liên quan"

  token_text = visitor.qrToken or "Không có mã QR"

  body = "\n".join(
    [
      f"Xin chào {visitor.fullName},",
      "",
      "Lịch hẹn của bạn tại công ty đã được xác nhận.",
      "",
      f"- Thời gian: {time_text or 'Chưa xác định'}",
      f"- Gặp: {host_text}",
      "",
      "Mã QR / mã check-in của bạn:",
      f"  {token_text}",
      "",
      "Vui lòng mang theo mã này khi đến quầy lễ tân để được hỗ trợ check-in.",
    ]
  )

  message = EmailMessage()
  message["From"] = sender
  message["To"] = visitor.email
  message["Subject"] = subject
  message.set_content(body)

  try:
    with smtplib.SMTP(host, port_int) as server:
      server.starttls()
      server.login(username, password)
      server.send_message(message)
    logger.info("Appointment email sent to %s for visitor_id=%s", visitor.email, visitor.visitorId)
  except Exception as exc:
    logger.exception("Failed to send appointment email for visitor_id=%s: %s", visitor.visitorId, exc)

