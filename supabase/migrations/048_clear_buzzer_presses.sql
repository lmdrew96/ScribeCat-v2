-- Add function to clear buzzer presses for a question when rebuzz is triggered
-- This ensures new buzz-ins after a wrong answer get fresh rank=1 instead of rank=2+

CREATE OR REPLACE FUNCTION public.clear_buzzer_presses(
    p_question_id UUID
)
RETURNS VOID AS $$
BEGIN
    -- Delete all buzzer presses for this question
    -- This is called when a player answers incorrectly and rebuzz is enabled
    DELETE FROM public.buzzer_presses
    WHERE question_id = p_question_id;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Grant execute permission to authenticated users
GRANT EXECUTE ON FUNCTION public.clear_buzzer_presses(UUID) TO authenticated;
