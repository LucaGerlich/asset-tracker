-- Scope workflow automation rules and custom field definitions to organizations.
--
-- Until now both tables were global: every organization saw, edited and ran every
-- other organization's rules and custom fields. Both gain a nullable
-- "organizationId" (FK, ON DELETE CASCADE) like the other org-scoped models.
--
-- Backfill (everything between the BACKFILL markers, run as one DO block):
--   * 0 organizations: nothing to assign, rows stay NULL.
--   * 1 organization:  every rule and definition belongs to it.
--   * several:
--       - automation rules take the organization of their creator (createdBy).
--         A rule whose creator has no organization stays NULL and is switched
--         off (isActive = false); the engine only runs rules of an organization.
--       - custom field definitions carry no creator, so they are attributed
--         through the entities that hold their values (asset, accessory,
--         consumable, licence, component, kit). A definition used by one
--         organization is assigned to it. A definition used by several
--         organizations stays with the oldest of them and is cloned for each
--         other organization, and that organization's values are repointed to
--         its own clone. Definitions without attributable values stay NULL and
--         are hidden by fail-closed scoping; nothing is lost because they have
--         no values.
--
-- Columns stay nullable so leftover NULL rows can never fail "migrate deploy".

ALTER TABLE "public"."automation_rules" ADD COLUMN "organizationId" UUID;
ALTER TABLE "public"."custom_field_definitions" ADD COLUMN "organizationId" UUID;

-- BACKFILL START
DO $$
DECLARE
	org_count INTEGER;
	sole_org UUID;
	rec RECORD;
	prev_field UUID := NULL;
	clone_id UUID;
	etype TEXT;
BEGIN
	SELECT count(*) INTO org_count FROM "public"."organizations";

	IF org_count = 0 THEN
		RAISE NOTICE 'No organizations: automation rules and custom field definitions stay unscoped';
		RETURN;
	END IF;

	-- Single organization: everything belongs to it.
	IF org_count = 1 THEN
		SELECT "id" INTO sole_org FROM "public"."organizations";
		UPDATE "public"."automation_rules" SET "organizationId" = sole_org WHERE "organizationId" IS NULL;
		UPDATE "public"."custom_field_definitions" SET "organizationId" = sole_org WHERE "organizationId" IS NULL;
		RETURN;
	END IF;

	-- Several organizations, automation rules: the creator's organization.
	UPDATE "public"."automation_rules" r
		SET "organizationId" = u."organizationId"
		FROM "public"."user" u
		WHERE u."userid" = r."createdBy"
			AND r."organizationId" IS NULL
			AND u."organizationId" IS NOT NULL;
	-- A creator without an organization leaves the rule unscoped: switch it off.
	UPDATE "public"."automation_rules" SET "isActive" = false WHERE "organizationId" IS NULL;

	-- Several organizations, custom field definitions: attribute through the
	-- entities that hold values.
	CREATE TEMP TABLE _cf_entities AS
		SELECT 'asset'::text AS entity_type, "assetid" AS entity_id, "organizationId" AS org_id FROM "public"."asset"
		UNION ALL SELECT 'accessory', "accessorieid", "organizationId" FROM "public"."accessories"
		UNION ALL SELECT 'consumable', "consumableid", "organizationId" FROM "public"."consumable"
		UNION ALL SELECT 'licence', "licenceid", "organizationId" FROM "public"."licence"
		UNION ALL SELECT 'component', "id", "organizationId" FROM "public"."components"
		UNION ALL SELECT 'kit', "id", "organizationId" FROM "public"."kits";
	CREATE INDEX ON _cf_entities (entity_type, entity_id);

	CREATE TEMP TABLE _cf_field_orgs AS
		SELECT DISTINCT v."fieldId" AS field_id, e.org_id
			FROM "public"."custom_field_values" v
			JOIN "public"."custom_field_definitions" d ON d."id" = v."fieldId"
			JOIN _cf_entities e ON e.entity_type = d."entityType" AND e.entity_id = v."entityId"
			WHERE d."organizationId" IS NULL AND e.org_id IS NOT NULL;

	-- The oldest organization using a definition keeps the original row; every
	-- other organization gets a clone and its values are repointed to it.
	FOR rec IN
		SELECT fo.field_id, fo.org_id
			FROM _cf_field_orgs fo
			JOIN "public"."organizations" o ON o."id" = fo.org_id
			ORDER BY fo.field_id, o."createdAt", fo.org_id
	LOOP
		IF rec.field_id IS DISTINCT FROM prev_field THEN
			UPDATE "public"."custom_field_definitions" SET "organizationId" = rec.org_id WHERE "id" = rec.field_id;
			prev_field := rec.field_id;
		ELSE
			clone_id := gen_random_uuid();
			SELECT "entityType" INTO etype FROM "public"."custom_field_definitions" WHERE "id" = rec.field_id;
			INSERT INTO "public"."custom_field_definitions"
				("id", "name", "fieldType", "options", "isRequired", "entityType", "displayOrder", "isActive", "createdAt", "updatedAt", "organizationId")
			SELECT clone_id, d."name", d."fieldType", d."options", d."isRequired", d."entityType",
					d."displayOrder", d."isActive", d."createdAt", CURRENT_TIMESTAMP, rec.org_id
				FROM "public"."custom_field_definitions" d
				WHERE d."id" = rec.field_id;
			UPDATE "public"."custom_field_values" v
				SET "fieldId" = clone_id
				FROM _cf_entities e
				WHERE v."fieldId" = rec.field_id
					AND e.entity_type = etype
					AND e.entity_id = v."entityId"
					AND e.org_id = rec.org_id;
		END IF;
	END LOOP;

	RAISE NOTICE 'Custom field definitions left unscoped: %',
		(SELECT count(*) FROM "public"."custom_field_definitions" WHERE "organizationId" IS NULL);

	DROP TABLE pg_temp._cf_field_orgs;
	DROP TABLE pg_temp._cf_entities;
END $$;
-- BACKFILL END

ALTER TABLE "public"."automation_rules" ADD CONSTRAINT "automation_rules_organizationId_fkey" FOREIGN KEY ("organizationId") REFERENCES "public"."organizations"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "public"."custom_field_definitions" ADD CONSTRAINT "custom_field_definitions_organizationId_fkey" FOREIGN KEY ("organizationId") REFERENCES "public"."organizations"("id") ON DELETE CASCADE ON UPDATE CASCADE;

CREATE INDEX "automation_rules_organizationId_idx" ON "public"."automation_rules"("organizationId");
CREATE INDEX "custom_field_definitions_organizationId_idx" ON "public"."custom_field_definitions"("organizationId");
