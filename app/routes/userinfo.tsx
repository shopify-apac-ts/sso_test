// UserInfo Endpoint
import type { LoaderFunctionArgs } from "@remix-run/node";
import { json } from "@remix-run/node";
import { jwtVerify } from "jose";
import { getPublicKey } from "~/lib/keys.server";
import { getBaseUrl } from "~/lib/oidc.server";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Methods": "GET, POST, OPTIONS",
  "Access-Control-Allow-Headers": "Authorization, Content-Type",
};

export async function loader({ request }: LoaderFunctionArgs) {
  // CORS preflight
  if (request.method === "OPTIONS") {
    return new Response(null, { status: 204, headers: corsHeaders });
  }

  const authHeader = request.headers.get("Authorization") || "";
  if (!authHeader.startsWith("Bearer ")) {
    return json(
      { error: "invalid_token" },
      {
        status: 401,
        headers: {
          ...corsHeaders,
          "WWW-Authenticate": 'Bearer error="invalid_token"',
        },
      }
    );
  }

  const token = authHeader.slice(7);

  try {
    const publicKey = await getPublicKey();
    const baseUrl = getBaseUrl();

    const { payload } = await jwtVerify(token, publicKey, {
      issuer: baseUrl,
    });

    return json(
      {
        sub: payload.sub,
        email: (payload as Record<string, unknown>).email ?? `${payload.sub}@test.invalid`,
        email_verified: true,
      },
      { headers: corsHeaders }
    );
  } catch {
    return json(
      { error: "invalid_token" },
      {
        status: 401,
        headers: {
          ...corsHeaders,
          "WWW-Authenticate": 'Bearer error="invalid_token"',
        },
      }
    );
  }
}
