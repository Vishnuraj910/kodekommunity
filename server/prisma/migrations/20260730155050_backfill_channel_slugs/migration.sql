UPDATE "Conversation"
SET "slug" = 'channel-' || lower(regexp_replace("id", '[^a-zA-Z0-9]+', '-', 'g'))
WHERE "slug" IS NULL
  AND "type" <> 'DIRECT';
