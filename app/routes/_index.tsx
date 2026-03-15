import type { LoaderFunctionArgs, MetaFunction } from "@remix-run/node";
import { json } from "@remix-run/node";
import { useLoaderData } from "@remix-run/react";
import { getBaseUrl, getClientId } from "~/lib/oidc.server";

export const meta: MetaFunction = () => [
  { title: "SSO Sample Provider" },
];

export async function loader({ request }: LoaderFunctionArgs) {
  const baseUrl = getBaseUrl();
  const clientId = getClientId();
  return json({ baseUrl, clientId });
}

export default function Index() {
  const { baseUrl, clientId } = useLoaderData<typeof loader>();

  return (
    <div style={{ maxWidth: 720, margin: "40px auto", padding: 24, fontFamily: "system-ui, sans-serif" }}>
      <h1 style={{ borderBottom: "2px solid #5c6ac4", paddingBottom: 12 }}>
        🔐 Shopify SSO Sample Provider
      </h1>
      <p>
        This service is a sample OpenID Connect Identity Provider for testing
        Shopify&apos;s Customer Account SSO integration.
      </p>

      <h2>OIDC Endpoints</h2>
      <table style={{ width: "100%", borderCollapse: "collapse" }}>
        <thead>
          <tr style={{ background: "#f4f6f8" }}>
            <th style={thStyle}>Endpoint</th>
            <th style={thStyle}>URL</th>
          </tr>
        </thead>
        <tbody>
          {[
            ["Discovery", `${baseUrl}/.well-known/openid-configuration`],
            ["JWKS", `${baseUrl}/.well-known/jwks.json`],
            ["Authorization", `${baseUrl}/authorize`],
            ["Token", `${baseUrl}/token`],
            ["UserInfo", `${baseUrl}/userinfo`],
            ["End Session (Logout)", `${baseUrl}/logout`],
          ].map(([label, url]) => (
            <tr key={label}>
              <td style={tdStyle}>{label}</td>
              <td style={tdStyle}>
                <a href={url} style={{ color: "#5c6ac4" }}>{url}</a>
              </td>
            </tr>
          ))}
        </tbody>
      </table>

      <h2>Configuration</h2>
      <table style={{ width: "100%", borderCollapse: "collapse" }}>
        <tbody>
          <tr>
            <td style={tdStyle}><strong>Issuer URL</strong></td>
            <td style={tdStyle}><code>{baseUrl}</code></td>
          </tr>
          <tr>
            <td style={tdStyle}><strong>Client ID</strong></td>
            <td style={tdStyle}><code>{clientId}</code></td>
          </tr>
          <tr>
            <td style={tdStyle}><strong>Token Endpoint Auth Methods</strong></td>
            <td style={tdStyle}><code>client_secret_basic</code>, <code>client_secret_post</code></td>
          </tr>
          <tr>
            <td style={tdStyle}><strong>Signing Algorithm</strong></td>
            <td style={tdStyle}><code>RS256</code></td>
          </tr>
        </tbody>
      </table>

      <h2>Dummy Authentication</h2>
      <div style={{ background: "#fef3cd", padding: 16, borderRadius: 8, border: "1px solid #ffc107" }}>
        <p style={{ margin: 0 }}>
          <strong>⚠️ For testing only:</strong>{" "}
          Any email address and password will be accepted. No real authentication is performed.
        </p>
      </div>
    </div>
  );
}

const thStyle: React.CSSProperties = {
  padding: "10px 12px",
  textAlign: "left",
  border: "1px solid #ddd",
};

const tdStyle: React.CSSProperties = {
  padding: "10px 12px",
  border: "1px solid #ddd",
  verticalAlign: "top",
};
