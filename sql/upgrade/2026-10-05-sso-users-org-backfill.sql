-- One-off: assign Microsoft sign-in users created without an organization.
-- Replace the UUID with the value of SSO_DEFAULT_ORGANIZATION_ID, review the
-- SELECT output, then run the UPDATE inside the same transaction.
BEGIN;

SELECT u.userid, u.email, u.creation_date
FROM "user" u
WHERE u."organizationId" IS NULL
  AND EXISTS (SELECT 1 FROM accounts a WHERE a."userId" = u.userid AND a."providerId" = 'microsoft');

UPDATE "user" u
SET "organizationId" = '00000000-0000-0000-0000-000000000000', "authProvider" = 'microsoft'
WHERE u."organizationId" IS NULL
  AND EXISTS (SELECT 1 FROM accounts a WHERE a."userId" = u.userid AND a."providerId" = 'microsoft');

COMMIT;
