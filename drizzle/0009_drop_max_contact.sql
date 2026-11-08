-- MAX не используется (решение владельца 2026-11-07): убираем ссылку из контактов зала
-- и способ входа, если он успел появиться.
UPDATE "gyms" SET "settings" = "settings" #- '{contacts,maxUrl}' WHERE "settings" -> 'contacts' ? 'maxUrl';
--> statement-breakpoint
DELETE FROM "auth_accounts" WHERE "provider" = 'max';
