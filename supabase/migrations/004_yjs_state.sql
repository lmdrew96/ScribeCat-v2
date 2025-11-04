-- Migration 004: Yjs State Storage for Real-Time Collaboration
--
-- This migration creates the infrastructure for storing Yjs CRDT state.
-- Yjs state is persisted to enable document recovery and new client synchronization.

-- Create yjs_state table
CREATE TABLE IF NOT EXISTS yjs_state (
  session_id UUID PRIMARY KEY REFERENCES sessions(id) ON DELETE CASCADE,
  state_vector BYTEA NOT NULL,
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- Create index for faster lookups
CREATE INDEX IF NOT EXISTS idx_yjs_state_updated_at ON yjs_state(updated_at);

-- Enable Row Level Security
ALTER TABLE yjs_state ENABLE ROW LEVEL SECURITY;

-- Policy: Users can read/write Yjs state for sessions they own
CREATE POLICY "Users can manage Yjs state for owned sessions"
  ON yjs_state
  FOR ALL
  USING (
    session_id IN (
      SELECT id FROM sessions WHERE user_id = auth.uid()
    )
  );

-- Policy: Users can read/write Yjs state for sessions shared with them (editor permission)
CREATE POLICY "Users can manage Yjs state for shared sessions"
  ON yjs_state
  FOR ALL
  USING (
    session_id IN (
      SELECT session_id
      FROM session_shares
      WHERE shared_with_user_id = auth.uid()
        AND permission_level = 'editor'
    )
  );

-- Policy: Users can read Yjs state for sessions shared with them (viewer permission)
CREATE POLICY "Users can read Yjs state for viewed sessions"
  ON yjs_state
  FOR SELECT
  USING (
    session_id IN (
      SELECT session_id
      FROM session_shares
      WHERE shared_with_user_id = auth.uid()
        AND permission_level = 'viewer'
    )
  );

-- Function to automatically update updated_at timestamp
CREATE OR REPLACE FUNCTION update_yjs_state_updated_at()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = NOW();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- Trigger to update updated_at on every update
CREATE TRIGGER yjs_state_updated_at
  BEFORE UPDATE ON yjs_state
  FOR EACH ROW
  EXECUTE FUNCTION update_yjs_state_updated_at();

-- Add comment for documentation
COMMENT ON TABLE yjs_state IS 'Stores Yjs CRDT state vectors for collaborative editing. Each session has one state vector that represents the entire document history.';
COMMENT ON COLUMN yjs_state.session_id IS 'Foreign key to sessions table - one state per session';
COMMENT ON COLUMN yjs_state.state_vector IS 'Serialized Yjs state as binary data (Uint8Array encoded)';
COMMENT ON COLUMN yjs_state.updated_at IS 'Timestamp of last update - used for conflict resolution';
