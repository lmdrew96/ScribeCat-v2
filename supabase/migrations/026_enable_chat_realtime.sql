/**
 * Enable real-time updates for chat_messages table
 *
 * ROOT CAUSE: chat_messages table was never added to the supabase_realtime publication.
 * Without this, Supabase Realtime won't send postgres_changes events for the table,
 * even though the application code correctly subscribes to these events.
 *
 * RESULT: Users had to exit and re-enter rooms to see new messages.
 *
 * SOLUTION: Add chat_messages to the supabase_realtime publication.
 */

ALTER PUBLICATION supabase_realtime ADD TABLE public.chat_messages;
