-- Migration 022: Replace app.solclaim.io with t.me/solclaimxbot/app (Mini App URL)
UPDATE follow_up_messages SET
  buttons = jsonb_set(
    jsonb_set(buttons, '{0,url}', '"https://t.me/solclaimxbot/app"'),
    '{1,url}',
    COALESCE((buttons->1->>'url')::text, '""')
  )
WHERE buttons::text LIKE '%app.solclaim.io%';

-- Simpler: replace in buttons JSONB by updating each row that has the old URL
UPDATE follow_up_messages SET buttons = (
  SELECT jsonb_agg(
    jsonb_build_object('text', b->>'text', 'url',
      CASE WHEN b->>'url' = 'https://app.solclaim.io' THEN 'https://t.me/solclaimxbot/app'
           ELSE b->>'url' END
    )
  )
  FROM jsonb_array_elements(buttons) AS b
)
WHERE buttons::text LIKE '%app.solclaim.io%';
