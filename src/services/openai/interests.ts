import { SYSTEM_PROMPT } from './config';
import { supabase } from '../supabase/client';

const OPENAI_API_KEY = import.meta.env.VITE_OPENAI_API_KEY;
const OPENAI_API_URL = 'https://api.openai.com/v1/chat/completions';

interface OpenAIResponse {
  choices: Array<{
    message: {
      content: string;
    };
  }>;
}

interface InterestAnalysis {
  [key: string]: string;
}

export async function analyzeEventInterests(
  eventId: string,
  eventName: string,
  eventDescription: string,
  eventSummary: string | null
): Promise<void> {
  try {
    if (!OPENAI_API_KEY) {
      throw new Error('OpenAI API key is not configured');
    }

    // Prepare the message for OpenAI
    const messages = [
      {
        role: 'system',
        content: SYSTEM_PROMPT
      },
      {
        role: 'user',
        content: `Event Name: "${eventName}"
Description: "${eventDescription}"
Summary: "${eventSummary || ''}"`.trim()
      }
    ];

    // Call OpenAI API
    const response = await fetch(OPENAI_API_URL, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${OPENAI_API_KEY}`
      },
      body: JSON.stringify({
        model: 'gpt-4',
        messages,
        temperature: 0.7,
        max_tokens: 500
      })
    });

    if (!response.ok) {
      throw new Error(`OpenAI API error: ${response.statusText}`);
    }

    const data: OpenAIResponse = await response.json();
    const analysisContent = data.choices[0]?.message?.content;

    if (!analysisContent) {
      throw new Error('No analysis received from OpenAI');
    }

    // Parse the JSON response
    const analysis: InterestAnalysis = JSON.parse(analysisContent);

    // Get all interests from Supabase
    const { data: interests, error: interestsError } = await supabase
      .from('interests')
      .select('id, name');

    if (interestsError) throw interestsError;

    // Map the analyzed interests to interest IDs
    const relevantInterestIds = interests
      .filter(interest => analysis[interest.name])
      .map(interest => interest.id);

    // Update event_interests table
    if (relevantInterestIds.length > 0) {
      const { error: insertError } = await supabase
        .from('event_interests')
        .upsert(
          relevantInterestIds.map(interestId => ({
            event_id: eventId,
            interest_id: interestId
          })),
          {
            onConflict: 'event_id,interest_id'
          }
        );

      if (insertError) throw insertError;
    }

    console.log(`Successfully analyzed and updated interests for event: ${eventId}`);
  } catch (error) {
    console.error('Error analyzing event interests:', error);
    throw error;
  }
}