// BACKUP OF INTERACTIVE ELEMENTS FUNCTIONALITY
// Created: 2025-01-15
// This file contains the code for interactive elements that was temporarily disabled
// To re-enable: Copy analyzeForInteractiveElements function and the STAGE 2 calls back into index.ts

/**
 * STAGE 2: Interactive Elements Analyzer (Cheap Model)
 * 
 * This function analyzes the generated answer and suggests interactive UI components
 * to enhance the user experience (e.g., checklists, buttons, feedback forms)
 */
export async function analyzeForInteractiveElements(
  answerText: string,
  originalQuestion: string,
  context: { isWeak: boolean; hasFigures: boolean },
  openaiApiKey: string,
  openaiProjectId?: string
): Promise<{ interactive_components: any[] }> {
  
  const systemPrompt = `You are an interactive component selector for a troubleshooting chatbot.

Given a troubleshooting answer, determine which interactive UI elements would enhance the user experience.

Available components:
- button_group: For multiple choice actions (e.g., "Did this help?" with Yes/No buttons)
- checklist: For step-by-step procedures
- button: For single actions (e.g., "Show wiring diagram")
- input: For collecting user input (measurements, part numbers, etc.)
- select: For dropdown choices
- form: For multi-field data collection
- progress: For multi-step processes
- status: For success/warning/error states
- code: For technical values or settings
- slider: For adjustable values

Return JSON with this exact structure:
{
  "interactive_components": [
    {
      "type": "button_group",
      "id": "feedback",
      "data": {
        "title": "Did this help?",
        "buttons": [
          { "label": "Yes", "variant": "default", "autoSendMessage": "Yes, that helped" },
          { "label": "No", "variant": "outline", "autoSendMessage": "No, still need help" }
        ]
      }
    },
    {
      "type": "checklist",
      "id": "steps",
      "data": {
        "title": "Follow these steps",
        "items": [
          { "label": "Step 1: Check power", "checked": false },
          { "label": "Step 2: Test voltage", "checked": false }
        ]
      }
    }
  ]
}

Rules:
- CRITICAL: Each component MUST have an "id" field and a "data" object (not "props")
- For button_group: include "title" in data and "autoSendMessage" in each button
- Only add components that genuinely enhance the answer
- Don't add components just for the sake of it
- Maximum 2-3 components per answer
- If no components would help, return empty array
- For multi-step procedures, always use checklist
- For feedback questions, use button_group with autoSendMessage
- Keep labels concise and actionable`;

  const userPrompt = `Original Question: ${originalQuestion}

Answer Generated:
${answerText}

Context:
- Retrieval quality: ${context.isWeak ? 'weak' : 'strong'}
- Contains figures: ${context.hasFigures}

Analyze this answer and determine which interactive components would enhance it.`;

  try {
    // Use gpt-4o-mini for interactive component analysis
    const response = await fetch('https://api.openai.com/v1/chat/completions', {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${openaiApiKey}`,
        'Content-Type': 'application/json',
        ...(openaiProjectId && { 'OpenAI-Project': openaiProjectId }),
      },
      body: JSON.stringify({
        model: 'gpt-4o-mini',
        messages: [
          { role: 'system', content: systemPrompt },
          { role: 'user', content: userPrompt }
        ],
        response_format: { type: 'json_object' },
        max_tokens: 1000,
        stream: false
      })
    });

    if (!response.ok) {
      console.error('❌ Error in interactive elements analysis:', response.status);
      return { interactive_components: [] };
    }

    const data = await response.json();
    const contentText = data.choices?.[0]?.message?.content;
    
    if (!contentText) {
      console.error('❌ Empty content from interactive elements analysis');
      return { interactive_components: [] };
    }
    
    const result = JSON.parse(contentText);
    
    console.log(`✅ Generated ${result.interactive_components?.length || 0} interactive components`);
    return result;
  } catch (error) {
    console.error('❌ Error in analyzeForInteractiveElements:', error);
    return { interactive_components: [] };
  }
}

// USAGE INSTRUCTIONS:
// 
// In runRagPipelineV3 function, add this after STAGE 1 (answer generation):
//
//   // STAGE 2: Analyze answer and add interactive elements with cheap model
//   console.log(`🎨 STAGE 2: Analyzing for interactive elements with gpt-4o-mini`);
//   const elementsResult = await analyzeForInteractiveElements(
//     answer as string, // Type assertion since stream is false
//     query,
//     {
//       isWeak: weak,
//       hasFigures: (figureResults?.length ?? 0) > 0
//     },
//     openaiApiKey,
//     openaiProjectId
//   );
//
//   console.log(`✅ [RAG V3] Pipeline complete - added ${elementsResult.interactive_components.length} interactive components\n`);
//
// Then merge the result:
//   return {
//     answer,
//     citations,
//     ...sources,
//     interactive_components: elementsResult.interactive_components, // Add this line
//     ...metadata
//   };
