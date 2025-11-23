-- Fix submit_jeopardy_answer to clear selected_question_id and return to board after answer submission

CREATE OR REPLACE FUNCTION public.submit_jeopardy_answer(
    p_game_session_id UUID,
    p_question_id UUID,
    p_user_id UUID,
    p_answer TEXT,
    p_is_correct BOOLEAN,
    p_buzzer_rank INTEGER,
    p_wager_amount INTEGER DEFAULT NULL,
    p_time_taken_ms INTEGER DEFAULT NULL
)
RETURNS INTEGER AS $$
DECLARE
    v_points_earned INTEGER;
    v_question_points INTEGER;
    v_attempt_number INTEGER;
BEGIN
    -- Get question points
    SELECT points INTO v_question_points
    FROM public.game_questions
    WHERE id = p_question_id;

    -- Calculate points earned
    IF p_wager_amount IS NOT NULL THEN
        -- Daily Double or Final Jeopardy: use wager
        v_points_earned := CASE WHEN p_is_correct THEN p_wager_amount ELSE -p_wager_amount END;
    ELSE
        -- Regular question: use question points
        v_points_earned := CASE WHEN p_is_correct THEN v_question_points ELSE -v_question_points END;
    END IF;

    -- Get next attempt number for this user/question
    SELECT COALESCE(MAX(attempt_number), 0) + 1 INTO v_attempt_number
    FROM public.player_scores
    WHERE game_session_id = p_game_session_id
    AND user_id = p_user_id
    AND question_id = p_question_id;

    -- Insert score
    INSERT INTO public.player_scores (
        game_session_id,
        user_id,
        question_id,
        answer,
        is_correct,
        points_earned,
        buzzer_rank,
        wager_amount,
        time_taken_ms,
        attempt_number
    ) VALUES (
        p_game_session_id,
        p_user_id,
        p_question_id,
        p_answer,
        p_is_correct,
        v_points_earned,
        p_buzzer_rank,
        p_wager_amount,
        p_time_taken_ms,
        v_attempt_number
    );

    -- After answer submission:
    -- 1. Clear selected_question_id (return to board)
    -- 2. Update current_player_id
    --    - If correct and first buzzer: they select next
    --    - If wrong or not first buzzer: lowest scorer selects next (handled by frontend for now)

    IF p_is_correct AND p_buzzer_rank = 1 THEN
        -- Correct answer by first buzzer: they select next question
        UPDATE public.game_sessions
        SET selected_question_id = NULL,
            current_player_id = p_user_id,
            updated_at = NOW()
        WHERE id = p_game_session_id;
    ELSE
        -- Wrong answer or not first buzzer: clear question, lowest scorer will select
        -- (Frontend handles setting current_player_id to lowest scorer)
        UPDATE public.game_sessions
        SET selected_question_id = NULL,
            updated_at = NOW()
        WHERE id = p_game_session_id;
    END IF;

    RETURN v_points_earned;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;
