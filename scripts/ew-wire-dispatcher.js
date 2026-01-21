// ============================================================================
// EW WIRE TO GITHUB DISPATCHER (Student Account - FIXED VERSION)
// ============================================================================
// This version uses STRUCTURAL targeting instead of catch-all email removal
// to preserve legitimate contact emails in the newsletter body
// ============================================================================

// ============================================================================
// CONFIGURATION
// ============================================================================
const GITHUB_TOKEN = 'YOUR_GITHUB_PAT_HERE'; // Replace with your actual GitHub PAT
const REPO_OWNER = 'CinnamonGrossCrunch';
const REPO_NAME = 'OskiHub';
const EVENT_TYPE = 'newsletter_received';

// ✅ Specific to EW Wire
const GMAIL_SEARCH_QUERY = 'subject:(EW Wire) is:unread';

// ============================================================================
// MAIN FUNCTION - Runs on Trigger
// ============================================================================
function checkNewsletters() {
  console.log('🔍 Checking for new EW Wire newsletters...');
  console.log(`Search query: ${GMAIL_SEARCH_QUERY}`);
  
  const threads = GmailApp.search(GMAIL_SEARCH_QUERY);
  
  if (threads.length === 0) {
    console.log('✅ No unread EW Wire newsletters found');
    return;
  }
  
  console.log(`📬 Found ${threads.length} EW Wire thread(s)`);
  
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
// CLEAN HTML CONTENT - STRUCTURAL TARGETING (FIXED)
// ============================================================================
function cleanEWWireHTML(rawHTML) {
  let cleaned = rawHTML;
  
  // ========================================================================
  // PRIORITY #1: REMOVE FOOTER DIV BY STRUCTURE (NOT EMAIL PATTERN)
  // Target the specific footer div with distinctive styling
  // ========================================================================
  
  // Pattern 1: Remove the gray footer div with specific styling
  // This is the "Email sent by ... to ... Unsubscribe" section
  cleaned = cleaned.replace(
    /<div\s+style="[^"]*color:\s*#555[^"]*font:\s*11px[^"]*Tahoma[^"]*"[^>]*>[\s\S]*?<\/div>/gi,
    ''
  );
  
  // Pattern 2: Remove the organization info div above footer (with border styling)
  cleaned = cleaned.replace(
    /<div\s+style="[^"]*font:\s*11px[^"]*Tahoma[^"]*border-top:\s*1px\s+solid\s+#BBB[^"]*"[^>]*>[\s\S]*?<\/div>/gi,
    ''
  );
  
  // Pattern 3: Backup - remove any remaining "Email sent by" text blocks
  cleaned = cleaned.replace(
    /<p[^>]*>\s*Email\s+sent\s+by[\s\S]*?<\/p>/gi,
    ''
  );
  
  // Pattern 4: Remove standalone Unsubscribe links (but not emails in general)
  cleaned = cleaned.replace(
    /<a[^>]*href="[^"]*unsubscribe[^"]*"[^>]*>[\s\S]*?<\/a>/gi,
    ''
  );
  
  // Pattern 5: Remove text containing "Unsubscribe" at end of content
  cleaned = cleaned.replace(
    /<p[^>]*>[\s\S]*?Unsubscribe[\s\S]*?<\/p>\s*$/gi,
    ''
  );
  
  // ========================================================================
  // PRIORITY #2: REMOVE ATTACHMENT CARD BLOCKS
  // ========================================================================
  
  // Remove CampusGroups attachment widget (cgWidgetImageCardBlock table)
  cleaned = cleaned.replace(
    /<table[^>]*class="[^"]*cgWidgetImageCardBlock[^"]*"[^>]*>[\s\S]*?<\/table>/gi,
    ''
  );
  
  // Remove "ATTACHMENTS" header section if present
  cleaned = cleaned.replace(
    /<p[^>]*>\s*ATTACHMENTS\s*<\/p>/gi,
    ''
  );
  
  // Remove "See the attached..." references
  cleaned = cleaned.replace(
    /See\s+the\s+attached[^<\.]*\.?/gi,
    ''
  );
  
  // ========================================================================
  // PRIORITY #3: PERSONALIZATION REMOVAL
  // ========================================================================
  
  // Remove "Dear [Name]," greeting (personalized content)
  cleaned = cleaned.replace(/Dear\s+[^,<]+,\s*<br\s*\/?>/gi, '');
  cleaned = cleaned.replace(/Dear&nbsp;[^,<]+,\s*<br\s*\/?>/gi, '');
  cleaned = cleaned.replace(/<br\s*\/?>\s*Dear\s+[^,<]+,/gi, '');
  
  // ========================================================================
  // PRIORITY #4: GMAIL WRAPPER REMOVAL
  // ========================================================================
  
  // Remove Gmail-specific wrappers
  cleaned = cleaned.replace(/<div class="gmail_quote[^"]*"[^>]*>/gi, '');
  cleaned = cleaned.replace(/<div[^>]*class="gmail_attr"[^>]*>[\s\S]*?<\/div>/gi, '');
  
  // Remove Gmail attachment notices
  cleaned = cleaned.replace(/<div[^>]*class="[^"]*gmail_att[^"]*"[^>]*>[\s\S]*?<\/div>/gi, '');
  
  // Remove broken inline images (cid: references)
  cleaned = cleaned.replace(/<img[^>]*src="cid:[^"]*"[^>]*>/gi, '');
  
  // ========================================================================
  // PRIORITY #5: METADATA REMOVAL
  // ========================================================================
  
  // Remove email metadata headers
  cleaned = cleaned.replace(/<div[^>]*>\s*(Subject|From|To|Date|Cc|Bcc):\s*[^<]*<\/div>/gi, '');
  cleaned = cleaned.replace(/<br>\s*(Subject|From|To|Date|Cc|Bcc):\s*[^<]*<br>/gi, '');
  
  // ========================================================================
  // PRIORITY #6: CLEANUP
  // ========================================================================
  
  // Fix orphaned closing divs
  const openDivs = (cleaned.match(/<div/gi) || []).length;
  const closeDivs = (cleaned.match(/<\/div>/gi) || []).length;
  const extraClosing = closeDivs - openDivs;
  
  if (extraClosing > 0) {
    for (let i = 0; i < extraClosing; i++) {
      cleaned = cleaned.replace(/<\/div>(?![\s\S]*<\/div>)/, '');
    }
  }
  
  // Remove excessive nested <center> tags (EW Wire uses many)
  while (cleaned.includes('<center><center>')) {
    cleaned = cleaned.replace(/<center>\s*<center>/gi, '<center>');
    cleaned = cleaned.replace(/<\/center>\s*<\/center>/gi, '</center>');
  }
  
  // Remove empty containers at start/end
  cleaned = cleaned.replace(/^(<div[^>]*>\s*<\/div>\s*)+/, '');
  cleaned = cleaned.replace(/(<div[^>]*>\s*<\/div>\s*)+$/, '');
  cleaned = cleaned.replace(/^(<center[^>]*>\s*<\/center>\s*)+/, '');
  cleaned = cleaned.replace(/(<center[^>]*>\s*<\/center>\s*)+$/, '');
  
  // Remove trailing empty paragraphs
  cleaned = cleaned.replace(/(<p[^>]*>\s*(&nbsp;|\s)*<\/p>\s*)+$/, '');
  cleaned = cleaned.replace(/(<br\s*\/?>\s*)+$/, '');
  
  return cleaned.trim();
}

// ============================================================================
// PROCESS INDIVIDUAL NEWSLETTER
// ============================================================================
function processNewsletter(msg) {
  const subject = msg.getSubject();
  const rawBody = msg.getBody();
  const body = cleanEWWireHTML(rawBody); // Use EW Wire-specific cleaning
  const date = Utilities.formatDate(msg.getDate(), 'GMT', 'yyyy-MM-dd');
  
  const slug = subject
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-|-$/g, '');
  
  console.log(`📰 Processing EW Wire: ${subject} (${date})`);
  console.log(`📏 Cleaned HTML length: ${body.length} characters`);
  
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
  
  const success = dispatchToGitHub(payload);
  
  if (success) {
    msg.markRead();
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
    muteHttpExceptions: true
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
// TESTING FUNCTION
// ============================================================================
function testDispatch() {
  const testPayload = {
    event_type: EVENT_TYPE,
    client_payload: {
      title: 'Test EW Wire - Fixed Version',
      date: '2025-11-17',
      content: '<h1>Test EW Wire</h1><p>This is a test from the FIXED EW Wire dispatcher.</p><p>Contact us at test@berkeley.edu for more info.</p>',
      slug: 'test-ew-wire-fixed',
      from: 'test@berkeley.edu',
      timestamp: new Date().toISOString()
    }
  };
  
  console.log('🧪 Running test dispatch for EW Wire (FIXED)...');
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
// HELPER: Test Gmail Search
// ============================================================================
function testGmailSearch() {
  console.log('🔍 Testing Gmail search for EW Wire...');
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
    console.log('⚠️ No EW Wire newsletters found.');
  }
}

// ============================================================================
// HELPER: Test HTML Cleaning on Most Recent Email
// ============================================================================
function testCleaning() {
  console.log('🧪 Testing HTML cleaning on most recent EW Wire...');
  
  const threads = GmailApp.search('subject:(EW Wire)');
  
  if (threads.length === 0) {
    console.log('❌ No EW Wire emails found');
    return;
  }
  
  const msg = threads[0].getMessages()[0];
  const rawBody = msg.getBody();
  const cleanedBody = cleanEWWireHTML(rawBody);
  
  console.log(`\n📧 Email: ${msg.getSubject()}`);
  console.log(`📏 Original length: ${rawBody.length} characters`);
  console.log(`📏 Cleaned length: ${cleanedBody.length} characters`);
  console.log(`📉 Reduction: ${((1 - cleanedBody.length/rawBody.length) * 100).toFixed(1)}%`);
  
  // Check for email addresses in cleaned content
  const emailPattern = /\w+@[a-zA-Z0-9.-]+\.[a-zA-Z]{2,}/g;
  const foundEmails = cleanedBody.match(emailPattern);
  
  if (foundEmails && foundEmails.length > 0) {
    console.log(`\n✅ Found ${foundEmails.length} email address(es) in newsletter body (these should be legitimate contact emails):`);
    foundEmails.forEach(email => console.log(`   - ${email}`));
  } else {
    console.log('\n⚠️ No email addresses found in cleaned content');
  }
  
  // Check for footer remnants
  if (cleanedBody.includes('Email sent by')) {
    console.log('\n❌ WARNING: "Email sent by" text still present!');
  } else {
    console.log('\n✅ "Email sent by" text successfully removed');
  }
  
  if (cleanedBody.includes('Unsubscribe')) {
    console.log('❌ WARNING: "Unsubscribe" text still present!');
  } else {
    console.log('✅ "Unsubscribe" text successfully removed');
  }
  
  if (cleanedBody.includes('mattgross@berkeley.edu')) {
    console.log('❌ WARNING: Your email address still present!');
  } else {
    console.log('✅ Your personal email address successfully removed');
  }
  
  if (cleanedBody.includes('ewmbaa-haas@berkeley.edu')) {
    console.log('❌ WARNING: Sender email address still present!');
  } else {
    console.log('✅ Sender email address successfully removed');
  }
  
  console.log('\n📄 First 500 characters of cleaned content:');
  console.log(cleanedBody.substring(0, 500));
  console.log('\n📄 Last 500 characters of cleaned content:');
  console.log(cleanedBody.substring(cleanedBody.length - 500));
}
