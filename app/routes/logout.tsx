// End Session Endpoint (Logout)
// Handles logout requests from Shopify
import type { LoaderFunctionArgs } from "@remix-run/node";
import { redirect } from "@remix-run/node";

export async function loader({ request }: LoaderFunctionArgs) {
  const url = new URL(request.url);
  const postLogoutRedirectUri = url.searchParams.get("post_logout_redirect_uri");

  // Clear session here if needed (currently dummy only)

  if (postLogoutRedirectUri) {
    return redirect(postLogoutRedirectUri);
  }

  // Default: redirect to home
  return redirect("/");
}
