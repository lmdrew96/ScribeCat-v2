/**
 * Welcome Email HTML Template for ScribeCat
 *
 * Generates a personalized welcome email for new users
 */

interface WelcomeEmailParams {
  fullName?: string;
  email: string;
}

/**
 * Generates the HTML content for the welcome email
 */
export function generateWelcomeEmail(params: WelcomeEmailParams): string {
  const { fullName, email } = params;
  const displayName = fullName || email.split('@')[0];

  return `
<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>Welcome to ScribeCat!</title>
</head>
<body style="margin: 0; padding: 0; font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, Helvetica, Arial, sans-serif; background-color: #f5f5f5;">
  <table role="presentation" style="width: 100%; border-collapse: collapse;">
    <tr>
      <td align="center" style="padding: 40px 0;">
        <table role="presentation" style="width: 600px; border-collapse: collapse; background-color: #ffffff; border-radius: 8px; box-shadow: 0 2px 4px rgba(0,0,0,0.1);">

          <!-- Header -->
          <tr>
            <td style="padding: 40px 40px 20px 40px; text-align: center;">
              <h1 style="margin: 0; font-size: 32px; color: #1a1a1a; font-weight: 600;">
                Welcome to ScribeCat! 🎉
              </h1>
            </td>
          </tr>

          <!-- Greeting -->
          <tr>
            <td style="padding: 0 40px 20px 40px;">
              <p style="margin: 0; font-size: 18px; color: #333333; line-height: 1.6;">
                Hi ${displayName},
              </p>
            </td>
          </tr>

          <!-- Main Content -->
          <tr>
            <td style="padding: 0 40px 30px 40px;">
              <p style="margin: 0 0 16px 0; font-size: 16px; color: #555555; line-height: 1.6;">
                Thanks for signing up! ScribeCat is here to revolutionize how you capture, transcribe, and understand your recordings and notes.
              </p>
              <p style="margin: 0; font-size: 16px; color: #555555; line-height: 1.6;">
                Whether you're a student, professional, or researcher, ScribeCat helps you focus on what matters while we handle the transcription and note-taking.
              </p>
            </td>
          </tr>

          <!-- Getting Started Section -->
          <tr>
            <td style="padding: 0 40px 30px 40px;">
              <h2 style="margin: 0 0 16px 0; font-size: 20px; color: #1a1a1a; font-weight: 600;">
                Getting Started
              </h2>
              <ul style="margin: 0; padding-left: 20px; color: #555555; font-size: 16px; line-height: 1.8;">
                <li style="margin-bottom: 8px;">
                  <strong>Record audio:</strong> Start capturing lectures, meetings, or conversations with high-quality audio recording
                </li>
                <li style="margin-bottom: 8px;">
                  <strong>Auto-transcribe:</strong> Let AI transcribe your recordings with industry-leading accuracy
                </li>
                <li style="margin-bottom: 8px;">
                  <strong>Take rich notes:</strong> Use our powerful editor to create formatted notes, add images, and organize your thoughts
                </li>
                <li style="margin-bottom: 8px;">
                  <strong>AI assistance:</strong> Chat with AI to summarize, analyze, and extract insights from your content
                </li>
                <li>
                  <strong>Study mode:</strong> Create flashcards, track goals, and earn achievements to boost your learning
                </li>
              </ul>
            </td>
          </tr>

          <!-- Tips Section -->
          <tr>
            <td style="padding: 0 40px 30px 40px;">
              <div style="background-color: #f8f9fa; border-left: 4px solid #4f46e5; padding: 16px 20px; border-radius: 4px;">
                <p style="margin: 0 0 8px 0; font-size: 14px; color: #1a1a1a; font-weight: 600;">
                  💡 Pro Tip
                </p>
                <p style="margin: 0; font-size: 14px; color: #555555; line-height: 1.6;">
                  Use the AI chat feature in Study Mode to generate summaries and quiz questions from your transcriptions. It's a game-changer for exam prep!
                </p>
              </div>
            </td>
          </tr>

          <!-- Support Section -->
          <tr>
            <td style="padding: 0 40px 40px 40px;">
              <p style="margin: 0 0 16px 0; font-size: 16px; color: #555555; line-height: 1.6;">
                Have questions or need help getting started? We're here to help!
              </p>
              <p style="margin: 0; font-size: 16px; color: #555555; line-height: 1.6;">
                Happy scribing! 📝
              </p>
            </td>
          </tr>

          <!-- Footer -->
          <tr>
            <td style="padding: 30px 40px; background-color: #f8f9fa; border-top: 1px solid #e5e7eb; border-radius: 0 0 8px 8px;">
              <p style="margin: 0; font-size: 14px; color: #888888; text-align: center; line-height: 1.6;">
                You're receiving this email because you created a ScribeCat account.
              </p>
              <p style="margin: 8px 0 0 0; font-size: 14px; color: #888888; text-align: center; line-height: 1.6;">
                © ${new Date().getFullYear()} ScribeCat. All rights reserved.
              </p>
            </td>
          </tr>

        </table>
      </td>
    </tr>
  </table>
</body>
</html>
  `.trim();
}

/**
 * Generates the plain text version of the welcome email
 * (fallback for email clients that don't support HTML)
 */
export function generateWelcomeEmailText(params: WelcomeEmailParams): string {
  const { fullName, email } = params;
  const displayName = fullName || email.split('@')[0];

  return `
Welcome to ScribeCat!

Hi ${displayName},

Thanks for signing up! ScribeCat is here to revolutionize how you capture, transcribe, and understand your recordings and notes.

Whether you're a student, professional, or researcher, ScribeCat helps you focus on what matters while we handle the transcription and note-taking.

Getting Started:

• Record audio: Start capturing lectures, meetings, or conversations with high-quality audio recording
• Auto-transcribe: Let AI transcribe your recordings with industry-leading accuracy
• Take rich notes: Use our powerful editor to create formatted notes, add images, and organize your thoughts
• AI assistance: Chat with AI to summarize, analyze, and extract insights from your content
• Study mode: Create flashcards, track goals, and earn achievements to boost your learning

Pro Tip: Use the AI chat feature in Study Mode to generate summaries and quiz questions from your transcriptions. It's a game-changer for exam prep!

Have questions or need help getting started? We're here to help!

Happy scribing!

---
You're receiving this email because you created a ScribeCat account.
© ${new Date().getFullYear()} ScribeCat. All rights reserved.
  `.trim();
}
