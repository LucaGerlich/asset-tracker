import { NextResponse } from "next/server";
import { scimHeaders } from "@/lib/scim";

/**
 * GET /api/scim/v2/Schemas
 * SCIM 2.0 Schema Discovery (RFC 7643 Section 7)
 */
export async function GET() {
  return NextResponse.json(
    {
      schemas: ["urn:ietf:params:scim:api:messages:2.0:ListResponse"],
      totalResults: 1,
      itemsPerPage: 1,
      startIndex: 1,
      Resources: [
        {
          id: "urn:ietf:params:scim:schemas:core:2.0:User",
          name: "User",
          description: "User Account",
          attributes: [
            {
              name: "userName",
              type: "string",
              multiValued: false,
              required: true,
              caseExact: false,
              mutability: "readWrite",
              returned: "default",
              uniqueness: "server",
            },
            {
              name: "name",
              type: "complex",
              multiValued: false,
              required: false,
              mutability: "readWrite",
              returned: "default",
              subAttributes: [
                {
                  name: "givenName",
                  type: "string",
                  multiValued: false,
                  required: false,
                  mutability: "readWrite",
                  returned: "default",
                },
                {
                  name: "familyName",
                  type: "string",
                  multiValued: false,
                  required: false,
                  mutability: "readWrite",
                  returned: "default",
                },
              ],
            },
            {
              name: "emails",
              type: "complex",
              multiValued: true,
              required: false,
              mutability: "readWrite",
              returned: "default",
              subAttributes: [
                {
                  name: "value",
                  type: "string",
                  multiValued: false,
                  required: false,
                  mutability: "readWrite",
                  returned: "default",
                },
                {
                  name: "type",
                  type: "string",
                  multiValued: false,
                  required: false,
                  mutability: "readWrite",
                  returned: "default",
                },
                {
                  name: "primary",
                  type: "boolean",
                  multiValued: false,
                  required: false,
                  mutability: "readWrite",
                  returned: "default",
                },
              ],
            },
            {
              name: "active",
              type: "boolean",
              multiValued: false,
              required: false,
              mutability: "readWrite",
              returned: "default",
            },
            {
              name: "externalId",
              type: "string",
              multiValued: false,
              required: false,
              caseExact: true,
              mutability: "readWrite",
              returned: "default",
            },
          ],
          meta: {
            resourceType: "Schema",
            location: "/api/scim/v2/Schemas/urn:ietf:params:scim:schemas:core:2.0:User",
          },
        },
      ],
    },
    { headers: scimHeaders() },
  );
}

export const dynamic = "force-dynamic";
