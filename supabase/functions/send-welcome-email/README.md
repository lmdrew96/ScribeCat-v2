# Send Welcome Email - Supabase Edge Function

This Edge Function automatically sends a welcome email to new users when they sign up using the Resend email API.

## How It Works

1. User signs up via ScribeCat app
2. New row is inserted into `auth.users` table
3. Database webhook triggers this Edge Function
4. Function sends personalized welcome email via Resend
5. User receives welcome email with getting started tips

## Prerequisites

### 1. Resend Account Setup

1. Create an account at [resend.com](https://resend.com)
2. Get your API key from [Resend API Keys](https://resend.com/api-keys)
3. Verify your sending domain (or use `onboarding@resend.dev` for testing)

### 2. Supabase CLI

Install the Supabase CLI if you haven't already:

```bash
npm install -g supabase
```

## Deployment

### Step 1: Set Environment Variables

Set the required environment variables in your Supabase project:

```bash
# Set Resend API key
supabase secrets set RESEND_API_KEY=re_xxxxxxxxxxxxxxxxxxxxxxxxxxxxx

# Set sender email (optional, defaults to onboarding@resend.dev)
supabase secrets set SENDER_EMAIL="ScribeCat <hello@scribecat.app>"
```

**Important:** Use a verified domain in production. For testing, you can use `onboarding@resend.dev`.

### Step 2: Deploy the Edge Function

From the project root directory:

```bash
# Deploy the function
supabase functions deploy send-welcome-email

# Or deploy all functions
supabase functions deploy
```

### Step 3: Set Up Database Webhook

1. Go to your Supabase Dashboard
2. Navigate to **Database** > **Webhooks**
3. Click **Create a new webhook**
4. Configure:
   - **Name:** `send-welcome-email-webhook`
   - **Table:** `auth.users`
   - **Events:** Check only `INSERT`
   - **Type:** `HTTP Request`
   - **Method:** `POST`
   - **URL:** `https://<your-project-ref>.supabase.co/functions/v1/send-welcome-email`
   - **HTTP Headers:**
     ```
     Content-Type: application/json
     Authorization: Bearer <your-anon-key>
     ```
5. Click **Create webhook**

**Find your function URL:**
```bash
supabase functions list
```

**Find your anon key:**
- Supabase Dashboard > Project Settings > API > `anon` `public`

## Testing

### Test Locally

1. Start Supabase locally:
   ```bash
   supabase start
   ```

2. Serve the function locally:
   ```bash
   supabase functions serve send-welcome-email --env-file supabase/functions/send-welcome-email/.env
   ```

3. Create a `.env` file (copy from `.env.example`) with your actual credentials

4. Send a test request:
   ```bash
   curl -i --location --request POST 'http://localhost:54321/functions/v1/send-welcome-email' \
     --header 'Authorization: Bearer YOUR_ANON_KEY' \
     --header 'Content-Type: application/json' \
     --data '{
       "type": "INSERT",
       "table": "users",
       "record": {
         "id": "test-user-id",
         "email": "test@example.com",
         "raw_user_meta_data": {
           "full_name": "Test User"
         }
       },
       "schema": "auth"
     }'
   ```

### Test in Production

The easiest way to test is to create a new user account:

1. Sign up with a test email address
2. Check the email inbox
3. Verify the welcome email was received

Check the Edge Function logs:
```bash
supabase functions logs send-welcome-email
```

## Monitoring

### View Logs

```bash
# Stream live logs
supabase functions logs send-welcome-email --follow

# View recent logs
supabase functions logs send-welcome-email
```

### Check Webhook Status

In Supabase Dashboard:
- **Database** > **Webhooks** > Click on `send-welcome-email-webhook`
- View **Recent deliveries** to see success/failure status

## Troubleshooting

### Email Not Sending

1. **Check Edge Function logs:**
   ```bash
   supabase functions logs send-welcome-email
   ```

2. **Verify environment variables are set:**
   ```bash
   supabase secrets list
   ```

3. **Check webhook configuration:**
   - Ensure webhook URL is correct
   - Verify Authorization header is set
   - Check webhook is enabled for INSERT events only

4. **Verify Resend API key:**
   - Test the API key manually with a curl request
   - Check if the sender email is verified

### Common Errors

- **"Server configuration error: Missing API key"**
  - Solution: Set `RESEND_API_KEY` environment variable

- **"Resend API error: Validation error"**
  - Solution: Verify your sender email domain in Resend dashboard

- **Webhook not triggering**
  - Solution: Check webhook is enabled and pointing to correct URL

## Email Template Customization

To customize the welcome email, edit:
- `welcome-email-template.ts` - Modify HTML and text content

The template is personalized with:
- User's full name (if provided)
- Falls back to email username if no name

## Security Notes

- API keys are stored as Supabase secrets (encrypted)
- Function runs server-side only (no client exposure)
- Webhook requires authorization header for security
- Only processes INSERT events (ignores updates/deletes)

## Cost Considerations

**Resend Free Tier:**
- 3,000 emails/month
- 100 emails/day
- No credit card required

For most apps, this is sufficient for welcome emails.

## Support

If you encounter issues:
1. Check the Edge Function logs
2. Verify Resend dashboard for delivery status
3. Test locally first before deploying to production
