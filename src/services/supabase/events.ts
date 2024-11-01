import { supabase } from './client';
import type { EventbriteEvent } from '../../types';
import { organizations } from '../../data/organizations';
import { getAllEvents } from '../eventbriteApi';

export async function syncEventsToSupabase(events: EventbriteEvent[]): Promise<void> {
  try {
    // Transform events to match Supabase schema
    const transformedEvents = events
      .filter(event => event.status === 'live') // Only sync live events
      .map(event => ({
        eventbrite_id: event.id,
        name: event.name.text,
        description: event.description.text,
        start_date: event.start.local,
        end_date: event.end.local,
        organizer_id: event.organizer_id,
        organizer_name: event.organizer.name,
        is_virtual: event.online_event,
        is_free: event.is_free,
        status: event.status,
        venue_name: event.venue?.name || null,
        venue_address: event.venue?.address?.localized_address_display || null,
        venue_city: event.venue?.address?.city || null,
        venue_latitude: event.venue?.latitude || null,
        venue_longitude: event.venue?.longitude || null,
        url: event.url,
        logo_url: event.logo?.url || null
      }));

    // Process events in batches to avoid timeouts
    const batchSize = 50;
    for (let i = 0; i < transformedEvents.length; i += batchSize) {
      const batch = transformedEvents.slice(i, i + batchSize);
      
      // Use upsert with eventbrite_id as the conflict target
      const { error } = await supabase
        .from('events')
        .upsert(
          batch,
          { 
            onConflict: 'eventbrite_id',
            ignoreDuplicates: false
          }
        );

      if (error) throw error;
      
      // Small delay between batches
      if (i + batchSize < transformedEvents.length) {
        await new Promise(resolve => setTimeout(resolve, 100));
      }
    }
  } catch (error) {
    console.error('Error syncing events to Supabase:', error);
    throw error;
  }
}

export async function getEventsFromSupabase(): Promise<EventbriteEvent[]> {
  try {
    const { data, error } = await supabase
      .from('events')
      .select('*')
      .eq('status', 'live') // Only get live events
      .gte('end_date', new Date().toISOString())
      .order('start_date', { ascending: true });

    if (error) throw error;

    return (data || []).map(event => ({
      id: event.eventbrite_id,
      name: { text: event.name, html: '' },
      description: { text: event.description || '', html: '' },
      start: { local: event.start_date, utc: '', timezone: '' },
      end: { local: event.end_date, utc: '', timezone: '' },
      url: event.url,
      status: event.status,
      online_event: event.is_virtual,
      is_free: event.is_free,
      organizer_id: event.organizer_id,
      organizer: {
        id: event.organizer_id,
        name: event.organizer_name,
        description: { text: '', html: '' },
        logo_id: null,
        logo: null
      },
      venue: event.venue_name ? {
        id: '',
        name: event.venue_name,
        address: {
          localized_address_display: event.venue_address || '',
          city: event.venue_city || '',
          address_1: '',
          address_2: null,
          region: '',
          postal_code: '',
          country: '',
          localized_area_display: ''
        },
        latitude: event.venue_latitude || '',
        longitude: event.venue_longitude || ''
      } : undefined,
      logo: event.logo_url ? { url: event.logo_url } : undefined
    }));
  } catch (error) {
    console.error('Error getting events from Supabase:', error);
    return [];
  }
}

// Function to manually trigger a sync
export async function syncAllEvents(): Promise<void> {
  try {
    // Get all organizer IDs from our configuration
    const organizerIds = organizations.map(org => org.id);
    
    // Fetch events from Eventbrite
    const events = await getAllEvents(organizerIds);
    
    // Sync to Supabase
    await syncEventsToSupabase(events);
    
    console.log(`Successfully synced ${events.length} events to Supabase`);
  } catch (error) {
    console.error('Error during full sync:', error);
    throw error;
  }
}