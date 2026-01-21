# Gmail Newsletter Dispatcher Setup

This directory contains the complete setup for automatically ingesting newsletters from Gmail into your GitHub repository.

## 📋 What This Does

1. **Google Apps Script** monitors your Gmail inbox for specific newsletters
2. **Cleans HTML content** automatically (removes Gmail wrappers, headers, broken images)
3. When found, it sends the cleaned content to GitHub via `repository_dispatch` event
4. **GitHub Action** receives the event and creates a markdown file in `content/newsletters/`
5. The file is automatically committed and pushed to your repository

For details on HTML cleaning, see: [HTML_CLEANING_SUMMARY.md](./HTML_CLEANING_SUMMARY.md)

## 🚀 Setup Instructions

### Step 1: Add GitHub Secret

1. Go to: https://github.com/CinnamonGrossCrunch/OskiHub/settings/secrets/actions
2. Click **"New repository secret"**
3. Name: `GMAIL_DISPATCH_TOKEN`
4. Value: `YOUR_GITHUB_PAT` (paste your actual GitHub Personal Access Token)
5. Click **"Add secret"**

### Step 2: Set Up Google Apps Script

1. Go to: https://script.google.com
2. Click **"New Project"**
3. Name it: `Newsletter to GitHub Dispatcher`
4. Copy the entire content of `scripts/bluecrewreview-dispatcher.js`
5. Paste it into the Apps Script editor
6. **IMPORTANT**: Update line 28 with your newsletter search criteria:
   ```javascript
   const GMAIL_SEARCH_QUERY = 'subject:"YOUR_NEWSLETTER_SUBJECT" is:unread';
   ```
   
   **Examples:**
   - `'subject:"Haas Weekly Update" is:unread'`
   - `'from:newsletter@haas.berkeley.edu is:unread'`
   - `'subject:"EWMBA Newsletter" is:unread'`

7. Save the project (Ctrl+S or Cmd+S)

### Step 3: Test the Connection

1. In the Apps Script editor, select `testDispatch` from the function dropdown
2. Click **"Run"**
3. Authorize the script when prompted
4. Check the **"Execution log"** (View → Logs)
5. You should see: `✅ Test successful!`
6. Verify at: https://github.com/CinnamonGrossCrunch/OskiHub/actions

### Step 4: Test Gmail Search

1. Select `testGmailSearch` from the function dropdown
2. Click **"Run"**
3. Check the logs to see if it finds your newsletters
4. If no results, adjust `GMAIL_SEARCH_QUERY` and try again

### Step 5: Set Up Automatic Trigger

1. In Apps Script, click the **clock icon** (Triggers) in the left sidebar
2. Click **"+ Add Trigger"**
3. Configure:
   - **Function**: `checkNewsletters`
   - **Event source**: Time-driven
   - **Type**: Minutes timer
   - **Interval**: Every 5 or 10 minutes
4. Click **"Save"**

## 📂 Files Created

- `.github/workflows/newsletter-dispatch.yml` - GitHub Action workflow
- `scripts/bluecrewreview-dispatcher.js` - Google Apps Script (for reference)
- `content/newsletters/` - Will be created automatically when first newsletter is processed

## 🧪 Testing the Full Pipeline

### Test 1: Manual Test (Already Completed in Step 3)
✅ Verifies GitHub API connection

### Test 2: Real Newsletter Test
1. Send yourself an email with the subject matching your search query
2. Wait 5-10 minutes (based on your trigger interval)
3. Check: https://github.com/CinnamonGrossCrunch/OskiHub/actions
4. Check: `content/newsletters/` folder in your repo

### Test 3: Check Gmail Search
Use `testGmailSearch()` function to verify your search query finds the right emails

## 📊 Monitoring

**GitHub Actions:**
- https://github.com/CinnamonGrossCrunch/OskiHub/actions/workflows/newsletter-dispatch.yml

**Google Apps Script Executions:**
1. In Apps Script editor → Click **"Executions"** (left sidebar)
2. View logs for each run
3. Errors will show in red

## 🔧 Troubleshooting

### No newsletters being processed?
- Check Google Apps Script execution logs
- Verify `GMAIL_SEARCH_QUERY` matches your newsletters
- Run `testGmailSearch()` to debug search query

### GitHub Action failing?
- Verify secret `GMAIL_DISPATCH_TOKEN` is set correctly
- Check action logs at: https://github.com/CinnamonGrossCrunch/OskiHub/actions

### Duplicate newsletters?
- The script marks emails as read after processing
- If duplicates occur, check that `msg.markRead()` is executing successfully

## 🎯 Next Steps

Once working, you can:
- ✅ **HTML Cleanup** (Already implemented): Automatically removes Gmail wrapper divs, email headers, and broken inline images
- Add more sophisticated content extraction
- Set up notifications when new newsletters arrive
- Create filters for different newsletter types

## 🧹 Automatic Content Cleaning

The script automatically cleans newsletter HTML by:

1. **Removing Gmail wrapper elements**: `gmail_quote`, `gmail_quote_container` divs
2. **Stripping email headers**: The "Subject: ... To: ..." metadata section
3. **Removing broken images**: Inline images with `cid:` references (they won't display outside Gmail)
4. **Balancing HTML tags**: Cleans up orphaned closing tags

This happens **before** sending to GitHub, so your markdown files are clean from the start. No complex parsing needed in the frontend!

## ⚠️ Important Notes

- **Keep your PAT secure**: Never commit it to Git
- **Token expiration**: GitHub PATs can expire - monitor and renew
- **Gmail quotas**: Google Apps Script has daily quotas for Gmail API calls
- **Existing functionality**: This setup is completely separate from your Mailchimp scraping
- **Images**: Inline Gmail images (cid: references) are automatically removed as they can't be displayed outside Gmail

