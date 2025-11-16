/**
 * Supabase Edge Function: Send Welcome Email
 *
 * This function is triggered via a database webhook when a new user signs up.
 * It sends a personalized welcome email using the Resend API.
 *
 * Environment Variables Required:
 * - RESEND_API_KEY: Your Resend API key
 * - SENDER_EMAIL: The verified sender email (e.g., "ScribeCat <hello@scribecat.app>")
 */

import { serve } from 'https://deno.land/std@0.168.0/http/server.ts';
import { generateWelcomeEmail, generateWelcomeEmailText } from './welcome-email-template.ts';

// Resend API endpoint
const RESEND_API_URL = 'https://api.resend.com/emails';

interface WebhookPayload {
  type: 'INSERT' | 'UPDATE' | 'DELETE';
  table: string;
  record: {
    id: string;
    email: string;
    raw_user_meta_data?: {
      full_name?: string;
    };
  };
  schema: string;
  old_record: null | Record<string, unknown>;
}

interface ResendEmailRequest {
  from: string;
  to: string[];
  subject: string;
  html: string;
  text: string;
}

interface ResendEmailResponse {
  id: string;
}

interface ResendErrorResponse {
  statusCode: number;
  message: string;
  name: string;
}

/**
 * Sends an email via the Resend API
 */
async function sendEmail(
  apiKey: string,
  emailData: ResendEmailRequest
): Promise<{ success: boolean; error?: string; emailId?: string }> {
  try {
    const response = await fetch(RESEND_API_URL, {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${apiKey}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify(emailData),
    });

    if (!response.ok) {
      const errorData: ResendErrorResponse = await response.json();
      console.error('Resend API error:', errorData);
      return {
        success: false,
        error: `Resend API error: ${errorData.message || response.statusText}`,
      };
    }

    const data: ResendEmailResponse = await response.json();
    console.log('Email sent successfully:', data.id);

    return {
      success: true,
      emailId: data.id,
    };
  } catch (error) {
    console.error('Error sending email:', error);
    return {
      success: false,
      error: error instanceof Error ? error.message : 'Unknown error',
    };
  }
}

/**
 * Main function handler
 */
serve(async (req) => {
  try {
    // Get environment variables
    const resendApiKey = Deno.env.get('RESEND_API_KEY');
    const senderEmail = Deno.env.get('SENDER_EMAIL') || 'ScribeCat <onboarding@resend.dev>';

    // Validate environment variables
    if (!resendApiKey) {
      console.error('RESEND_API_KEY environment variable is not set');
      return new Response(
        JSON.stringify({
          success: false,
          error: 'Server configuration error: Missing API key',
        }),
        {
          status: 500,
          headers: { 'Content-Type': 'application/json' },
        }
      );
    }

    // Parse the webhook payload
    const payload: WebhookPayload = await req.json();

    console.log('Received webhook:', {
      type: payload.type,
      table: payload.table,
      userId: payload.record?.id,
    });

    // Only process INSERT events (new user signups)
    if (payload.type !== 'INSERT') {
      console.log('Ignoring non-INSERT event');
      return new Response(
        JSON.stringify({ success: true, message: 'Event ignored (not an INSERT)' }),
        {
          status: 200,
          headers: { 'Content-Type': 'application/json' },
        }
      );
    }

    // Extract user information
    const { email, raw_user_meta_data } = payload.record;
    const fullName = raw_user_meta_data?.full_name;

    if (!email) {
      console.error('No email found in webhook payload');
      return new Response(
        JSON.stringify({
          success: false,
          error: 'No email found in user record',
        }),
        {
          status: 400,
          headers: { 'Content-Type': 'application/json' },
        }
      );
    }

    console.log('Sending welcome email to:', email, fullName ? `(${fullName})` : '');

    // Generate email content
    const htmlContent = generateWelcomeEmail({ email, fullName });
    const textContent = generateWelcomeEmailText({ email, fullName });

    // Prepare email data
    const emailData: ResendEmailRequest = {
      from: senderEmail,
      to: [email],
      subject: 'Welcome to ScribeCat! 🎉',
      html: htmlContent,
      text: textContent,
    };

    // Send the email
    const result = await sendEmail(resendApiKey, emailData);

    if (result.success) {
      return new Response(
        JSON.stringify({
          success: true,
          emailId: result.emailId,
          message: 'Welcome email sent successfully',
        }),
        {
          status: 200,
          headers: { 'Content-Type': 'application/json' },
        }
      );
    } else {
      return new Response(
        JSON.stringify({
          success: false,
          error: result.error,
        }),
        {
          status: 500,
          headers: { 'Content-Type': 'application/json' },
        }
      );
    }
  } catch (error) {
    console.error('Unexpected error in Edge Function:', error);
    return new Response(
      JSON.stringify({
        success: false,
        error: error instanceof Error ? error.message : 'Unexpected error',
      }),
      {
        status: 500,
        headers: { 'Content-Type': 'application/json' },
      }
    );
  }
});
