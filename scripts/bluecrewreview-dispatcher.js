// ============================================================================
// GMAIL TO GITHUB NEWSLETTER DISPATCHER
// ============================================================================
// This Google Apps Script monitors your Gmail inbox for newsletters and
// automatically sends them to your GitHub repository via repository_dispatch.
//
// Setup Instructions:
// 1. Go to https://script.google.com
// 2. Create a new project
// 3. Paste this entire script
// 4. Update GMAIL_SEARCH_QUERY below with your newsletter subject/sender
// 5. Run testDispatch() to verify connection
// 6. Set up a time-based trigger for checkNewsletters() (every 5-10 minutes)
// ============================================================================

// ============================================================================
// CONFIGURATION
// ============================================================================
// ✅ CONFIGURED: Ready to paste into Google Apps Script!
const GITHUB_TOKEN = 'YOUR_GITHUB_TOKEN_HERE';
const REPO_OWNER = 'CinnamonGrossCrunch';
const REPO_NAME = 'OskiHub';
const EVENT_TYPE = 'newsletter_received';

// ✅ CONFIGURED: Blue Crew Review newsletter filter (case-insensitive)
// Matches: "BLUE CREW REVIEW", "Blue Crew Review", "Fwd: 11.16.25 BLUE CREW REVIEW", etc.
const GMAIL_SEARCH_QUERY = 'subject:(blue crew review) is:unread';

// ============================================================================
// MAIN FUNCTION - Runs on Trigger
// ============================================================================
function checkNewsletters() {
  console.log('🔍 Checking for new newsletters...');
  console.log(`Search query: ${GMAIL_SEARCH_QUERY}`);
  
  const threads = GmailApp.search(GMAIL_SEARCH_QUERY);
  
  if (threads.length === 0) {
    console.log('✅ No unread newsletters found');
    return;
  }
  
  console.log(`📬 Found ${threads.length} newsletter thread(s)`);
  
  threads.forEach(thread => {
    const msgs = thread.getMessages();
    msgs.forEach(msg => {
      if (msg.isUnread()) {
        processNewsletter(msg);
      }
    });
  });
}

// ============================================================================
// CLEAN AND COMPRESS HTML CONTENT
// ============================================================================
function cleanNewsletterHTML(rawHTML) {
  let cleaned = rawHTML;
  
  // ========== Remove Gmail cruft ==========
  // Remove Gmail wrapper divs
  cleaned = cleaned.replace(/<div class="gmail_quote[^"]*"[^>]*>/gi, '');
  cleaned = cleaned.replace(/<div[^>]*class="gmail_attr"[^>]*>[\s\S]*?<\/div>/gi, '');
  
  // ========== Remove images (biggest size culprit) ==========
  // Remove ALL base64 embedded images (these are HUGE)
  cleaned = cleaned.replace(/<img[^>]*src=["']data:image[^"']*["'][^>]*>/gi, '[image]');
  
  // Remove cid: images (broken outside Gmail anyway)
  cleaned = cleaned.replace(/<img[^>]*src=["']cid:[^"']*["'][^>]*>/gi, '');
  
  // Remove tracking pixels (1x1 or very small images)
  cleaned = cleaned.replace(/<img[^>]*(?:width|height)=["']?[01](?:px)?["']?[^>]*>/gi, '');
  
  // Keep external URL images but simplify them
  // Replace complex img tags with simplified versions
  cleaned = cleaned.replace(/<img([^>]*?)src=["'](https?:\/\/[^"']+)["']([^>]*)>/gi, '<img src="$2">');
  
  // ========== Remove scripts and tracking ==========
  cleaned = cleaned.replace(/<script[\s\S]*?<\/script>/gi, '');
  cleaned = cleaned.replace(/<noscript[\s\S]*?<\/noscript>/gi, '');
  cleaned = cleaned.replace(/<!--[\s\S]*?-->/g, '');
  
  // ========== Compress whitespace ==========
  cleaned = cleaned.replace(/>\s+</g, '><');
  cleaned = cleaned.replace(/[\n\r\t]+/g, ' ');
  cleaned = cleaned.replace(/\s{2,}/g, ' ');
  
  // ========== Simplify styles (keep structure, remove bloat) ==========
  // Remove empty attributes
  cleaned = cleaned.replace(/\s*style=["']\s*["']/gi, '');
  cleaned = cleaned.replace(/\s*class=["']\s*["']/gi, '');
  
  // Remove specific verbose style properties that don't affect display much
  cleaned = cleaned.replace(/font-variant-[^;:]+:[^;]+;?/gi, '');
  cleaned = cleaned.replace(/vertical-align:\s*baseline;?/gi, '');
  cleaned = cleaned.replace(/-webkit-[^;:]+:[^;]+;?/gi, '');
  cleaned = cleaned.replace(/-moz-[^;:]+:[^;]+;?/gi, '');
  cleaned = cleaned.replace(/-ms-[^;:]+:[^;]+;?/gi, '');
  
  // ========== STRIP TEXT COLORS (so our dark theme can apply) ==========
  // Remove color properties from inline styles (except background-color)
  // This allows our wrapper's color:#E2E8F0 to take effect
  cleaned = cleaned.replace(/([;"\s])color:\s*rgb\([^)]+\);?/gi, '$1');
  cleaned = cleaned.replace(/([;"\s])color:\s*#[0-9a-fA-F]{3,6};?/gi, '$1');
  cleaned = cleaned.replace(/([;"\s])color:\s*[a-z]+;?/gi, '$1');
  
  // ========== CONVERT LIGHT BACKGROUNDS TO DARK BLUE ==========
  // Replace light/white backgrounds with Berkeley dark blue (#15284B)
  // This prevents white text on white/light backgrounds
  cleaned = cleaned.replace(/background-color:\s*rgb\(248,\s*248,\s*248\)/gi, 'background-color:#15284B');
  cleaned = cleaned.replace(/background-color:\s*rgb\(255,\s*255,\s*255\)/gi, 'background-color:#15284B');
  cleaned = cleaned.replace(/background-color:\s*#f8f8f8/gi, 'background-color:#15284B');
  cleaned = cleaned.replace(/background-color:\s*#fff(?:fff)?/gi, 'background-color:#15284B');
  cleaned = cleaned.replace(/background-color:\s*white/gi, 'background-color:#15284B');
  // Also handle any light gray backgrounds
  cleaned = cleaned.replace(/background-color:\s*rgb\(2[0-4][0-9],\s*2[0-4][0-9],\s*2[0-4][0-9]\)/gi, 'background-color:#15284B');
  
  // ========== Balance divs ==========
  const openDivs = (cleaned.match(/<div/gi) || []).length;
  const closeDivs = (cleaned.match(/<\/div>/gi) || []).length;
  const extraClosing = closeDivs - openDivs;
  
  if (extraClosing > 0) {
    for (let i = 0; i < extraClosing; i++) {
      cleaned = cleaned.replace(/<\/div>(?![\s\S]*<\/div>)/, '');
    }
  }
  
  return cleaned.trim();
}

// ============================================================================
// APPLY DARK THEME STYLING
// ============================================================================
function applyDarkThemeStyling(html) {
  let styled = html;
  
  // Style all links: light blue color (#60A5FA = Tailwind blue-400)
  // Add style to existing <a> tags, or replace existing color
  styled = styled.replace(/<a\s+/gi, '<a style="color:#60A5FA;text-decoration:underline;" ');
  
  // Remove any conflicting link colors that were in the original
  styled = styled.replace(/(<a[^>]*style="[^"]*)(color:[^;]+;?)([^"]*")/gi, '$1color:#60A5FA;$3');
  
  // Wrap entire content with dark theme container
  // - White text (#E2E8F0 = Tailwind slate-200)
  // - Dark blue background for highlights will be handled by existing bgcolor attributes
  const wrapper = `<div style="color:#E2E8F0;font-family:system-ui,-apple-system,sans-serif;">${styled}</div>`;
  
  return wrapper;
}

// ============================================================================
// PROCESS INDIVIDUAL NEWSLETTER
// ============================================================================
function processNewsletter(msg) {
  const subject = msg.getSubject();
  const rawBody = msg.getBody(); // HTML content
  
  console.log(`📏 Original HTML size: ${rawBody.length} characters`);
  
  let body = cleanNewsletterHTML(rawBody); // Clean and compress
  
  console.log(`📏 After cleaning: ${body.length} characters`);
  
  // Apply dark theme styling (white text, light blue links)
  body = applyDarkThemeStyling(body);
  
  console.log(`📏 Final size with styling: ${body.length} characters`);
  console.log(`📉 Size reduction: ${Math.round((1 - body.length/rawBody.length) * 100)}%`);
  
  const date = Utilities.formatDate(msg.getDate(), 'GMT', 'yyyy-MM-dd');
  
  // Create URL-safe slug from subject
  const slug = subject
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-|-$/g, '');
  
  console.log(`📰 Processing: ${subject} (${date})`);
  
  // Prepare payload for GitHub
  const payload = {
    event_type: EVENT_TYPE,
    client_payload: {
      title: subject,
      date: date,
      content: body,
      slug: slug,
      from: msg.getFrom(),
      timestamp: new Date().toISOString()
    }
  };
  
  // Send to GitHub
  const success = dispatchToGitHub(payload);
  
  if (success) {
    msg.markRead(); // Mark as read to prevent reprocessing
    console.log(`✅ Dispatched and marked as read: ${subject}`);
  } else {
    console.error(`❌ Failed to dispatch: ${subject}`);
  }
}

// ============================================================================
// GITHUB API CALL
// ============================================================================
function dispatchToGitHub(payload) {
  const url = `https://api.github.com/repos/${REPO_OWNER}/${REPO_NAME}/dispatches`;
  
  const options = {
    method: 'post',
    headers: {
      'Authorization': `Bearer ${GITHUB_TOKEN}`,
      'Accept': 'application/vnd.github+json',
      'X-GitHub-Api-Version': '2022-11-28'
    },
    contentType: 'application/json',
    payload: JSON.stringify(payload),
    muteHttpExceptions: true // Don't throw on HTTP errors
  };
  
  try {
    const response = UrlFetchApp.fetch(url, options);
    const statusCode = response.getResponseCode();
    
    if (statusCode === 204) {
      console.log('✅ GitHub dispatch successful');
      return true;
    } else {
      console.error(`❌ GitHub API error: ${statusCode}`);
      console.error(response.getContentText());
      return false;
    }
  } catch (e) {
    console.error(`❌ Exception during dispatch: ${e.message}`);
    return false;
  }
}

// ============================================================================
// TESTING FUNCTION - Run this manually to test
// ============================================================================
function testDispatch() {
  const testPayload = {
    event_type: EVENT_TYPE,
    client_payload: {
      title: 'Test Newsletter',
      date: '2025-11-16',
      content: '<h1>Test Content</h1><p>This is a test newsletter from Gmail dispatcher.</p>',
      slug: 'test-newsletter',
      from: 'test@example.com',
      timestamp: new Date().toISOString()
    }
  };
  
  console.log('🧪 Running test dispatch...');
  console.log(`Target: ${REPO_OWNER}/${REPO_NAME}`);
  
  const success = dispatchToGitHub(testPayload);
  
  if (success) {
    console.log('✅ Test successful! Check your GitHub repository at:');
    console.log(`   https://github.com/${REPO_OWNER}/${REPO_NAME}/actions`);
  } else {
    console.log('❌ Test failed. Check the logs above.');
  }
}

// ============================================================================
// HELPER: Test Gmail Search Query
// ============================================================================
function testGmailSearch() {
  console.log('🔍 Testing Gmail search query...');
  console.log(`Query: ${GMAIL_SEARCH_QUERY}`);
  
  const threads = GmailApp.search(GMAIL_SEARCH_QUERY);
  
  console.log(`Found ${threads.length} thread(s)`);
  
  if (threads.length > 0) {
    console.log('\nFirst 5 matches:');
    threads.slice(0, 5).forEach((thread, idx) => {
      const msg = thread.getMessages()[0];
      console.log(`${idx + 1}. Subject: ${msg.getSubject()}`);
      console.log(`   From: ${msg.getFrom()}`);
      console.log(`   Date: ${msg.getDate()}`);
      console.log(`   Unread: ${msg.isUnread()}`);
    });
  } else {
    console.log('⚠️ No matching emails found. Try updating GMAIL_SEARCH_QUERY.');
  }
}
