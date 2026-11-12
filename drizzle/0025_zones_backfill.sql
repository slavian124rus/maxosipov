INSERT INTO "machine_zones" ("gym_id", "name")
SELECT DISTINCT "gym_id", btrim("zone") FROM "machines"
WHERE "zone" IS NOT NULL AND btrim("zone") <> ''
ON CONFLICT ("gym_id", "name") DO NOTHING;
