"""Reverse proxy: forwards all traffic on :8001 to the Next.js server on :3000.

The Kubernetes ingress sends every `/api/*` request to port 8001, but the ApexCare
EHR (Next.js) serves its own `/api` routes on port 3000. This thin proxy bridges the
two so the single Next.js app handles both pages and API routes.
"""
import httpx
from fastapi import FastAPI, Request
from starlette.responses import Response

TARGET = "http://127.0.0.1:3000"

# Hop-by-hop / length headers we must not copy verbatim.
STRIP_REQUEST = {"host", "content-length", "connection", "keep-alive", "transfer-encoding"}
STRIP_RESPONSE = {
    "content-length",
    "content-encoding",
    "transfer-encoding",
    "connection",
    "keep-alive",
}

app = FastAPI()
client = httpx.AsyncClient(timeout=httpx.Timeout(120.0), follow_redirects=False)


@app.on_event("shutdown")
async def _shutdown():
    await client.aclose()


# Fast, dependency-free health checks so the platform readiness probe can pass
# immediately even while the Next.js server is still booting.
@app.get("/health")
@app.get("/api/health")
async def health():
    return {"status": "ok"}


@app.api_route(
    "/{path:path}",
    methods=["GET", "POST", "PUT", "PATCH", "DELETE", "OPTIONS", "HEAD"],
)
async def proxy(path: str, request: Request):
    url = f"{TARGET}/{path}"
    body = await request.body()
    headers = {k: v for k, v in request.headers.items() if k.lower() not in STRIP_REQUEST}

    try:
        upstream = await client.request(
            request.method,
            url,
            params=request.query_params,
            content=body,
            headers=headers,
        )
    except httpx.ConnectError:
        # Next.js not up yet — report a retryable status instead of crashing.
        return Response(content=b"upstream starting", status_code=503)

    response = Response(content=upstream.content, status_code=upstream.status_code)
    for key, value in upstream.headers.items():
        lk = key.lower()
        if lk in STRIP_RESPONSE or lk == "set-cookie":
            continue
        response.headers[key] = value
    for cookie in upstream.headers.get_list("set-cookie"):
        response.headers.append("set-cookie", cookie)
    return response
