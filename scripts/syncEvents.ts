import dotenv from 'dotenv';
import { createClient } from '@supabase/supabase-js';
import { organizations } from '../src/data/organizations';
import { delay } from '../src/utils/asyncUtils';

// Load environment variables first
dotenv.config();

const EVENTBRITE_TOKEN = process.env.VITE_EVENTBRITE_TOKEN;
const SUPABASE_URL = process.env.VITE_SUPABASE_URL;
const SUPABASE_SERVICE_ROLE_KEY = process.env.VITE_SUPABASE_SERVICE_ROLE_KEY;

if (!EVENTBRITE_TOKEN || !SUPABASE_URL || !SUPABASE_SERVICE_ROLE_KEY) {
  console.error('Missing required environment variables');
  process.exit(1);
}

// Initialize Supabase client with service role key for admin operations
const supabase = createClient(SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY);

// Test connection before proceeding
async function testConnection() {
  try {
    const { data, error } = await supabase
      .from('events')
      .select('count')
      .limit(1);
      
    if (error) throw error;
    console.log('Successfully connected to Supabase');
  } catch (error) {
    console.error('Failed to connect to Supabase:', error);
    process.exit(1);
  }
}

async function fetchEventbriteEvents(organizerId: string) {
  const now = new Date();
  const sixMonthsFromNow = new Date();
  sixMonthsFromNow.setMonth(sixMonthsFromNow.getMonth() + 6);
  
  const params = new URLSearchParams({
    order_by: 'start_asc',
    'start_date.range_start': now.toISOString().split('.')[0] + 'Z',
    'start_date.range_end': sixMonthsFromNow.toISOString().split('.')[0] + 'Z',
    expand: 'venue,organizer'
  });

  // Try organization endpoint first
  try {
    const orgResponse = await fetch(
      `https://www.eventbriteapi.com/v3/organizations/${organizerId}/events/?${params}`,
      {
        headers: {
          'Authorization': `Bearer ${EVENTBRITE_TOKEN}`
        }
      }
    );

    if (orgResponse.ok) {
      const data = await orgResponse.json();
      return data.events;
    }
  } catch (error) {
    console.log(`Organization endpoint failed for ${organizerId}, trying organizer endpoint...`);
  }

  // Try organizer endpoint if organization endpoint fails
  try {
    const organizerResponse = await fetch(
      `https://www.eventbriteapi.com/v3/organizers/${organizerId}/events/?${params}`,
      {
        headers: {
          'Authorization': `Bearer ${EVENTBRITE_TOKEN}`
        }
      }
    );

    if (organizerResponse.ok) {
      const data = await organizerResponse.json();
      return data.events;
    }

    throw new Error(`Both endpoints failed with status: ${organizerResponse.status}`);
  } catch (error) {
    throw error;
  }
}

async function fetchStructuredContent(eventId: string): Promise<string> {
  try {
    const response = await fetch(
      `https://www.eventbriteapi.com/v3/events/${eventId}/structured_content/`,
      {
        headers: {
          'Authorization': `Bearer ${EVENTBRITE_TOKEN}`
        }
      }
    );

    if (!response.ok) {
      return '';
    }

    const data = await response.json();
    
    // Extract text content from all modules
    const textContent = data.modules
      .map(module => {
        if (module.type === 'text' && module.data.body) {
          return module.data.body.text;
        }
        return '';
      })
      .filter(text => text.length > 0)
      .join('\n\n');

    return textContent;
  } catch (error) {
    console.error(`Error fetching structured content for event ${eventId}:`, error);
    return '';
  }
}

async function syncInitialEvents() {
  try {
    // Test connection first
    await testConnection();
    
    console.log('Starting initial event sync...');
    
    // Get organizer IDs
    const organizerIds = organizations.map(org => org.id);
    console.log(`Found ${organizerIds.length} organizations to process`);

    // Process each organizer with delay to avoid rate limits
    let allEvents = [];
    for (const id of organizerIds) {
      const org = organizations.find(o => o.id === id);
      console.log(`Fetching events for ${org?.name}...`);
      
      try {
        const events = await fetchEventbriteEvents(id);
        
        // Fetch structured content for each event
        const eventsWithContent = await Promise.all(
          events.map(async (event) => {
            const summary = await fetchStructuredContent(event.id);
            return { ...event, summary };
          })
        );
        
        allEvents.push(...eventsWithContent);
        console.log(`Retrieved ${events.length} events for ${org?.name}`);
        
        // Delay between organizations to avoid rate limits
        await delay(2000);
      } catch (error) {
        console.error(`Error fetching events for ${org?.name}:`, error);
      }
    }

    console.log(`Total events retrieved: ${allEvents.length}`);

    if (allEvents.length === 0) {
      console.log('No events found to sync');
      process.exit(0);
    }

    // Transform events for Supabase
    const transformedEvents = allEvents.map(event => ({
      eventbrite_id: event.id,
      name: event.name.text,
      description: event.description.text,
      summary: event.summary || null,  // Add the summary field
      start_date: event.start.local,
      end_date: event.end.local,
      organizer_id: event.organizer_id,
      organizer_name: event.organizer.name,
      is_virtual: event.online_event,
      is_free: event.is_free,
      status: event.status,
      listed: event.listed !== false,
      is_locked: event.is_locked === true,
      venue_name: event.venue?.name || null,
      venue_address: event.venue?.address?.localized_address_display || null,
      venue_city: event.venue?.address?.city || null,
      venue_latitude: event.venue?.latitude || null,
      venue_longitude: event.venue?.longitude || null,
      url: event.url,
      logo_url: event.logo?.url || null
    }));

    // Insert events in batches
    const batchSize = 10;
    console.log('Syncing events to Supabase...');
    
    for (let i = 0; i < transformedEvents.length; i += batchSize) {
      const batch = transformedEvents.slice(i, i + batchSize);
      console.log(`Processing batch ${Math.floor(i/batchSize) + 1} of ${Math.ceil(transformedEvents.length/batchSize)}`);
      
      try {
        const { error } = await supabase
          .from('events')
          .upsert(batch, {
            onConflict: 'eventbrite_id',
            ignoreDuplicates: false
          });

        if (error) {
          console.error('Error inserting batch:', error);
          continue;
        }

        console.log(`Successfully inserted batch ${Math.floor(i/batchSize) + 1}`);

        // Small delay between batches
        if (i + batchSize < transformedEvents.length) {
          await delay(500);
        }
      } catch (error) {
        console.error('Error processing batch:', error);
      }
    }
    
    console.log('Initial sync completed successfully!');
    process.exit(0);
  } catch (error) {
    console.error('Error during initial sync:', error);
    process.exit(1);
  }
}

// Run the sync
syncInitialEvents();