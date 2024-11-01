import { EventbriteEvent } from '../types';
import { supabase } from './supabase/client';

// Session storage keys
const EVENT_CACHE_KEY = 'eventbrite_events';
const CACHE_DURATION = 5 * 60 * 1000; // 5 minutes
const MAX_RETRIES = 3;
const RETRY_DELAY = 1000; // 1 second

export class EventbriteApiError extends Error {
  constructor(
    public status: number,
    message: string,
    public details?: string
  ) {
    super(message);
    this.name = 'EventbriteApiError';
  }
}

interface CacheEntry {
  timestamp: number;
  data: EventbriteEvent[];
}

interface EventCache {
  [organizerId: string]: CacheEntry;
}

interface StructuredContent {
  modules: Array<{
    type: string;
    data: {
      body?: {
        text: string;
      };
      [key: string]: any;
    };
  }>;
}

function getEventCache(): EventCache {
  const cached = sessionStorage.getItem(EVENT_CACHE_KEY);
  return cached ? JSON.parse(cached) : {};
}

function setEventCache(cache: EventCache): void {
  sessionStorage.setItem(EVENT_CACHE_KEY, JSON.stringify(cache));
}

async function delay(ms: number): Promise<void> {
  return new Promise(resolve => setTimeout(resolve, ms));
}

async function fetchWithRetry<T>(
  url: string, 
  options: RequestInit = {}, 
  retries = MAX_RETRIES
): Promise<T> {
  try {
    const response = await fetch(url, options);

    if (!response.ok) {
      if (response.status === 401) {
        throw new EventbriteApiError(response.status, 'Invalid or expired API token');
      }
      if (response.status === 404) {
        return { events: [] } as T; // Return empty events for 404
      }
      if (response.status === 429) {
        if (retries > 0) {
          await delay(RETRY_DELAY);
          return fetchWithRetry(url, options, retries - 1);
        }
        throw new EventbriteApiError(
          response.status,
          'Rate limit exceeded',
          'Please try again later'
        );
      }
      if (response.status >= 500) {
        if (retries > 0) {
          await delay(RETRY_DELAY);
          return fetchWithRetry(url, options, retries - 1);
        }
        throw new EventbriteApiError(
          response.status,
          'Eventbrite service is temporarily unavailable',
          'Please try again later'
        );
      }

      const errorData = await response.json().catch(() => null);
      throw new EventbriteApiError(
        response.status,
        'Failed to fetch events',
        errorData?.error_description || await response.text()
      );
    }

    return response.json();
  } catch (error) {
    if (error instanceof EventbriteApiError) {
      throw error;
    }
    if (!navigator.onLine) {
      throw new EventbriteApiError(
        0,
        'No internet connection',
        'Please check your internet connection and try again'
      );
    }
    if (retries > 0) {
      await delay(RETRY_DELAY);
      return fetchWithRetry(url, options, retries - 1);
    }
    throw new EventbriteApiError(
      0,
      'Network error or service unavailable',
      error.message || 'Failed to fetch'
    );
  }
}

const EVENTBRITE_API_BASE = 'https://www.eventbriteapi.com/v3';
const EVENTBRITE_TOKEN = import.meta.env.VITE_EVENTBRITE_TOKEN;

async function fetchEventbrite<T>(endpoint: string): Promise<T> {
  const url = `${EVENTBRITE_API_BASE}${endpoint}${endpoint.includes('?') ? '&' : '?'}token=${EVENTBRITE_TOKEN}`;
  return fetchWithRetry<T>(url);
}

export async function getEventStructuredContent(eventId: string): Promise<string> {
  try {
    const response = await fetchEventbrite<StructuredContent>(`/events/${eventId}/structured_content/`);
    
    // Extract text content from all modules
    const textContent = response.modules
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
    console.error('Error fetching structured content:', error);
    return '';
  }
}

export async function getOrganizerEvents(organizerId: string): Promise<EventbriteEvent[]> {
  if (!organizerId?.trim()) {
    throw new EventbriteApiError(400, 'Organizer ID is required');
  }

  // Check session storage cache
  const cache = getEventCache();
  const cached = cache[organizerId];
  
  if (cached && Date.now() - cached.timestamp < CACHE_DURATION) {
    return cached.data;
  }

  try {
    // Get current date and date 6 months from now
    const now = new Date();
    const sixMonthsFromNow = new Date();
    sixMonthsFromNow.setMonth(sixMonthsFromNow.getMonth() + 6);
    
    // Format dates to match Eventbrite's expected format (ISO 8601)
    const startDate = now.toISOString().split('.')[0] + 'Z';
    const endDate = sixMonthsFromNow.toISOString().split('.')[0] + 'Z';
    
    const params = new URLSearchParams({
      status: 'live',
      order_by: 'start_asc',
      'start_date.range_start': startDate,
      'start_date.range_end': endDate,
      expand: 'venue,organizer'
    });

    // Try organization endpoint
    const response = await fetchEventbrite<{ events: EventbriteEvent[] }>(
      `/organizations/${organizerId}/events/?${params}`
    );

    const filteredEvents = response.events
      .filter(event => 
        event.status === 'live' && // Only live events
        event.listed !== false && // Only public events
        event.is_locked !== true // Not locked events
      )
      .sort((a, b) => new Date(a.start.utc).getTime() - new Date(b.start.utc).getTime());

    // Fetch structured content for each event
    const eventsWithContent = await Promise.all(
      filteredEvents.map(async (event) => {
        const structuredContent = await getEventStructuredContent(event.id);
        return {
          ...event,
          description: {
            ...event.description,
            text: structuredContent || event.description.text // Use structured content if available
          }
        };
      })
    );

    // Update cache
    cache[organizerId] = {
      data: eventsWithContent,
      timestamp: Date.now()
    };
    setEventCache(cache);
    
    return eventsWithContent;
  } catch (error) {
    console.error('Error fetching events for organizer:', {
      organizerId,
      error: {
        message: error instanceof EventbriteApiError ? error.message : 'Unknown error',
        details: error instanceof EventbriteApiError ? error.details : error.message
      }
    });
    
    // Return cached data if available, even if expired
    if (cached) {
      console.log('Using expired cache for organizer:', organizerId);
      return cached.data;
    }
    
    throw error;
  }
}

export async function getAllEvents(): Promise<EventbriteEvent[]> {
  try {
    // Get organizations from Supabase
    const { data: organizations, error } = await supabase
      .from('organizations')
      .select('id');

    if (error) throw error;
    
    const organizerIds = organizations.map(org => org.id);
    
    // Load events in parallel with error handling
    const eventPromises = organizerIds.map(id => 
      getOrganizerEvents(id)
        .catch(error => {
          console.error('Error fetching events for organizer:', {
            organizerId: id,
            error: {
              message: error instanceof EventbriteApiError ? error.message : 'Unknown error',
              details: error instanceof EventbriteApiError ? error.details : error.message
            }
          });
          return [];
        })
    );
    
    const results = await Promise.all(eventPromises);
    
    // Combine and sort all events
    return results
      .flat()
      .sort((a, b) => new Date(a.start.utc).getTime() - new Date(b.start.utc).getTime());
  } catch (error) {
    console.error('Error fetching organizations:', error);
    return [];
  }
}