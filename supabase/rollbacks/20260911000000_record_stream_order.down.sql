drop function if exists public.get_class_record_order(boolean);
-- Keep the stricter auxiliary RLS policies on rollback: reverting them could
-- disclose newly hidden annotations or content to ordinary sessions.
