"""
Microsoft Teams integratie via Microsoft Graph API.
Vereist Azure App Registration met Calendar.ReadWrite en OnlineMeetings.ReadWrite rechten.
"""
import httpx
from datetime import datetime
from app.core.config import settings


async def _get_access_token() -> str:
    """Haal een app-only access token op via client credentials flow."""
    url = f"https://login.microsoftonline.com/{settings.AZURE_TENANT_ID}/oauth2/v2.0/token"
    async with httpx.AsyncClient() as client:
        resp = await client.post(url, data={
            "grant_type": "client_credentials",
            "client_id": settings.AZURE_CLIENT_ID,
            "client_secret": settings.AZURE_CLIENT_SECRET,
            "scope": "https://graph.microsoft.com/.default",
        })
        resp.raise_for_status()
        return resp.json()["access_token"]


async def create_teams_meeting(
    subject: str,
    start_dt: datetime,
    end_dt: datetime,
    organizer_email: str,
    attendee_emails: list[str],
) -> dict:
    """
    Maak een Teams online vergadering aan en stuur uitnodigingen.
    Retourneert dict met 'join_url' en 'meeting_id'.
    """
    if not all([settings.AZURE_CLIENT_ID, settings.AZURE_CLIENT_SECRET, settings.AZURE_TENANT_ID]):
        raise ValueError("Azure credentials niet geconfigureerd in .env")

    token = await _get_access_token()
    headers = {"Authorization": f"Bearer {token}", "Content-Type": "application/json"}

    # Maak online meeting aan via Graph API
    meeting_payload = {
        "subject": subject,
        "startDateTime": start_dt.isoformat(),
        "endDateTime": end_dt.isoformat(),
        "participants": {
            "organizer": {
                "identity": {"user": {"id": organizer_email}},
                "upn": organizer_email,
            },
            "attendees": [
                {
                    "identity": {"user": {"id": email}},
                    "upn": email,
                    "role": "attendee",
                }
                for email in attendee_emails
            ],
        },
    }

    async with httpx.AsyncClient() as client:
        resp = await client.post(
            f"https://graph.microsoft.com/v1.0/users/{organizer_email}/onlineMeetings",
            json=meeting_payload,
            headers=headers,
        )
        resp.raise_for_status()
        data = resp.json()

    return {
        "join_url": data.get("joinWebUrl"),
        "meeting_id": data.get("id"),
    }


async def send_meeting_invitation(
    subject: str,
    body: str,
    start_dt: datetime,
    end_dt: datetime,
    organizer_email: str,
    attendee_emails: list[str],
    teams_url: str,
) -> bool:
    """Stuur een kalenderuitnodiging met Teams-link via Graph API."""
    if not all([settings.AZURE_CLIENT_ID, settings.AZURE_CLIENT_SECRET, settings.AZURE_TENANT_ID]):
        raise ValueError("Azure credentials niet geconfigureerd in .env")

    token = await _get_access_token()
    headers = {"Authorization": f"Bearer {token}", "Content-Type": "application/json"}

    event_payload = {
        "subject": subject,
        "body": {"contentType": "HTML", "content": f"{body}<br><br><a href='{teams_url}'>Deelnemen aan Teams-vergadering</a>"},
        "start": {"dateTime": start_dt.isoformat(), "timeZone": "Europe/Amsterdam"},
        "end": {"dateTime": end_dt.isoformat(), "timeZone": "Europe/Amsterdam"},
        "isOnlineMeeting": True,
        "onlineMeetingProvider": "teamsForBusiness",
        "attendees": [
            {"emailAddress": {"address": email}, "type": "required"}
            for email in attendee_emails
        ],
    }

    async with httpx.AsyncClient() as client:
        resp = await client.post(
            f"https://graph.microsoft.com/v1.0/users/{organizer_email}/events",
            json=event_payload,
            headers=headers,
        )
        resp.raise_for_status()
    return True
