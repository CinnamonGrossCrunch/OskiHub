import { NextResponse } from 'next/server';
import fs from 'fs';
import path from 'path';
import matter from 'gray-matter';
import { marked } from 'marked';

export const dynamic = 'force-dynamic';
export const revalidate = 0;

// Configure marked options for better rendering
marked.setOptions({
  breaks: true, // Convert \n to <br>
  gfm: true, // Enable GitHub Flavored Markdown
});

// Helper function to convert plain text tables to markdown tables
function convertPlainTextTables(content: string): string {
  // Pattern: "Schedule of Cases:" followed by Date/Team/Case headers with data rows
  // This is a common pattern in newsletters
  const tablePattern = /(Schedule of Cases:)\s*\n\s*-?\s*\n+\s*(Date)\s*\n+\s*(Team)\s*\n+\s*(Case)\s*\n+((?:\s*\d+\/\d+\s*\n+\s*\d+\s*\n+\s*[^\n]+\s*\n+)+)/gi;
  
  return content.replace(tablePattern, (match, title, col1, col2, col3, data) => {
    // Start building markdown table
    let mdTable = `${title}\n\n| ${col1} | ${col2} | ${col3} |\n|------|------|------|\n`;
    
    // Parse data rows - each row has 3 lines (date, team, case)
    const lines = data.split('\n').map((l: string) => l.trim()).filter((l: string) => l.length > 0);
    
    // Group every 3 lines into a row
    for (let i = 0; i < lines.length; i += 3) {
      if (i + 2 < lines.length) {
        const date = lines[i];
        const team = lines[i + 1];
        const caseName = lines[i + 2];
        mdTable += `| ${date} | ${team} | ${caseName} |\n`;
      }
    }
    
    return mdTable + '\n';
  });
}

// Helper function to convert first two lines to headers
function convertFirstLinesToHeaders(content: string): string {
  // Split into lines
  const lines = content.split('\n');
  
  // Find first two non-empty lines
  let firstLineIndex = -1;
  let secondLineIndex = -1;
  
  for (let i = 0; i < lines.length; i++) {
    const trimmed = lines[i].trim();
    if (trimmed.length > 0) {
      if (firstLineIndex === -1) {
        firstLineIndex = i;
      } else if (secondLineIndex === -1) {
        secondLineIndex = i;
        break;
      }
    }
  }
  
  // Convert first line to H3 and second line to H2
  if (firstLineIndex !== -1 && secondLineIndex !== -1) {
    lines[firstLineIndex] = `### ${lines[firstLineIndex].trim()}`;
    lines[secondLineIndex] = `## ${lines[secondLineIndex].trim()}`;
  }
  
  return lines.join('\n');
}

export async function GET() {
  try {
    const newslettersDir = path.join(process.cwd(), 'content', 'newsletters');
    
    // Check if directory exists
    if (!fs.existsSync(newslettersDir)) {
      return NextResponse.json({ 
        newsletters: [],
        message: 'Newsletters directory does not exist yet'
      });
    }

    // Read all markdown files. Exclude Google Apps Script failure
    // notifications ("Summary of failures for Google Apps Script: ..."):
    // those are error reports from the newsletter dispatchers themselves,
    // not newsletters, but the Blue Crew dispatcher has committed them as
    // newsletter files in the past. Never serve them.
    const files = fs.readdirSync(newslettersDir)
      .filter(file => file.endsWith('.md'))
      .filter(file => !file.includes('summary-of-failures-for-google-apps-script'))
      .sort()
      .reverse(); // Most recent first

    // Parse each file
    const newsletters = files.map(filename => {
      const filePath = path.join(newslettersDir, filename);
      const fileContents = fs.readFileSync(filePath, 'utf8');
      
      // Parse frontmatter and content
      const { data, content } = matter(fileContents);
      
      // Pre-process content before markdown conversion
      let processedContent = content.trim();
      
      // Remove excessive indentation that causes markdown to treat text as code blocks
      // Replace 4+ spaces at the start of lines with 2 spaces (keeps list structure but prevents code blocks)
      processedContent = processedContent.replace(/^[ \t]{4,}/gm, '  ');
      
      // Convert first two lines to H3 and H2
      processedContent = convertFirstLinesToHeaders(processedContent);
      
      // Convert plain text tables to markdown tables
      processedContent = convertPlainTextTables(processedContent);
      
      // Remove Gmail reply/forward chains - everything after "On [date] at [time] [name] wrote:"
      // This removes embedded previous emails that appear in forwarded messages
      // Pattern matches: "On Sun, Nov 16, 2025 at 2:25 PM Stetson Michael Ackley <email> wrote:"
      processedContent = processedContent.replace(
        /\s*On\s+\w+,\s+\w+\s+\d+,\s+\d+\s+at\s+[\s\S]*/i,
        ''
      );
      
      // Remove all emojis
      // This regex matches all emoji ranges comprehensively
      processedContent = processedContent.replace(
        /[\u{1F300}-\u{1F9FF}\u{1FA00}-\u{1FAFF}\u{2600}-\u{27BF}\u{2300}-\u{23FF}\u{2B50}\u{2934}-\u{2935}\u{3030}\u{3297}\u{3299}\u{FE00}-\u{FE0F}\u{1F000}-\u{1F02F}\u{1F0A0}-\u{1F0FF}\u{1F100}-\u{1F64F}\u{1F680}-\u{1F6FF}\u{1F910}-\u{1F96B}\u{1F980}-\u{1F9E0}]/gu,
        ''
      );
      
      // Also remove common text-based emoji representations
      processedContent = processedContent.replace(/[\u{2702}-\u{27B0}]/gu, '');
      processedContent = processedContent.replace(/[\u{1F1E0}-\u{1F1FF}]/gu, ''); // flags
      
      // Remove HTML emoji images from Gmail (e.g., Google's notoemoji images)
      processedContent = processedContent.replace(
        /<img[^>]*?(?:notoemoji|emoji)[^>]*?>/gi,
        ''
      );
      
      // Remove broken image references like [image: image.png] completely
      processedContent = processedContent.replace(
        /\[image:\s*([^\]]+)\]/gi,
        ''
      );
      
      // Convert markdown to HTML
      const htmlContent = marked.parse(processedContent);
      
      return {
        filename,
        title: data.title || filename.replace('.md', ''),
        date: data.date || 'Unknown date',
        source: data.source || 'gmail',
        content: htmlContent,
      };
    });

    // Belt and braces: also drop failure notifications by title, in case one
    // ever lands under a differently-shaped filename.
    const visibleNewsletters = newsletters.filter(
      (n) => !/summary of failures for google apps script/i.test(n.title)
    );

    return NextResponse.json({
      newsletters: visibleNewsletters,
      count: visibleNewsletters.length,
    });

  } catch (error) {
    console.error('Error reading Gmail newsletters:', error);
    return NextResponse.json(
      { 
        error: 'Failed to fetch newsletters',
        details: error instanceof Error ? error.message : 'Unknown error'
      },
      { status: 500 }
    );
  }
}
