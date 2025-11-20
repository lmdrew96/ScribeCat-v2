-- Migration: Add server time function for game timer synchronization
-- Purpose: Provides authoritative server time to clients for fair multiplayer timing

-- Function to get current server time
-- Used by TimeSync service to calculate clock offset
CREATE OR REPLACE FUNCTION get_server_time()
RETURNS timestamptz
LANGUAGE sql
STABLE
AS $$
  SELECT now();
$$;

-- Grant execute permission to authenticated users
GRANT EXECUTE ON FUNCTION get_server_time() TO authenticated;

COMMENT ON FUNCTION get_server_time() IS 'Returns current server timestamp for client clock synchronization in multiplayer games';
