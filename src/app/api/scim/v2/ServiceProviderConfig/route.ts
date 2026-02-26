import { NextResponse } from "next/server";
import { scimHeaders } from "@/lib/scim";

/**
 * GET /api/scim/v2/ServiceProviderConfig
 * SCIM 2.0 Service Provider Configuration (RFC 7643 Section 5)
 */
export async function GET() {
  return NextResponse.json(
    {
      schemas: ["urn:ietf:params:scim:schemas:core:2.0:ServiceProviderConfig"],
      documentationUri: null,
      patch: { supported: true },
      bulk: { supported: false, maxOperations: 0, maxPayloadSize: 0 },
      filter: { supported: true, maxResults: 100 },
      changePassword: { supported: false },
      sort: { supported: false },
      etag: { supported: false },
      authenticationSchemes: [
        {
          type: "oauthbearertoken",
          name: "OAuth Bearer Token",
          description: "Authentication scheme using the OAuth Bearer Token Standard",
          specUri: "http://www.rfc-editor.org/info/rfc6750",
          primary: true,
        },
      ],
    },
    { headers: scimHeaders() },
  );
}

export const dynamic = "force-dynamic";
