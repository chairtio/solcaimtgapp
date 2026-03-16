-- Migration 013: Add media_url for share-to-story tasks (Telegram WebApp shareToStory)
ALTER TABLE task_definitions ADD COLUMN IF NOT EXISTS media_url TEXT;

-- Share story video from CSV (direct HTTPS URL for shareToStory)
UPDATE task_definitions SET media_url = 'https://x5du-7jat-dvga.n7d.xano.io/vault/QT9ovHk1/faRPnpc0vXRtmdDcU4RkCP8RasA/fiPrVw../Solclaim+story+TG+with+music.mp4'
WHERE id = 'share_story';
