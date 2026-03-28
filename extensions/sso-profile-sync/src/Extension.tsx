// Customer Account UI Extension — SSO Profile Sync
// Renders a toggle on the Profile page that controls whether profile data
// is synced from the SSO server on each visit.
//
// When enabled, performs two-phase sync:
//   Phase A (storage empty): Fetch SSO data, push to Customer Account API, store data, navigate.
//   Phase B (storage present): Query current customer data, compare with stored SSO data,
//                              revert any changes by re-applying SSO data, then navigate.
//
// Navigation guard (sso_nav_guard) prevents an infinite loop after Phase A/B redirects.

import "@shopify/ui-extensions/preact";
import { render, type ComponentChildren, type RefObject } from "preact";
import { useEffect, useRef, useState } from "preact/hooks";

// Augment JSX types for Shopify UI Extension web components
declare module "preact" {
  namespace JSX {
    interface IntrinsicElements {
      "s-section": { heading?: string; children?: ComponentChildren };
      "s-stack": { direction?: string; gap?: string; children?: ComponentChildren };
      "s-text": { children?: ComponentChildren };
      "s-switch": {
        label?: string;
        name?: string;
        checked?: boolean;
        ref?: RefObject<HTMLElement>;
      };
    }
  }
}

// Declare the global shopify object provided by the extension runtime
declare const shopify: {
  sessionToken: { get(): Promise<string> };
  storage: {
    read<T = unknown>(key: string): Promise<T | null>;
    write(key: string, data: unknown): Promise<void>;
    delete(key: string): Promise<void>;
  };
  navigation: { navigate(url: string): void };
};

const STORAGE_KEY = "sso_profile_data";
const NAV_GUARD_KEY = "sso_nav_guard";
const SYNC_ENABLED_KEY = "sso_sync_enabled";

const CUSTOMER_API_URL =
  "shopify://customer-account/api/2026-01/graphql.json";

// Replace with your deployed SSO server URL and redeploy the extension.
const SSO_BASE_URL = "https://sso-test-zjts.onrender.com";

// -- Types --

interface OidcAddress {
  street_address: string;
  locality: string;
  region: string;
  postal_code: string;
  country: string;
}

interface SsoProfile {
  sub: string;
  given_name: string;
  family_name: string;
  address: OidcAddress;
}

interface CustomerAddress {
  id: string;
  address1: string | null;
  address2: string | null;
  city: string | null;
  zoneCode: string | null;
  zip: string | null;
  territoryCode: string | null;
}

interface CustomerData {
  id: string;
  firstName: string | null;
  lastName: string | null;
  defaultAddress: CustomerAddress | null;
}

// -- Customer Account API helpers (global fetch is authenticated automatically) --

async function queryCustomer(): Promise<CustomerData | null> {
  const res = await fetch(CUSTOMER_API_URL, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      query: `query GetCustomer {
        customer {
          id firstName lastName
          defaultAddress { id address1 address2 city zoneCode zip territoryCode }
        }
      }`,
    }),
  });
  const json = await res.json();
  return json?.data?.customer ?? null;
}

async function updateCustomerName(
  firstName: string,
  lastName: string
): Promise<void> {
  await fetch(CUSTOMER_API_URL, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      query: `mutation CustomerUpdate($input: CustomerUpdateInput!) {
        customerUpdate(input: $input) {
          customer { id firstName lastName }
          userErrors { field message }
        }
      }`,
      variables: { input: { firstName, lastName } },
    }),
  });
}

async function upsertAddress(
  addressId: string | null,
  addr: OidcAddress
): Promise<void> {
  const lines = addr.street_address.split("\n");
  const address1 = lines[0] ?? "";
  const address2 = lines[1] ?? "";

  const addressInput = {
    address1,
    address2,
    city: addr.locality,
    zoneCode: addr.region,
    zip: addr.postal_code,
    territoryCode: addr.country,
  };

  if (addressId) {
    await fetch(CUSTOMER_API_URL, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        query: `mutation CustomerAddressUpdate($addressId: ID!, $address: CustomerAddressInput, $defaultAddress: Boolean) {
          customerAddressUpdate(addressId: $addressId, address: $address, defaultAddress: $defaultAddress) {
            customerAddress { id }
            userErrors { field message }
          }
        }`,
        variables: { addressId, address: addressInput, defaultAddress: true },
      }),
    });
  } else {
    await fetch(CUSTOMER_API_URL, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        query: `mutation CustomerAddressCreate($address: CustomerAddressInput!, $defaultAddress: Boolean) {
          customerAddressCreate(address: $address, defaultAddress: $defaultAddress) {
            customerAddress { id }
            userErrors { field message }
          }
        }`,
        variables: { address: addressInput, defaultAddress: true },
      }),
    });
  }
}

// -- Diff helper --

function profileMatchesCustomer(
  profile: SsoProfile,
  customer: CustomerData
): boolean {
  if (customer.firstName !== profile.given_name) return false;
  if (customer.lastName !== profile.family_name) return false;

  const addr = customer.defaultAddress;
  if (!addr) return false;

  const lines = profile.address.street_address.split("\n");
  const address1 = lines[0] ?? "";
  const address2 = lines[1] ?? "";

  return (
    addr.address1 === address1 &&
    addr.address2 === address2 &&
    addr.city === profile.address.locality &&
    addr.zoneCode === profile.address.region &&
    addr.zip === profile.address.postal_code &&
    addr.territoryCode === profile.address.country
  );
}

// -- Sync logic (extracted so it can be skipped when toggle is off) --

async function runSync(): Promise<void> {
  try {
    // Check nav guard — cleared once after each sync-triggered navigation
    const guard = await shopify.storage.read(NAV_GUARD_KEY);
    if (guard) {
      await shopify.storage.delete(NAV_GUARD_KEY);
      return; // Skip this cycle; was triggered by our own navigation
    }

    const stored = await shopify.storage.read<SsoProfile>(STORAGE_KEY);

    if (!stored) {
      // ── Phase A: Initial sync ─────────────────────────────────────────
      const token = await shopify.sessionToken.get();

      const res = await fetch(`${SSO_BASE_URL}/userinfo`, {
        headers: { Authorization: `Bearer ${token}` },
      });
      if (!res.ok) {
        console.error("[sso-sync] userinfo fetch failed:", res.status);
        return;
      }
      const profile: SsoProfile = await res.json();

      const customer = await queryCustomer();
      if (!customer) {
        console.error("[sso-sync] failed to query customer");
        return;
      }

      await updateCustomerName(profile.given_name, profile.family_name);
      await upsertAddress(customer.defaultAddress?.id ?? null, profile.address);

      await shopify.storage.write(STORAGE_KEY, profile);
      await shopify.storage.write(NAV_GUARD_KEY, "1");
      shopify.navigation.navigate("shopify:customer-account/profile");
    } else {
      // ── Phase B: Change guard ─────────────────────────────────────────
      const customer = await queryCustomer();
      if (!customer) {
        console.error("[sso-sync] failed to query customer");
        return;
      }

      if (!profileMatchesCustomer(stored, customer)) {
        console.log("[sso-sync] drift detected — reverting to SSO data");
        await updateCustomerName(stored.given_name, stored.family_name);
        await upsertAddress(
          customer.defaultAddress?.id ?? null,
          stored.address
        );
        await shopify.storage.write(NAV_GUARD_KEY, "1");
        shopify.navigation.navigate("shopify:customer-account/profile");
      }
    }
  } catch (err) {
    console.error("[sso-sync] unexpected error:", err);
  }
}

// -- Extension component --

function SsoProfileSync() {
  const [enabled, setEnabled] = useState(true);
  const switchEl = useRef<HTMLElement>(null);

  // Load toggle state from storage and run sync if enabled
  useEffect(() => {
    void (async () => {
      const stored = await shopify.storage.read<boolean>(SYNC_ENABLED_KEY);
      const isEnabled = stored ?? true;
      setEnabled(isEnabled);
      if (isEnabled) await runSync();
    })();
  }, []);

  // Attach change handler to the s-switch web component
  useEffect(() => {
    const el = switchEl.current;
    if (!el) return;

    const handler = async (e: Event) => {
      const val = (e.target as EventTarget & { checked?: boolean }).checked ?? false;
      setEnabled(val);
      await shopify.storage.write(SYNC_ENABLED_KEY, val);
      // Clear cached profile so the next enabled visit re-fetches fresh SSO data
      if (!val) await shopify.storage.delete(STORAGE_KEY);
    };

    el.addEventListener("change", handler);
    return () => el.removeEventListener("change", handler);
  }, []);

  return (
    <s-section heading="SSO Profile Sync">
      <s-stack direction="block" gap="base">
        <s-text>
          When enabled, your profile data (name and address) is automatically
          synced from SSO on each visit.
        </s-text>
        <s-switch
          // eslint-disable-next-line @typescript-eslint/no-explicit-any
          ref={switchEl as any}
          label="Sync profile data from SSO on profile visit"
          name="sso_sync_enabled"
          checked={enabled}
        />
      </s-stack>
    </s-section>
  );
}

export default async () => {
  render(<SsoProfileSync />, document.body);
};
