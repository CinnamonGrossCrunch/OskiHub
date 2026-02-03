// ============================================================================
// GMAIL TO GITHUB NEWSLETTER DISPATCHER (v3 - Contents API + Smart Formatting)
// ============================================================================
// Uses GitHub Contents API to bypass 65KB limit while preserving rich HTML
//
// Setup Instructions:
// 1. Go to https://script.google.com
// 2. Create a new project
// 3. Paste this entire script
// 4. Update GITHUB_TOKEN with your personal access token
// 5. Run testDispatch() to verify connection
// 6. Set up a time-based trigger for checkNewsletters() (every 5-10 minutes)
// ============================================================================

// ============================================================================
// CONFIGURATION
// ============================================================================
const GITHUB_TOKEN = 'YOUR_GITHUB_TOKEN_HERE';
const REPO_OWNER = 'CinnamonGrossCrunch';
const REPO_NAME = 'OskiHub';

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
// SMART HTML CLEANING - Preserves structure, removes bloat
// ============================================================================
function cleanNewsletterHTML(rawHTML) {
  let cleaned = rawHTML;
  
  // ========== Remove Gmail cruft ==========
  cleaned = cleaned.replace(/<div class="gmail_quote[^"]*"[^>]*>/gi, '');
  cleaned = cleaned.replace(/<div[^>]*class="gmail_attr"[^>]*>[\s\S]*?<\/div>/gi, '');
  
  // ========== Remove ALL images (biggest size culprit) ==========
  // Base64 images
  cleaned = cleaned.replace(/<img[^>]*src=["']data:image[^"']*["'][^>]*>/gi, '');
  // CID images
  cleaned = cleaned.replace(/<img[^>]*src=["']cid:[^"']*["'][^>]*>/gi, '');
  // External images (simplify to just remove - they don't render well anyway)
  cleaned = cleaned.replace(/<img[^>]*>/gi, '');
  
  // ========== Remove scripts, styles, head ==========
  cleaned = cleaned.replace(/<script[\s\S]*?<\/script>/gi, '');
  cleaned = cleaned.replace(/<style[\s\S]*?<\/style>/gi, '');
  cleaned = cleaned.replace(/<head[\s\S]*?<\/head>/gi, '');
  cleaned = cleaned.replace(/<noscript[\s\S]*?<\/noscript>/gi, '');
  cleaned = cleaned.replace(/<!--[\s\S]*?-->/g, '');
  
  // ========== Remove empty spans and divs ==========
  cleaned = cleaned.replace(/<span[^>]*>\s*<\/span>/gi, '');
  cleaned = cleaned.replace(/<div[^>]*>\s*<\/div>/gi, '');
  cleaned = cleaned.replace(/<p[^>]*>\s*<\/p>/gi, '');
  cleaned = cleaned.replace(/<td[^>]*>\s*<br\s*\/?>\s*<\/td>/gi, '<td></td>');
  
  // ========== Strip verbose style properties ==========
  // Keep essential ones: background-color, font-weight, font-size
  cleaned = cleaned.replace(/font-variant-[^;:]+:[^;]+;?/gi, '');
  cleaned = cleaned.replace(/vertical-align:\s*(?:baseline|top|middle);?/gi, '');
  cleaned = cleaned.replace(/-webkit-[^;:]+:[^;]+;?/gi, '');
  cleaned = cleaned.replace(/-moz-[^;:]+:[^;]+;?/gi, '');
  cleaned = cleaned.replace(/-ms-[^;:]+:[^;]+;?/gi, '');
  cleaned = cleaned.replace(/line-height:[^;]+;?/gi, '');
  cleaned = cleaned.replace(/margin-[^;:]+:[^;]+;?/gi, '');
  cleaned = cleaned.replace(/padding:[^;]+;?/gi, '');
  cleaned = cleaned.replace(/overflow:[^;]+;?/gi, '');
  cleaned = cleaned.replace(/white-space:[^;]+;?/gi, '');
  cleaned = cleaned.replace(/border-collapse:[^;]+;?/gi, '');
  cleaned = cleaned.replace(/border-width:[^;]+;?/gi, '');
  cleaned = cleaned.replace(/border-style:[^;]+;?/gi, '');
  cleaned = cleaned.replace(/border-color:[^;]+;?/gi, '');
  
  // ========== Remove class attributes entirely ==========
  cleaned = cleaned.replace(/\s*class="[^"]*"/gi, '');
  
  // ========== Remove empty style attributes ==========
  cleaned = cleaned.replace(/\s*style=["']\s*["']/gi, '');
  
  // ========== Strip text colors (let dark theme apply) ==========
  cleaned = cleaned.replace(/([;"\s])color:\s*rgb\([^)]+\);?/gi, '$1');
  cleaned = cleaned.replace(/([;"\s])color:\s*#[0-9a-fA-F]{3,6};?/gi, '$1');
  cleaned = cleaned.replace(/([;"\s])color:\s*[a-z]+;?/gi, '$1');
  
  // ========== Convert Berkeley colors ==========
  // Dark blue backgrounds - keep them
  cleaned = cleaned.replace(/background-color:\s*rgb\(21,\s*40,\s*75\)/gi, 'background-color:#15284B');
  // Gold backgrounds - keep them
  cleaned = cleaned.replace(/background-color:\s*rgb\(253,\s*181,\s*21\)/gi, 'background-color:#FDB515');
  // Light/white backgrounds - convert to dark blue
  cleaned = cleaned.replace(/background-color:\s*rgb\(255,\s*255,\s*255\)/gi, 'background-color:#15284B');
  cleaned = cleaned.replace(/background-color:\s*rgb\(248,\s*248,\s*248\)/gi, 'background-color:#15284B');
  cleaned = cleaned.replace(/background-color:\s*#fff(?:fff)?/gi, 'background-color:#15284B');
  cleaned = cleaned.replace(/background-color:\s*white/gi, 'background-color:#15284B');
  cleaned = cleaned.replace(/background-color:\s*transparent/gi, '');
  
  // ========== Style links for dark theme ==========
  cleaned = cleaned.replace(/<a\s+/gi, '<a style="color:#60A5FA;text-decoration:underline;" ');
  
  // ========== Compress whitespace ==========
  cleaned = cleaned.replace(/>\s+</g, '><');
  cleaned = cleaned.replace(/[\n\r\t]+/g, ' ');
  cleaned = cleaned.replace(/\s{2,}/g, ' ');
  
  // ========== Remove data attributes ==========
  cleaned = cleaned.replace(/\s*data-[^=]+="[^"]*"/gi, '');
  
  // ========== Remove id attributes ==========
  cleaned = cleaned.replace(/\s*id="[^"]*"/gi, '');
  
  // ========== Remove dir attributes ==========
  cleaned = cleaned.replace(/\s*dir="[^"]*"/gi, '');
  
  // ========== Remove role attributes ==========
  cleaned = cleaned.replace(/\s*role="[^"]*"/gi, '');
  
  // ========== Clean up colgroup/col tags (verbose) ==========
  cleaned = cleaned.replace(/<colgroup>[\s\S]*?<\/colgroup>/gi, '');
  
  // ========== Remove Gmail reply/forward chains ==========
  cleaned = cleaned.replace(/\s*On\s+\w+,\s+\w+\s+\d+,\s+\d+\s+at\s+[\s\S]*/i, '');
  
  // ========== Final trim ==========
  cleaned = cleaned.trim();
  
  return cleaned;
}

// ============================================================================
// APPLY DARK THEME WRAPPER
// ============================================================================
function applyDarkThemeStyling(html) {
  // Wrap with dark theme container
  return `<div style="color:#E2E8F0;font-family:system-ui,-apple-system,sans-serif;">${html}</div>`;
}

// ============================================================================
// PROCESS INDIVIDUAL NEWSLETTER
// ============================================================================
function processNewsletter(msg) {
  const subject = msg.getSubject();
  const rawBody = msg.getBody();
  
  console.log(`📏 Original HTML size: ${rawBody.length} characters`);
  
  // Clean HTML (aggressive but preserves structure)
  let body = cleanNewsletterHTML(rawBody);
  console.log(`📏 After cleaning: ${body.length} characters`);
  
  // Apply dark theme wrapper
  body = applyDarkThemeStyling(body);
  console.log(`📏 Final size: ${body.length} characters`);
  console.log(`📉 Size reduction: ${Math.round((1 - body.length/rawBody.length) * 100)}%`);
  
  const date = Utilities.formatDate(msg.getDate(), 'America/Los_Angeles', 'yyyy-MM-dd');
  
  // Create URL-safe slug
  const slug = subject
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-|-$/g, '');
  
  console.log(`📰 Processing: ${subject} (${date})`);
  
  // Create markdown file content with frontmatter
  const fileContent = `---
title: "${subject}"
date: "${date}"
source: gmail
---

${body}
`;

  // Create file via GitHub Contents API
  const filename = `${date}-${slug}.md`;
  const success = createFileViaGitHubAPI(filename, fileContent, `feat: Add newsletter - ${subject}`);
  
  if (success) {
    msg.markRead();
    console.log(`✅ Created and marked as read: ${subject}`);
  } else {
    console.error(`❌ Failed to create file: ${subject}`);
  }
}

// ============================================================================
// GITHUB CONTENTS API - Creates file directly (no size limit!)
// ============================================================================
function createFileViaGitHubAPI(filename, content, commitMessage) {
  const url = `https://api.github.com/repos/${REPO_OWNER}/${REPO_NAME}/contents/content/newsletters/${filename}`;
  
  const options = {
    method: 'put',
    headers: {
      'Authorization': `Bearer ${GITHUB_TOKEN}`,
      'Accept': 'application/vnd.github+json',
      'X-GitHub-Api-Version': '2022-11-28'
    },
    contentType: 'application/json',
    payload: JSON.stringify({
      message: commitMessage,
      content: Utilities.base64Encode(content, Utilities.Charset.UTF_8)
    }),
    muteHttpExceptions: true
  };
  
  try {
    const response = UrlFetchApp.fetch(url, options);
    const statusCode = response.getResponseCode();
    
    if (statusCode === 201) {
      console.log('✅ GitHub file created successfully');
      return true;
    } else if (statusCode === 422) {
      // File already exists - try to update it
      console.log('⚠️ File exists, attempting update...');
      return updateFileViaGitHubAPI(filename, content, commitMessage);
    } else {
      console.error(`❌ GitHub API error: ${statusCode}`);
      console.error(response.getContentText());
      return false;
    }
  } catch (e) {
    console.error(`❌ Exception: ${e.message}`);
    return false;
  }
}

// ============================================================================
// UPDATE EXISTING FILE
// ============================================================================
function updateFileViaGitHubAPI(filename, content, commitMessage) {
  const getUrl = `https://api.github.com/repos/${REPO_OWNER}/${REPO_NAME}/contents/content/newsletters/${filename}`;
  
  // First, get the current file SHA
  const getOptions = {
    method: 'get',
    headers: {
      'Authorization': `Bearer ${GITHUB_TOKEN}`,
      'Accept': 'application/vnd.github+json',
    },
    muteHttpExceptions: true
  };
  
  try {
    const getResponse = UrlFetchApp.fetch(getUrl, getOptions);
    if (getResponse.getResponseCode() !== 200) {
      console.error('❌ Could not get existing file SHA');
      return false;
    }
    
    const fileData = JSON.parse(getResponse.getContentText());
    const sha = fileData.sha;
    
    // Now update with the SHA
    const putOptions = {
      method: 'put',
      headers: {
        'Authorization': `Bearer ${GITHUB_TOKEN}`,
        'Accept': 'application/vnd.github+json',
        'X-GitHub-Api-Version': '2022-11-28'
      },
      contentType: 'application/json',
      payload: JSON.stringify({
        message: commitMessage + ' (updated)',
        content: Utilities.base64Encode(content, Utilities.Charset.UTF_8),
        sha: sha
      }),
      muteHttpExceptions: true
    };
    
    const putResponse = UrlFetchApp.fetch(getUrl, putOptions);
    if (putResponse.getResponseCode() === 200) {
      console.log('✅ File updated successfully');
      return true;
    } else {
      console.error(`❌ Update failed: ${putResponse.getResponseCode()}`);
      return false;
    }
  } catch (e) {
    console.error(`❌ Update exception: ${e.message}`);
    return false;
  }
}

// ============================================================================
// TESTING FUNCTIONS
// ============================================================================
function testDispatch() {
  const testContent = `---
title: "Test Newsletter"
date: "2026-02-02"
source: gmail
---

<div style="color:#E2E8F0;font-family:system-ui,-apple-system,sans-serif;">
<h1>Test Content</h1>
<p>This is a test newsletter from Gmail dispatcher v3.</p>
<ul>
<li><strong>Item 1:</strong> With Berkeley blue styling</li>
<li><strong>Item 2:</strong> Links are <a style="color:#60A5FA;text-decoration:underline;" href="https://haas.berkeley.edu">styled blue</a></li>
</ul>
</div>
`;

  console.log('🧪 Running test...');
  const success = createFileViaGitHubAPI('test-dispatch-v3.md', testContent, 'test: Gmail dispatcher v3');
  
  if (success) {
    console.log('✅ Test successful! Check: https://github.com/' + REPO_OWNER + '/' + REPO_NAME + '/tree/main/content/newsletters');
  } else {
    console.log('❌ Test failed.');
  }
}

function testGmailSearch() {
  console.log('🔍 Testing Gmail search...');
  console.log(`Query: ${GMAIL_SEARCH_QUERY}`);
  
  const threads = GmailApp.search(GMAIL_SEARCH_QUERY);
  console.log(`Found ${threads.length} thread(s)`);
  
  if (threads.length > 0) {
    threads.slice(0, 3).forEach((thread, idx) => {
      const msg = thread.getMessages()[0];
      const bodySize = msg.getBody().length;
      console.log(`${idx + 1}. ${msg.getSubject()}`);
      console.log(`   Size: ${bodySize} chars, Unread: ${msg.isUnread()}`);
    });
  }
}

// Test cleaning on the most recent newsletter without sending
function testCleaning() {
  const threads = GmailApp.search(GMAIL_SEARCH_QUERY.replace(' is:unread', ''));
  if (threads.length === 0) {
    console.log('No newsletters found');
    return;
  }
  
  const msg = threads[0].getMessages()[0];
  const rawBody = msg.getBody();
  const cleaned = cleanNewsletterHTML(rawBody);
  const final = applyDarkThemeStyling(cleaned);
  
  console.log(`📧 Subject: ${msg.getSubject()}`);
  console.log(`📏 Original: ${rawBody.length} chars`);
  console.log(`📏 Cleaned: ${cleaned.length} chars`);
  console.log(`📏 Final: ${final.length} chars`);
  console.log(`📉 Reduction: ${Math.round((1 - final.length/rawBody.length) * 100)}%`);
  console.log(`\n📄 First 2000 chars of cleaned content:\n${final.substring(0, 2000)}`);
}
