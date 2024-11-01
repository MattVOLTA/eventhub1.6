import dotenv from 'dotenv';
import { createClient } from '@supabase/supabase-js';
import { delay } from '../src/utils/asyncUtils';

// Load environment variables
dotenv.config();

const SUPABASE_URL = process.env.VITE_SUPABASE_URL;
const SUPABASE_SERVICE_ROLE_KEY = process.env.VITE_SUPABASE_SERVICE_ROLE_KEY;
const OPENAI_API_KEY = process.env.VITE_OPENAI_API_KEY;

if (!SUPABASE_URL || !SUPABASE_SERVICE_ROLE_KEY || !OPENAI_API_KEY) {
  console.error('Missing required environment variables');
  process.exit(1);
}

// Initialize Supabase client with service role key
const supabase = createClient(SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY);

interface InterestAnalysis {
  [key: string]: string;
}

function cleanJsonString(str: string): string {
  // Remove markdown code block markers and any whitespace
  return str.replace(/```json\s*|\s*```/g, '').trim();
}

async function analyzeEventContent(
  name: string,
  description: string,
  summary: string | null
): Promise<InterestAnalysis> {
  try {
    const response = await fetch('https://api.openai.com/v1/chat/completions', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${OPENAI_API_KEY}`
      },
      body: JSON.stringify({
        model: 'gpt-4',
        messages: [
          {
            role: 'system',
            content: `You will be provided with the name and description of an event. Your task is to analyze this information and assign the most relevant interest areas from the following list. Each interest area is defined with a specific focus to ensure accurate categorization. Please include all relevant interest areas, as multiple may apply.

Interest Areas:
- Funding and Investment: Strategies for securing capital, understanding investor relations, and managing financial growth.
- Marketing and Sales: Techniques for market analysis, branding, customer acquisition, and revenue generation.
- Product Development: Processes for ideation, design, prototyping, and product lifecycle management.
- Technology and Innovation: Exploration of emerging technologies, digital transformation, and innovative business models.
- Leadership and Management: Development of leadership skills, team building, and organizational culture.
- Networking and Community: Opportunities for establishing partnerships, mentorship, and collaborative ventures.
- Legal and Compliance: Guidance on intellectual property, regulatory requirements, and legal frameworks.
- Operations and Scaling: Insights into operational efficiency, supply chain management, and scaling strategies.
- Diversity and Inclusion: Initiatives promoting equitable opportunities and diverse representation within the startup ecosystem.
- Sustainability Impact: Focus on environmentally sustainable practices and socially responsible entrepreneurship.
- Customer Experience: Strategies for enhancing user satisfaction and fostering long-term loyalty.
- Data Analytics: Utilizing data-driven insights to inform decision-making and optimize operations.
- Human Resources: Best practices for recruiting, developing, and retaining top talent.
- Global Expansion: Guidance on entering new markets and navigating international business landscapes.
- Crisis Management: Preparing for and responding to challenges to ensure business continuity.

Return your analysis in valid JSON format with interest names as keys and brief explanations as values.`
          },
          {
            role: 'user',
            content: `Event Name: "${name}"
Description: "${description}"
Summary: "${summary || ''}"`.trim()
          }
        ],
        temperature: 0.7,
        max_tokens: 500
      })
    });

    if (!response.ok) {
      const errorData = await response.json().catch(() => null);
      throw new Error(`OpenAI API error: ${response.status} - ${errorData?.error?.message || response.statusText}`);
    }

    const data = await response.json();
    if (!data.choices?.[0]?.message?.content) {
      throw new Error('Invalid response from OpenAI API');
    }

    const cleanedJson = cleanJsonString(data.choices[0].message.content);
    return JSON.parse(cleanedJson);
  } catch (error) {
    console.error('Error calling OpenAI API:', error);
    throw error;
  }
}

async function getInterestIdByName(name: string): Promise<number | null> {
  const { data, error } = await supabase
    .from('interests')
    .select('id')
    .eq('name', name)
    .single();

  if (error) {
    console.error(`Error finding interest: ${name}`, error);
    return null;
  }

  return data?.id || null;
}

async function updateEventInterests(
  eventId: string,
  interests: InterestAnalysis
): Promise<void> {
  // Get all interest IDs
  const interestIds: number[] = [];
  
  for (const interestName of Object.keys(interests)) {
    const id = await getInterestIdByName(interestName);
    if (id) interestIds.push(id);
  }

  if (interestIds.length === 0) {
    console.log(`No matching interests found for event ${eventId}`);
    return;
  }

  // Insert event-interest relationships
  const { error } = await supabase
    .from('event_interests')
    .insert(
      interestIds.map(interestId => ({
        event_id: eventId,
        interest_id: interestId
      }))
    );

  if (error) {
    throw new Error(`Failed to update interests for event ${eventId}: ${error.message}`);
  }
}

async function analyzeAllEvents() {
  try {
    console.log('Starting event interest analysis...');

    // First, get all event IDs that already have interests
    const { data: existingInterests, error: existingError } = await supabase
      .from('event_interests')
      .select('event_id');

    if (existingError) throw existingError;

    const existingEventIds = new Set(existingInterests?.map(ei => ei.event_id));

    // Get events without interests
    const { data: events, error: eventsError } = await supabase
      .from('events')
      .select('eventbrite_id, name, description, summary')
      .eq('status', 'live')
      .eq('listed', true)
      .eq('is_locked', false);

    if (eventsError) throw eventsError;

    // Filter out events that already have interests
    const eventsToAnalyze = events?.filter(event => !existingEventIds.has(event.eventbrite_id));

    if (!eventsToAnalyze || eventsToAnalyze.length === 0) {
      console.log('No events found that need interest analysis');
      process.exit(0);
    }

    console.log(`Found ${eventsToAnalyze.length} events to analyze`);

    for (const event of eventsToAnalyze) {
      try {
        console.log(`\nAnalyzing event: ${event.name}`);
        
        // Get interest analysis from OpenAI
        const analysis = await analyzeEventContent(
          event.name,
          event.description || '',
          event.summary
        );

        console.log('Identified interests:', Object.keys(analysis).join(', '));
        
        // Update event interests in database
        await updateEventInterests(event.eventbrite_id, analysis);
        
        console.log(`Successfully updated interests for event: ${event.eventbrite_id}`);
        
        // Add delay between API calls to avoid rate limits
        await delay(2000);
      } catch (error) {
        console.error(`Error processing event ${event.eventbrite_id}:`, error);
        // Add a longer delay if we hit an error
        await delay(5000);
      }
    }

    console.log('\nEvent interest analysis completed successfully!');
    process.exit(0);
  } catch (error) {
    console.error('Error during event analysis:', error);
    process.exit(1);
  }
}

// Run the analysis
analyzeAllEvents();