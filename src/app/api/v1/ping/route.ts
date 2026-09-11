import { corsPreflight, handleApi, apiJson } from "@/lib/api/keys";

export async function OPTIONS() {
  return corsPreflight();
}

// GET /api/v1/ping — verify credentials & inspect the authenticated app.
export async function GET(req: Request) {
  return handleApi(req, null, async (client) => {
    return apiJson({
      ok: true,
      app: client.name,
      keyId: client.keyId,
      scopes: client.scopes,
      time: new Date().toISOString(),
    });
  });
}
