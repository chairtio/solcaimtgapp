-- Migration 015: Remove Join @SolClaimTrending Channel task
DELETE FROM task_definitions WHERE id = 'join_trending';
