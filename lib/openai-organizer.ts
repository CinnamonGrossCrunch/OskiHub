import { runAI } from './aiClient';

// Define proper TypeScript interfaces
interface ParsedItem {
  title: string;
  html: string;
}

interface ParsedSection {
  sectionTitle: string;
  items: ParsedItem[];
}

export interface OrganizedSection {
  sectionTitle: string;
  items: {
    title: string;
    html: string;
  }[];
}

export interface OrganizedNewsletter {
  sourceUrl: string;
  title?: string;
  sections: OrganizedSection[];
  aiDebugInfo?: {
    reasoning?: string;
    sectionDecisions?: string[];
    edgeCasesHandled?: string[];
    totalSections: number;
    processingTime: number;
  model?: string;
  modelsTried?: string[];
  modelLatency?: number;
  };
}

// In-memory cache disabled — KV cache handles freshness across invocations.
// On Vercel serverless, in-memory state persists unpredictably within a Lambda
// warm instance, causing stale newsletter data to survive across cron runs.

/**
 * Uses OpenAI to intelligently reorganize newsletter content into proper sections
 */
export async function organizeNewsletterWithAI(
  rawSections: ParsedSection[], 
  sourceUrl: string, 
  title?: string
): Promise<OrganizedNewsletter> {
  
  console.log('🤖 [AI] Starting newsletter AI organization...');
  console.log('🤖 [AI] Input sections:', rawSections.length);
  console.log('🤖 [AI] Source URL:', sourceUrl);
  
  // In-memory cache removed — KV handles caching at the API/cron layer
  
  if (!process.env.OPENAI_API_KEY) {
    console.warn('⚠️ [AI] OpenAI API key not found, falling back to original parsing');
    if (process.env.NODE_ENV === 'development') {
      console.warn('OpenAI API key not found, falling back to original parsing');
    }
    return {
      sourceUrl,
      title,
      sections: rawSections
    };
  }

  const startTime = Date.now();
  console.log('🤖 [AI] Start time:', new Date(startTime).toISOString());

  try {
    // Convert raw sections to HTML for AI processing - PRESERVE ALL HTML INCLUDING LINKS
    const rawContent = rawSections.map(section => {
      const items = section.items?.map((item: ParsedItem) => {
        // Send the actual HTML content to preserve hyperlinks
        return `${item.title}:\n${item.html}`;
      }).join('\n\n');
      
      return `[${section.sectionTitle}]\n${items}`;
    }).join('\n\n');

    console.log('🤖 [AI] Raw content length:', rawContent.length, 'characters');

    // Optimized, concise prompt
    const prompt = `Transform this UC Berkeley EWMBA newsletter into structured JSON format.

**CRITICAL RULES:**
1. Preserve ALL content - no truncation or summarization
2. Keep ALL hyperlinks intact with exact URLs - NEVER remove <a href> tags
3. Use existing section structure: "This Week", "Announcements", "Saturday Scoop", "Events", "Career Corner", "PO Tips and Tidbits"
4. Format headers with <h4> for titles, <h5> for subheadings
5. Use <ul>/<li> for lists, <p> for paragraphs
6. Convert bold text in paragraphs to normal weight (keep semantic headers only)

**OUTPUT FORMAT:**
{
  "sections": [
    {
      "sectionTitle": "Section Name",
      "items": [
        {
          "title": "Item Title",
          "html": "<h4>Item Title</h4><p>Content with <a href='url'>links</a></p>"
        }
      ]
    }
  ],
  "debugInfo": {
    "reasoning": "Brief explanation",
    "totalSections": ${rawSections.length}
  }
}

Return ONLY valid JSON, no markdown formatting.

Newsletter content:
${rawContent}`;

  const ai = await runAI({ prompt, reasoningEffort: 'minimal', verbosity: 'low', temperature: 0.1, maxOutputTokens: 8000 });
  const response = ai.text;
  
  console.log('🤖 [AI] AI response received');
  console.log('🤖 [AI] Model used:', ai.model);
  console.log('🤖 [AI] Models tried:', ai.modelsTried?.join(', ') || 'N/A');
  console.log('🤖 [AI] Latency:', ai.ms, 'ms');
  console.log('🤖 [AI] Response length:', response.length, 'characters');

    // Remove any markdown code blocks if present
    let cleanedResponse = response;
    if (cleanedResponse.startsWith('```json')) {
      cleanedResponse = cleanedResponse.slice(7);
    }
    if (cleanedResponse.startsWith('```')) {
      cleanedResponse = cleanedResponse.slice(3);
    }
    if (cleanedResponse.endsWith('```')) {
      cleanedResponse = cleanedResponse.slice(0, -3);
    }
    cleanedResponse = cleanedResponse.trim();

    // Parse AI response
    let organizedData: {
      sections: OrganizedSection[];
      debugInfo?: {
        reasoning?: string;
        sectionDecisions?: string[] | string;
        edgeCasesHandled?: string[];
        totalSections?: number;
        preservedHyperlinks?: string;
      };
    };
    
    try {
      organizedData = JSON.parse(cleanedResponse);
    } catch (parseError) {
      if (process.env.NODE_ENV === 'development') {
        console.error('❌ Failed to parse AI response:', parseError);
        console.error('🔍 Problematic response:', cleanedResponse.substring(0, 500));
      }
      throw new Error('Invalid JSON response from AI');
    }

    const processingTime = Date.now() - startTime;
    console.log('✅ [AI] AI processing completed in', processingTime, 'ms');
    console.log('✅ [AI] Organized sections:', organizedData.sections?.length || 0);
    // console.log(`⏱️ AI processing completed in ${processingTime}ms`);

    // Validate structure
  const result: OrganizedNewsletter = {
      sourceUrl,
      title,
      sections: organizedData.sections || [],
      aiDebugInfo: {
        reasoning: organizedData.debugInfo?.reasoning,
        sectionDecisions: Array.isArray(organizedData.debugInfo?.sectionDecisions) 
          ? organizedData.debugInfo.sectionDecisions 
          : organizedData.debugInfo?.sectionDecisions 
            ? [organizedData.debugInfo.sectionDecisions]
            : [],
        edgeCasesHandled: organizedData.debugInfo?.edgeCasesHandled,
        totalSections: organizedData.sections?.length || 0,
        processingTime,
        // attach minimal ai meta
        model: ai.model,
        modelsTried: ai.modelsTried,
        modelLatency: ai.ms
      }
    };

    // console.log('🎉 Newsletter organization completed successfully');
    // console.log('📋 Final result summary:', {
    //   sectionsCount: result.sections.length,
    //   hasDebugInfo: !!result.aiDebugInfo,
    //   processingTime: result.aiDebugInfo?.processingTime
    // });

    // In-memory cache removed — KV handles caching
    console.log('✅ [AI] Newsletter AI processing complete');

    return result;

  } catch (error) {
    console.error('❌ [AI] Error in AI organization:', error);
    console.error('❌ [AI] Error details:', {
      message: error instanceof Error ? error.message : 'Unknown error',
      stack: error instanceof Error ? error.stack : undefined,
      time: Date.now() - startTime + 'ms'
    });
    
    if (process.env.NODE_ENV === 'development') {
      console.error('💥 Error in AI organization:', error);
    }
    
    // Fallback: return original sections in organized format
    const fallbackSections: OrganizedSection[] = rawSections.map((section: ParsedSection) => ({
      sectionTitle: section.sectionTitle,
      items: section.items || []
    }));

    return {
      sourceUrl,
      title,
      sections: fallbackSections,
      aiDebugInfo: {
        reasoning: `AI processing failed: ${error instanceof Error ? error.message : 'Unknown error'}. Returning original sections.`,
        totalSections: fallbackSections.length,
        processingTime: Date.now() - startTime
      }
    };
  }
}
