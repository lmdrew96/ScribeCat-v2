# Welcome Email Setup Guide

This guide walks you through setting up automatic welcome emails for new ScribeCat users.

## Overview

When a user signs up for ScribeCat, they automatically receive a personalized welcome email with:
- Warm greeting with their name
- Overview of ScribeCat features
- Getting started tips
- Pro tips for using study mode
- Beautiful HTML design with ScribeCat branding

**Technical Implementation:**
- Supabase Edge Function (serverless)
- Resend API for email delivery
- Database webhook trigger on user signup
- Runs server-side (secure, reliable)

## Quick Start

### 1. Create Resend Account

1. Go to [resend.com](https://resend.com) and sign up
2. Navigate to [API Keys](https://resend.com/api-keys)
3. Click **Create API Key**
4. Copy your API key (starts with `re_`)

**Free tier includes:** 3,000 emails/month, 100 emails/day

### 2. Set Up Sender Email

**For Development/Testing:**
- Use Resend's test domain: `onboarding@resend.dev`
- No verification needed
- Ready to use immediately

**For Production:**
1. Go to **Domains** in Resend dashboard
2. Click **Add Domain**
3. Enter your domain (e.g., `scribecat.app`)
4. Add the DNS records to your domain provider
5. Wait for verification (usually 5-30 minutes)
6. Use format: `ScribeCat <hello@scribecat.app>`

### 3. Deploy Edge Function

From your project root directory:

```bash
# Install Supabase CLI (if not already installed)
npm install -g supabase

# Login to Supabase
supabase login

# Link to your project
supabase link --project-ref your-project-ref

# Set environment variables
supabase secrets set RESEND_API_KEY=re_xxxxxxxxxxxxxxxxxxxxxxxxxxxxx
supabase secrets set SENDER_EMAIL="ScribeCat <hello@scribecat.app>"

# Deploy the function
supabase functions deploy send-welcome-email
```

**Find your project ref:**
- Supabase Dashboard > Project Settings > General > Reference ID

### 4. Configure Database Webhook

1. Go to [Supabase Dashboard](https://supabase.com/dashboard)
2. Select your ScribeCat project
3. Navigate to **Database** > **Webhooks**
4. Click **Create a new webhook**
5. Fill in the form:

**Webhook Configuration:**
```
Name: send-welcome-email-webhook
Table: auth.users
Events: ☑ INSERT (only check this one)
Type: HTTP Request
Method: POST
URL: https://YOUR-PROJECT-REF.supabase.co/functions/v1/send-welcome-email
```

**HTTP Headers:**
```
Content-Type: application/json
Authorization: Bearer YOUR-ANON-KEY
```

6. Click **Create webhook**

**Find your Function URL:**
```bash
supabase functions list
```

**Find your Anon Key:**
- Supabase Dashboard > Project Settings > API > `anon` `public`

## Testing

### Test with a New Signup

The easiest way to test:

1. Run ScribeCat locally or in development
2. Create a new user account with a real email address
3. Check your email inbox
4. Verify the welcome email arrived

### Check Edge Function Logs

```bash
# Stream live logs
supabase functions logs send-welcome-email --follow

# View recent logs
supabase functions logs send-welcome-email --limit 50
```

### Verify Webhook Deliveries

In Supabase Dashboard:
- **Database** > **Webhooks** > `send-welcome-email-webhook`
- Scroll to **Recent deliveries**
- Check for green checkmarks (success) or red X's (failures)
- Click on individual deliveries to see details

### Test Locally (Optional)

If you want to test the function locally before deploying:

1. Create `.env` file in `supabase/functions/send-welcome-email/`:
   ```bash
   RESEND_API_KEY=re_xxxxxxxxxxxxxxxxxxxxxxxxxxxxx
   SENDER_EMAIL=ScribeCat <onboarding@resend.dev>
   ```

2. Start Supabase locally:
   ```bash
   supabase start
   ```

3. Serve the function:
   ```bash
   supabase functions serve send-welcome-email --env-file supabase/functions/send-welcome-email/.env
   ```

4. Send test request:
   ```bash
   curl -i --location --request POST 'http://localhost:54321/functions/v1/send-welcome-email' \
     --header 'Content-Type: application/json' \
     --data '{
       "type": "INSERT",
       "table": "users",
       "record": {
         "id": "test-123",
         "email": "your-email@example.com",
         "raw_user_meta_data": {
           "full_name": "Test User"
         }
       },
       "schema": "auth"
     }'
   ```

## Customizing the Email

### Edit Email Content

The email template is located at:
```
supabase/functions/send-welcome-email/welcome-email-template.ts
```

**What you can customize:**
- Email subject line (in `index.ts`)
- HTML content and styling
- Plain text fallback
- Getting started tips
- Pro tips
- Footer text

After making changes:
```bash
supabase functions deploy send-welcome-email
```

### Personalization Variables

The template automatically uses:
- `fullName` - User's full name (from signup form)
- `email` - User's email address

If no full name is provided, the email uses the part before @ in the email address.

## Troubleshooting

### Email Not Received

**1. Check Edge Function logs:**
```bash
supabase functions logs send-welcome-email
```

Look for errors like:
- `"Server configuration error: Missing API key"` → Set `RESEND_API_KEY`
- `"Resend API error"` → Check API key validity and sender email

**2. Check webhook status:**
- Go to Database > Webhooks in Supabase Dashboard
- Look at Recent deliveries
- If webhook shows errors, check:
  - URL is correct
  - Authorization header is set
  - Webhook is enabled

**3. Check spam folder:**
- Welcome emails might be filtered as promotional
- Check user's spam/junk folder

**4. Verify Resend status:**
- Go to [Resend Emails](https://resend.com/emails)
- Check if email was sent
- Look for delivery status and any errors

### Common Errors

**"Validation error" from Resend:**
- **Cause:** Sender email not verified
- **Solution:** Verify your domain in Resend or use `onboarding@resend.dev` for testing

**"No email found in user record":**
- **Cause:** Webhook payload missing email field
- **Solution:** This shouldn't happen with normal signups; check webhook configuration

**Webhook not triggering:**
- **Cause:** Webhook misconfigured or disabled
- **Solution:**
  - Verify webhook is enabled
  - Check webhook URL is correct
  - Ensure INSERT event is checked
  - Verify Authorization header is set

### Rate Limits

**Resend Free Tier:**
- 100 emails/day
- 3,000 emails/month

If you hit these limits:
- Upgrade to Resend paid plan
- Or temporarily disable the webhook

## Monitoring

### Track Email Delivery

**In Resend Dashboard:**
1. Go to [Emails](https://resend.com/emails)
2. See all sent emails with status
3. Click on individual emails to see:
   - Delivery status
   - Open/click tracking (if enabled)
   - Full email content

**In Supabase:**
1. Database > Webhooks > Recent deliveries
2. Check for successful triggers
3. Review any failed webhook calls

### Set Up Alerts (Optional)

**Resend Webhooks:**
You can set up webhooks in Resend to track email events:
- `email.sent`
- `email.delivered`
- `email.bounced`

See [Resend Webhooks docs](https://resend.com/docs/webhooks)

## Production Checklist

Before going live with welcome emails:

- [ ] Resend account created
- [ ] Domain verified in Resend (not using test domain)
- [ ] Sender email configured with verified domain
- [ ] Edge Function deployed to Supabase
- [ ] Environment variables set (`RESEND_API_KEY`, `SENDER_EMAIL`)
- [ ] Database webhook created and enabled
- [ ] Test email sent and received successfully
- [ ] Email content reviewed and approved
- [ ] Spam score checked (use [mail-tester.com](https://www.mail-tester.com))
- [ ] Email looks good on mobile and desktop
- [ ] Logs monitored for any errors

## Cost Breakdown

**Resend:**
- Free tier: 3,000 emails/month
- Paid tier: $20/month for 50,000 emails

**Supabase Edge Functions:**
- Free tier: 500,000 invocations/month
- Essentially free for welcome emails

**Total cost for most apps:** $0/month (free tiers are sufficient)

## Architecture Notes

**Why Supabase Edge Functions?**
- Runs server-side (API keys stay secure)
- Works even if user closes app immediately
- Automatic retries on failure
- Serverless (no infrastructure to manage)
- Integrates seamlessly with Supabase Auth

**Why Resend?**
- Modern, developer-friendly API
- Great free tier
- Excellent deliverability
- Simple TypeScript integration
- Good documentation and support

## Files Reference

**Edge Function:**
- `supabase/functions/send-welcome-email/index.ts` - Main function
- `supabase/functions/send-welcome-email/welcome-email-template.ts` - Email templates
- `supabase/functions/send-welcome-email/.env.example` - Environment variables example
- `supabase/functions/send-welcome-email/README.md` - Detailed function docs

**Documentation:**
- `docs/WELCOME_EMAIL_SETUP.md` - This file
- `docs/SUPABASE_SETUP.md` - General Supabase setup

## Support

If you run into issues:

1. Check the [Resend Documentation](https://resend.com/docs)
2. Check the [Supabase Edge Functions Documentation](https://supabase.com/docs/guides/functions)
3. Review Edge Function logs for errors
4. Test locally before deploying to production

## Next Steps

After setting up welcome emails, consider:

1. **Track email opens/clicks** - Enable tracking in Resend
2. **A/B test email content** - Try different subject lines and content
3. **Add more automated emails** - Password reset, feature announcements
4. **Set up email preferences** - Let users opt out of certain emails
5. **Monitor deliverability** - Track bounce rates and spam complaints

---

**Version:** 1.46.0
**Last Updated:** 2025-11-16
