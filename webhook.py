from fastapi import FastAPI, Request, HTTPException, Header, BackgroundTasks
from pydantic import BaseModel
from typing import Optional
import anthropic
import hmac
import hashlib
import logging
import os

logger = logging.getLogger(__name__)
app = FastAPI()

WEBHOOK_SECRET = os.environ.get("WEBHOOK_SECRET", "")

claude = anthropic.AsyncAnthropic()  # reads ANTHROPIC_API_KEY from env


# --- Models ---

class CustomerDetails(BaseModel):
    customer_phone: str
    customer_rep: str
    customer_name: str
    customer_id: int
    customer_email: str


class JobDetails(BaseModel):
    job_address: str
    customer_rep: str
    job_name: str
    customer_email: str
    customer_phone: str
    job_number: str
    customer_name: str
    customer_id: int


class Stage(BaseModel):
    name: str
    code: str


class TaskDetails(BaseModel):
    due_date: Optional[str] = None
    task_title: str
    job_number: Optional[str] = None
    customer_name: Optional[str] = None
    customer_id: Optional[int] = None
    job_id: Optional[int] = None
    completed_at: Optional[str] = None
    completed_by_user_id: Optional[int] = None


class WebhookEvent(BaseModel):
    action: str
    operation: str
    id: int
    details: dict
    stage_moved_from: Optional[Stage] = None
    stage_moved_to: Optional[Stage] = None


# --- Claude helper ---

async def ask_claude(prompt: str, max_tokens: int = 512) -> str:
    response = await claude.messages.create(
        model="claude-sonnet-4-6",
        max_tokens=max_tokens,
        system=[
            {
                "type": "text",
                "text": "You are a concise assistant for a roofing sales CRM. Give practical, direct responses.",
                "cache_control": {"type": "ephemeral"},
            }
        ],
        messages=[{"role": "user", "content": prompt}],
    )
    for block in response.content:
        if block.type == "text":
            return block.text
    return ""


# --- Handlers ---

def on_customer_create(event: WebhookEvent):
    d = CustomerDetails(**event.details)
    logger.info("Customer created: %s (id=%s, email=%s)", d.customer_name, d.customer_id, d.customer_email)


def on_customer_delete(event: WebhookEvent):
    d = CustomerDetails(**event.details)
    logger.info("Customer deleted: %s (id=%s)", d.customer_name, d.customer_id)


def on_job_create(event: WebhookEvent):
    d = JobDetails(**event.details)
    logger.info("Job created: %s (%s) for %s", d.job_name, d.job_number, d.customer_name)


async def on_job_stage_change(event: WebhookEvent):
    d = JobDetails(**event.details)
    from_stage = event.stage_moved_from.name if event.stage_moved_from else "unknown"
    to_stage = event.stage_moved_to.name if event.stage_moved_to else "unknown"
    logger.info("Job %s stage: %s → %s", d.job_number, from_stage, to_stage)

    prompt = (
        f"A roofing job just moved stages.\n\n"
        f"Job: {d.job_name}\n"
        f"Customer: {d.customer_name} ({d.customer_email})\n"
        f"Address: {d.job_address}\n"
        f"Rep: {d.customer_rep}\n"
        f"Stage: {from_stage} → {to_stage}\n\n"
        f"List 3 concise next-action recommendations for the sales rep."
    )
    advice = await ask_claude(prompt, max_tokens=256)
    logger.info("Claude stage advice for %s:\n%s", d.job_number, advice)


async def on_job_lost(event: WebhookEvent):
    d = JobDetails(**event.details)
    logger.info("Job lost: %s (%s)", d.job_name, d.job_number)

    prompt = (
        f"A roofing sales job was just marked lost.\n\n"
        f"Job: {d.job_name}\n"
        f"Customer: {d.customer_name} ({d.customer_email})\n"
        f"Address: {d.job_address}\n"
        f"Rep: {d.customer_rep}\n\n"
        f"Write a short, empathetic win-back email the rep can send to keep the door open."
    )
    email_draft = await ask_claude(prompt, max_tokens=512)
    logger.info("Claude win-back draft for %s:\n%s", d.job_number, email_draft)


def on_job_delete(event: WebhookEvent):
    d = JobDetails(**event.details)
    logger.info("Job deleted: %s (%s)", d.job_name, d.job_number)


async def on_task_created(event: WebhookEvent):
    d = TaskDetails(**event.details)
    logger.info("Task created: %s (due=%s, job=%s)", d.task_title, d.due_date, d.job_id)

    prompt = (
        f"A task was created for a roofing job.\n\n"
        f"Task: {d.task_title}\n"
        f"Customer: {d.customer_name}\n"
        f"Due: {d.due_date or 'no due date'}\n\n"
        f"Give one sentence of practical guidance for completing this task efficiently."
    )
    tip = await ask_claude(prompt, max_tokens=128)
    logger.info("Claude task tip: %s", tip)


def on_task_completed(event: WebhookEvent):
    d = TaskDetails(**event.details)
    logger.info("Task completed: %s at %s by user %s", d.task_title, d.completed_at, d.completed_by_user_id)


HANDLERS = {
    ("customers", "create"):      on_customer_create,
    ("customers", "delete"):      on_customer_delete,
    ("jobs",      "create"):      on_job_create,
    ("jobs",      "stage_change"): on_job_stage_change,
    ("jobs",      "lost"):        on_job_lost,
    ("jobs",      "delete"):      on_job_delete,
    ("tasks",     "created"):     on_task_created,
    ("tasks",     "completed"):   on_task_completed,
}


# --- Endpoint ---

@app.post("/webhook")
async def webhook(
    request: Request,
    background_tasks: BackgroundTasks,
    x_webhook_signature: Optional[str] = Header(None),
):
    body = await request.body()

    if WEBHOOK_SECRET:
        expected = hmac.new(WEBHOOK_SECRET.encode(), body, hashlib.sha256).hexdigest()
        if not hmac.compare_digest(expected, x_webhook_signature or ""):
            raise HTTPException(status_code=401, detail="Invalid signature")

    event = WebhookEvent.model_validate_json(body)
    key = (event.action, event.operation)
    handler = HANDLERS.get(key)

    if not handler:
        raise HTTPException(status_code=422, detail=f"Unhandled event: {event.action}/{event.operation}")

    import asyncio
    if asyncio.iscoroutinefunction(handler):
        background_tasks.add_task(handler, event)
    else:
        handler(event)

    return {"ok": True}
