ALTER TABLE public.adherence_tracking
ADD COLUMN IF NOT EXISTS days_taken smallint;

ALTER TABLE public.adherence_tracking
ADD CONSTRAINT adherence_tracking_days_taken_range
CHECK (days_taken IS NULL OR days_taken BETWEEN 0 AND 7);
