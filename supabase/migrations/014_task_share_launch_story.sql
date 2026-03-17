-- Migration 014: Add "Share $SOLCLAIM launch Story" task (CSV id 24)
INSERT INTO task_definitions (id, title, description, points, type, url, icon, button_text, verification_type, sort, media_url) VALUES
  ('share_launch_story', 'Share $SOLCLAIM launch Story', 'Share the SolClaim launch video to your story and earn points.', 100, 'basic', NULL, '📸', '📸 Share Story', 'manual', 12, 'https://x5du-7jat-dvga.n7d.xano.io/vault/QT9ovHk1/gbcLC4_Otuk74tkD4Wqy1BwCp1o/Q19Axw../SolClaim+Story+2.mp4')
ON CONFLICT (id) DO NOTHING;
