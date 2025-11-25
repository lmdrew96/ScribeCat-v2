-- Run this query in Supabase SQL Editor to check realtime configuration

-- 1. Check if room_invitations table has REPLICA IDENTITY FULL
SELECT
    c.relname AS table_name,
    CASE c.relreplident
        WHEN 'd' THEN 'default'
        WHEN 'n' THEN 'nothing'
        WHEN 'f' THEN 'full'
        WHEN 'i' THEN 'index'
    END AS replica_identity
FROM pg_class c
WHERE c.relname = 'room_invitations'
  AND c.relkind = 'r';

-- 2. Check if room_invitations is in the supabase_realtime publication
SELECT
    schemaname,
    tablename
FROM pg_publication_tables
WHERE pubname = 'supabase_realtime'
  AND tablename = 'room_invitations';

-- 3. Check all tables in the realtime publication
SELECT
    schemaname,
    tablename
FROM pg_publication_tables
WHERE pubname = 'supabase_realtime'
ORDER BY schemaname, tablename;

-- 4. List all publications (should include supabase_realtime)
SELECT pubname FROM pg_publication;

-- 5. Check if the publication exists and is enabled
SELECT
    p.pubname,
    p.puballtables,
    p.pubinsert,
    p.pubupdate,
    p.pubdelete
FROM pg_publication p
WHERE p.pubname = 'supabase_realtime';

-- If room_invitations is NOT in the realtime publication, run this to add it:
-- ALTER PUBLICATION supabase_realtime ADD TABLE public.room_invitations;

-- If REPLICA IDENTITY is not FULL, run this to set it:
-- ALTER TABLE public.room_invitations REPLICA IDENTITY FULL;