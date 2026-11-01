-- Removes only the additive parent API/notification objects. Does not touch rows, images, or existing teacher triggers.
BEGIN;
DROP TRIGGER IF EXISTS noor_parent_version ON public.app_state;
DROP FUNCTION IF EXISTS noor_internal.notify_parent_version();
DROP FUNCTION IF EXISTS public.noor_parent_action(text,text,jsonb);
DROP FUNCTION IF EXISTS public.noor_parent_read(text,text,jsonb);
DROP FUNCTION IF EXISTS public.noor_parent_latest(jsonb,jsonb,date);
COMMIT;
