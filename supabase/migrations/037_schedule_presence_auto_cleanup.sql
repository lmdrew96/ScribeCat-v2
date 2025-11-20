-- Migration: Schedule automatic presence cleanup
-- Description: Sets up a cron job to automatically set inactive users offline
-- This acts as a safety net for app crashes, network failures, or force quits
-- where the app cannot send a final presence update

-- Enable pg_cron extension if not already enabled
CREATE EXTENSION IF NOT EXISTS pg_cron;

-- Schedule auto_set_offline() to run every minute
-- This catches users who haven't updated their presence in 2+ minutes
SELECT cron.schedule(
  'auto-set-offline',           -- job name
  '* * * * *',                  -- every minute (cron expression)
  $$ SELECT auto_set_offline(); $$
);

-- NOTE: To manually unschedule this job (for debugging), run:
-- SELECT cron.unschedule('auto-set-offline');

-- To view all cron jobs:
-- SELECT * FROM cron.job;
