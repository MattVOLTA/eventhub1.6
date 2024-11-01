import { useState, useEffect, useMemo } from 'react';
import { AlertCircle, RefreshCw, Loader2 } from 'lucide-react';
import { EventCard } from '../components/EventCard';
import { CalendarView } from '../components/CalendarView';
import { OrgFilter } from '../components/OrgFilter';
import { LocationFilter } from '../components/LocationFilter';
import { EventTypeFilter } from '../components/EventTypeFilter';
import { InterestFilter } from '../components/InterestFilter';
import { supabase } from '../services/supabase/client';
import type { EventbriteEvent } from '../types';

interface EventsPageProps {
  viewMode: 'list' | 'calendar';
  searchTerm: string;
  calendarType: 'month' | 'week';
  onCalendarTypeChange: (type: 'month' | 'week') => void;
  selectedLocations: string[];
  onLocationChange: (locations: string[]) => void;
  eventFilter: 'all' | 'virtual' | 'in-person';
  onEventFilterChange: (filter: 'all' | 'virtual' | 'in-person') => void;
}

export function EventsPage({ 
  viewMode, 
  searchTerm,
  calendarType,
  onCalendarTypeChange,
  selectedLocations,
  onLocationChange,
  eventFilter,
  onEventFilterChange
}: EventsPageProps) {
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [events, setEvents] = useState<EventbriteEvent[]>([]);
  const [organizations, setOrganizations] = useState<Array<{ id: string; name: string }>>([]);
  const [selectedOrgs, setSelectedOrgs] = useState<string[]>([]);
  const [selectedEventTypes, setSelectedEventTypes] = useState<('virtual' | 'in-person')[]>(['virtual', 'in-person']);
  const [interests, setInterests] = useState<Array<{ id: number; name: string }>>([]);
  const [selectedInterests, setSelectedInterests] = useState<number[]>([]);
  const [eventInterests, setEventInterests] = useState<{ [eventId: string]: number[] }>({});

  // Calculate locations from filtered events
  const locations = useMemo(() => {
    return [...new Set(events
      .filter(event => !event.online_event && event.venue?.address?.city)
      .map(event => event.venue!.address.city)
    )].sort();
  }, [events]);

  // Calculate event counts for virtual and in-person events
  const eventCounts = useMemo(() => {
    const filteredByOrg = events.filter(event => selectedOrgs.includes(event.organizer_id));
    const filteredByLocation = filteredByOrg.filter(event => {
      if (event.online_event) return true;
      if (!event.venue?.address?.city) return false;
      return selectedLocations.includes(event.venue.address.city);
    });

    return {
      virtual: filteredByLocation.filter(event => event.online_event).length,
      inPerson: filteredByLocation.filter(event => !event.online_event).length
    };
  }, [events, selectedOrgs, selectedLocations]);

  useEffect(() => {
    async function loadData() {
      try {
        setLoading(true);

        // Load organizations first
        const { data: orgsData, error: orgsError } = await supabase
          .from('organizations')
          .select('*')
          .order('name');

        if (orgsError) throw orgsError;
        setOrganizations(orgsData);
        setSelectedOrgs(orgsData.map(org => org.id));

        // Load interests
        const { data: interestsData, error: interestsError } = await supabase
          .from('interests')
          .select('id, name')
          .order('name');

        if (interestsError) throw interestsError;
        setInterests(interestsData);
        setSelectedInterests(interestsData.map(interest => interest.id));

        // Load event interests
        const { data: eventInterestsData, error: eventInterestsError } = await supabase
          .from('event_interests')
          .select('event_id, interest_id');

        if (eventInterestsError) throw eventInterestsError;

        // Transform event interests into a lookup object
        const interestLookup = eventInterestsData.reduce((acc, { event_id, interest_id }) => {
          if (!acc[event_id]) {
            acc[event_id] = [];
          }
          acc[event_id].push(interest_id);
          return acc;
        }, {} as { [eventId: string]: number[] });

        setEventInterests(interestLookup);

        // Then load events
        const { data: eventsData, error: eventsError } = await supabase
          .from('events')
          .select('*')
          .eq('status', 'live')
          .eq('listed', true)
          .eq('is_locked', false)
          .gte('end_date', new Date().toISOString())
          .order('start_date', { ascending: true });

        if (eventsError) throw eventsError;

        // Transform Supabase data to EventbriteEvent format
        const transformedEvents = eventsData.map(event => ({
          id: event.eventbrite_id,
          name: { text: event.name, html: '' },
          description: { text: event.description || '', html: '' },
          start: { local: event.start_date, utc: '', timezone: '' },
          end: { local: event.end_date, utc: '', timezone: '' },
          url: event.url,
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
              city: event.venue_city || '',
              localized_address_display: event.venue_address || '',
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

        setEvents(transformedEvents);

        // Initialize locations
        const initialLocations = [...new Set(transformedEvents
          .filter(event => !event.online_event && event.venue?.address?.city)
          .map(event => event.venue!.address.city)
        )].sort();
        onLocationChange(initialLocations);

        setError(null);
      } catch (err) {
        setError(err instanceof Error ? err.message : 'Failed to load data');
      } finally {
        setLoading(false);
      }
    }

    loadData();
  }, [onLocationChange]);

  const handleRetry = () => {
    setLoading(true);
    setError(null);
    
    const loadData = async () => {
      try {
        const { data: orgsData, error: orgsError } = await supabase
          .from('organizations')
          .select('*')
          .order('name');

        if (orgsError) throw orgsError;
        setOrganizations(orgsData);
        setSelectedOrgs(orgsData.map(org => org.id));

        const { data: eventsData, error: eventsError } = await supabase
          .from('events')
          .select('*')
          .eq('status', 'live')
          .eq('listed', true)
          .eq('is_locked', false)
          .gte('end_date', new Date().toISOString())
          .order('start_date', { ascending: true });

        if (eventsError) throw eventsError;

        const transformedEvents = eventsData.map(event => ({
          id: event.eventbrite_id,
          name: { text: event.name, html: '' },
          description: { text: event.description || '', html: '' },
          start: { local: event.start_date, utc: '', timezone: '' },
          end: { local: event.end_date, utc: '', timezone: '' },
          url: event.url,
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
              city: event.venue_city || '',
              localized_address_display: event.venue_address || '',
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

        setEvents(transformedEvents);
        setError(null);
      } catch (err) {
        setError(err instanceof Error ? err.message : 'Failed to load data');
      } finally {
        setLoading(false);
      }
    };

    loadData();
  };

  const getOrganizerName = (eventId: string) => {
    const event = events.find(e => e.id === eventId);
    return event?.organizer.name || 'Unknown Organization';
  };

  const filteredEvents = events
    .filter(event => {
      // Filter by selected organizations
      return selectedOrgs.includes(event.organizer_id);
    })
    .filter(event => {
      // Filter by selected interests
      if (selectedInterests.length === interests.length) return true; // Show all if all interests selected
      const eventInterestIds = eventInterests[event.id] || [];
      return eventInterestIds.some(id => selectedInterests.includes(id));
    })
    .filter(event => {
      // Filter by selected event types
      if (selectedEventTypes.includes('virtual') && event.online_event) return true;
      if (selectedEventTypes.includes('in-person') && !event.online_event) return true;
      return false;
    })
    .filter(event => {
      // Filter by selected locations
      if (event.online_event) return true;
      if (!event.venue?.address?.city) return false;
      return selectedLocations.includes(event.venue.address.city);
    })
    .filter(event => {
      // Filter by search term
      if (!searchTerm) return true;
      const searchLower = searchTerm.toLowerCase();
      return (
        event.name.text.toLowerCase().includes(searchLower) ||
        event.description.text.toLowerCase().includes(searchLower) ||
        (event.venue?.name?.toLowerCase().includes(searchLower)) ||
        (event.venue?.address?.city?.toLowerCase().includes(searchLower))
      );
    });

  return (
    <div className="space-y-6">
      <div className="flex flex-col lg:flex-row justify-between gap-4">
        <div className="flex flex-col sm:flex-row items-start sm:items-center gap-4">
          <div className="w-full sm:w-72">
            <OrgFilter
              organizers={organizations}
              selectedOrgs={selectedOrgs}
              onChange={setSelectedOrgs}
            />
          </div>
          {locations.length > 0 && (
            <div className="w-full sm:w-72">
              <LocationFilter
                locations={locations}
                selectedLocations={selectedLocations}
                onChange={onLocationChange}
              />
            </div>
          )}
          <div className="w-full sm:w-72">
            <EventTypeFilter
              selectedTypes={selectedEventTypes}
              onChange={setSelectedEventTypes}
              virtualCount={eventCounts.virtual}
              inPersonCount={eventCounts.inPerson}
            />
          </div>
          <div className="w-full sm:w-72">
            <InterestFilter
              interests={interests}
              selectedInterests={selectedInterests}
              onChange={setSelectedInterests}
            />
          </div>
        </div>
      </div>

      {loading ? (
        <div className="text-center py-12">
          <Loader2 className="h-12 w-12 animate-spin mx-auto text-white" />
          <p className="mt-4 text-white">Loading events...</p>
        </div>
      ) : error ? (
        <div className="bg-red-50 border-l-4 border-red-400 p-4 rounded-md">
          <div className="flex items-center justify-between">
            <div className="flex items-center">
              <AlertCircle className="h-5 w-5 text-red-400 mr-2" />
              <p className="text-red-700">{error}</p>
            </div>
            <button
              onClick={handleRetry}
              className="flex items-center px-3 py-1 text-sm text-red-700 hover:bg-red-100 rounded-md transition-colors"
            >
              <RefreshCw className="h-4 w-4 mr-1" />
              Retry
            </button>
          </div>
        </div>
      ) : filteredEvents.length > 0 ? (
        viewMode === 'list' ? (
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
            {filteredEvents.map((event) => (
              <EventCard 
                key={event.id} 
                event={event} 
                organizerName={getOrganizerName(event.id)}
              />
            ))}
          </div>
        ) : (
          <CalendarView 
            events={filteredEvents}
            getOrganizerName={getOrganizerName}
          />
        )
      ) : (
        <div className="text-center py-12 bg-white/10 backdrop-blur-sm rounded-lg shadow">
          <p className="text-white">No events found matching your criteria</p>
        </div>
      )}
    </div>
  );
}