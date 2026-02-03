// ============================================================================
// GMAIL TO GITHUB NEWSLETTER DISPATCHER (v4 - Clean Markdown Output)
// ============================================================================
// Converts Gmail newsletters to clean Markdown for proper rendering
// Uses GitHub Contents API (no 65KB limit) with token from Script Properties
//
// Setup Instructions:
// 1. Go to https://script.google.com
// 2. Create a new project and paste this script
// 3. Go to Project Settings > Script Properties
// 4. Add property: GITHUB_TOKEN = your_personal_access_token
// 5. Run testDispatch() to verify connection
// 6. Set up a time-based trigger for checkNewsletters() (every 5-10 minutes)
// ============================================================================

// ============================================================================
// CONFIGURATION
// ============================================================================
const REPO_OWNER = 'CinnamonGrossCrunch';
const REPO_NAME = 'OskiHub';
const GMAIL_SEARCH_QUERY = 'subject:(blue crew review) is:unread';

// Get GitHub token from Script Properties (secure storage)
function getGitHubToken() {
  const token = PropertiesService.getScriptProperties().getProperty('GITHUB_TOKEN');
  if (!token) {
    throw new Error('GITHUB_TOKEN not found in Script Properties. Go to Project Settings > Script Properties to add it.');
  }
  return token;
}

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
// HTML TO MARKDOWN CONVERTER
// ============================================================================
function htmlToMarkdown(html) {
  let md = html;
  
  // Remove scripts, styles, head, comments
  md = md.replace(/<script[\s\S]*?<\/script>/gi, '');
  md = md.replace(/<style[\s\S]*?<\/style>/gi, '');
  md = md.replace(/<head[\s\S]*?<\/head>/gi, '');
  md = md.replace(/<!--[\s\S]*?-->/g, '');
  md = md.replace(/<noscript[\s\S]*?<\/noscript>/gi, '');
  
  // Remove images (they don't render well from Gmail)
  md = md.replace(/<img[^>]*>/gi, '');
  
  // Remove Gmail cruft
  md = md.replace(/<div class="gmail_quote[^"]*"[^>]*>/gi, '');
  md = md.replace(/<div[^>]*class="gmail_attr"[^>]*>[\s\S]*?<\/div>/gi, '');
  
  // Remove Gmail reply/forward chains
  md = md.replace(/On\s+\w+,\s+\w+\s+\d+,\s+\d+\s+at\s+[\s\S]*/i, '');
  
  // Decode HTML entities first
  md = md.replace(/&amp;/g, '&');
  md = md.replace(/&lt;/g, '<');
  md = md.replace(/&gt;/g, '>');
  md = md.replace(/&quot;/g, '"');
  md = md.replace(/&#39;/g, "'");
  md = md.replace(/&nbsp;/g, ' ');
  
  // Convert headers
  md = md.replace(/<h1[^>]*>([\s\S]*?)<\/h1>/gi, '\n# $1\n');
  md = md.replace(/<h2[^>]*>([\s\S]*?)<\/h2>/gi, '\n## $1\n');
  md = md.replace(/<h3[^>]*>([\s\S]*?)<\/h3>/gi, '\n### $1\n');
  md = md.replace(/<h4[^>]*>([\s\S]*?)<\/h4>/gi, '\n#### $1\n');
  
  // Convert links - extract href and text
  md = md.replace(/<a[^>]*href=["']([^"']+)["'][^>]*>([\s\S]*?)<\/a>/gi, (match, url, text) => {
    // Clean the text of any remaining HTML
    const cleanText = text.replace(/<[^>]*>/g, '').trim();
    // If text is same as URL or empty, just show URL
    if (!cleanText || cleanText === url) {
      return `[${url}](${url})`;
    }
    return `[${cleanText}](${url})`;
  });
  
  // Convert bold/strong
  md = md.replace(/<strong[^>]*>([\s\S]*?)<\/strong>/gi, '**$1**');
  md = md.replace(/<b[^>]*>([\s\S]*?)<\/b>/gi, '**$1**');
  
  // Convert italic/emphasis
  md = md.replace(/<em[^>]*>([\s\S]*?)<\/em>/gi, '*$1*');
  md = md.replace(/<i[^>]*>([\s\S]*?)<\/i>/gi, '*$1*');
  
  // Convert underline to bold (markdown has no underline)
  md = md.replace(/<u[^>]*>([\s\S]*?)<\/u>/gi, '**$1**');
  
  // Convert list items
  md = md.replace(/<li[^>]*>([\s\S]*?)<\/li>/gi, '- $1\n');
  
  // Remove ul/ol tags but keep content
  md = md.replace(/<\/?ul[^>]*>/gi, '\n');
  md = md.replace(/<\/?ol[^>]*>/gi, '\n');
  
  // Convert paragraphs
  md = md.replace(/<p[^>]*>([\s\S]*?)<\/p>/gi, '\n$1\n');
  
  // Convert line breaks
  md = md.replace(/<br\s*\/?>/gi, '\n');
  
  // Convert horizontal rules
  md = md.replace(/<hr[^>]*>/gi, '\n---\n');
  
  // Remove remaining HTML tags
  md = md.replace(/<[^>]+>/g, '');
  
  // Clean up whitespace
  md = md.replace(/\n{3,}/g, '\n\n');  // Max 2 newlines
  md = md.replace(/[ \t]+/g, ' ');      // Collapse spaces
  md = md.replace(/\n +/g, '\n');       // Remove leading spaces on lines
  md = md.replace(/ +\n/g, '\n');       // Remove trailing spaces on lines
  
  // Clean up bullet points
  md = md.replace(/^- +/gm, '- ');      // Normalize bullet spacing
  md = md.replace(/\n- /g, '\n- ');     // Ensure bullets on own lines
  
  return md.trim();
}

// ============================================================================
// EXTRACT NEWSLETTER TITLE AND DATE
// ============================================================================
function extractNewsletterInfo(subject) {
  // Clean subject line
  let title = subject;
  
  // Remove "Fwd:" prefix
  title = title.replace(/^fwd:\s*/i, '');
  
  // Try to extract date from subject (e.g., "02.01.26", "2.1.26", "2-1-26")
  const dateMatch = title.match(/(\d{1,2})[.\-\/](\d{1,2})[.\-\/](\d{2,4})/);
  let formattedDate = '';
  
  if (dateMatch) {
    const month = dateMatch[1].padStart(2, '0');
    const day = dateMatch[2].padStart(2, '0');
    let year = dateMatch[3];
    if (year.length === 2) {
      year = '20' + year;
    }
    formattedDate = `${month}.${day}.${year.slice(-2)}`;
    
    // Remove date from title for cleaner display
    title = title.replace(/\d{1,2}[.\-\/]\d{1,2}[.\-\/]\d{2,4}\s*/g, '').trim();
  }
  
  // Capitalize title properly
  title = title.split(' ')
    .map(word => word.charAt(0).toUpperCase() + word.slice(1).toLowerCase())
    .join(' ');
  
  return { title, formattedDate };
}

// ============================================================================
// PROCESS INDIVIDUAL NEWSLETTER
// ============================================================================
function processNewsletter(msg) {
  const subject = msg.getSubject();
  const rawBody = msg.getBody();
  const plainBody = msg.getPlainBody(); // Get plain text version too
  
  console.log(`📏 Original HTML size: ${rawBody.length} characters`);
  console.log(`📏 Plain text size: ${plainBody.length} characters`);
  
  // Convert HTML to Markdown
  let markdown = htmlToMarkdown(rawBody);
  console.log(`📏 Markdown size: ${markdown.length} characters`);
  console.log(`📉 Size reduction: ${Math.round((1 - markdown.length/rawBody.length) * 100)}%`);
  
  // Extract info from subject
  const { title, formattedDate } = extractNewsletterInfo(subject);
  
  // Get date for filename
  const date = Utilities.formatDate(msg.getDate(), 'America/Los_Angeles', 'yyyy-MM-dd');
  
  // Create URL-safe slug
  const slug = subject
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-|-$/g, '');
  
  console.log(`📰 Processing: ${title} (${date})`);
  
  // Build the markdown file with frontmatter
  const fileContent = `---
title: "${title}${formattedDate ? ' ' + formattedDate : ''}"
date: "${date}"
source: gmail
---

# ${title.toUpperCase()}
## ${formattedDate || date}

${markdown}
`;

  // Create file via GitHub Contents API
  const filename = `${date}-${slug}.md`;
  const success = createFileViaGitHubAPI(filename, fileContent, `feat: Add newsletter - ${title}`);
  
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
  const token = getGitHubToken();
  const url = `https://api.github.com/repos/${REPO_OWNER}/${REPO_NAME}/contents/content/newsletters/${filename}`;
  
  const options = {
    method: 'put',
    headers: {
      'Authorization': `Bearer ${token}`,
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
  const token = getGitHubToken();
  const getUrl = `https://api.github.com/repos/${REPO_OWNER}/${REPO_NAME}/contents/content/newsletters/${filename}`;
  
  // First, get the current file SHA
  const getOptions = {
    method: 'get',
    headers: {
      'Authorization': `Bearer ${token}`,
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
        'Authorization': `Bearer ${token}`,
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
title: "Test Newsletter 02.02.26"
date: "2026-02-02"
source: gmail
---

# TEST NEWSLETTER
## 02.02.26

This is a test newsletter from Gmail dispatcher v4.

## Test Section

- **Item 1:** With bold text
- **Item 2:** With a [link](https://haas.berkeley.edu)
- Regular bullet point

### Subsection

More content here with *italic* and **bold** text.

---

## Resources

- [Berkeley Haas](https://haas.berkeley.edu)
- [OskiHub](https://www.oski.app)
`;

  console.log('🧪 Running test...');
  console.log('📝 Verifying GitHub token...');
  
  try {
    getGitHubToken();
    console.log('✅ GitHub token found');
  } catch (e) {
    console.error('❌ ' + e.message);
    return;
  }
  
  const success = createFileViaGitHubAPI('test-dispatch-v4.md', testContent, 'test: Gmail dispatcher v4');
  
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

// Test HTML to Markdown conversion on the most recent newsletter
function testConversion() {
  const threads = GmailApp.search(GMAIL_SEARCH_QUERY.replace(' is:unread', ''));
  if (threads.length === 0) {
    console.log('No newsletters found');
    return;
  }
  
  const msg = threads[0].getMessages()[0];
  const rawBody = msg.getBody();
  const markdown = htmlToMarkdown(rawBody);
  const { title, formattedDate } = extractNewsletterInfo(msg.getSubject());
  
  console.log(`📧 Subject: ${msg.getSubject()}`);
  console.log(`📝 Extracted Title: ${title}`);
  console.log(`📅 Extracted Date: ${formattedDate}`);
  console.log(`📏 Original HTML: ${rawBody.length} chars`);
  console.log(`📏 Markdown: ${markdown.length} chars`);
  console.log(`📉 Reduction: ${Math.round((1 - markdown.length/rawBody.length) * 100)}%`);
  console.log(`\n📄 First 3000 chars of markdown:\n${markdown.substring(0, 3000)}`);
}

// Setup helper - run this first!
function setupInstructions() {
  console.log('='.repeat(60));
  console.log('GMAIL TO GITHUB NEWSLETTER DISPATCHER - SETUP');
  console.log('='.repeat(60));
  console.log('');
  console.log('Step 1: Add your GitHub token to Script Properties');
  console.log('  - Click the gear icon (Project Settings) in the left sidebar');
  console.log('  - Scroll down to "Script Properties"');
  console.log('  - Click "Add script property"');
  console.log('  - Property: GITHUB_TOKEN');
  console.log('  - Value: your_github_personal_access_token');
  console.log('');
  console.log('Step 2: Run testDispatch() to verify the connection');
  console.log('');
  console.log('Step 3: Set up a trigger for automatic checking');
  console.log('  - Click the clock icon (Triggers) in the left sidebar');
  console.log('  - Click "Add Trigger"');
  console.log('  - Function: checkNewsletters');
  console.log('  - Event source: Time-driven');
  console.log('  - Type: Minutes timer');
  console.log('  - Interval: Every 5 or 10 minutes');
  console.log('');
  console.log('='.repeat(60));
}
