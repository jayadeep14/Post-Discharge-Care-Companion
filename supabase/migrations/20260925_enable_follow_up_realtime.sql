-- Enable the backend's Postgres Changes listener for follow-up schedules.
DO $$
BEGIN
    IF NOT EXISTS (
        SELECT 1
        FROM pg_publication_tables
        WHERE pubname = 'supabase_realtime'
          AND schemaname = 'public'
          AND tablename = 'follow_up_schedule'
    ) THEN
        ALTER PUBLICATION supabase_realtime
            ADD TABLE public.follow_up_schedule;
    END IF;
END
$$;
