import { supabase } from './client';

export interface Interest {
  id: number;
  name: string;
  slug: string;
  description: string;
}

export async function getInterests(): Promise<Interest[]> {
  try {
    const { data, error } = await supabase
      .from('interests')
      .select('*')
      .order('name');

    if (error) throw error;
    return data || [];
  } catch (error) {
    console.error('Error fetching interests:', error);
    return [];
  }
}

export async function getEventInterests(eventId: string): Promise<Interest[]> {
  try {
    const { data, error } = await supabase
      .from('event_interests')
      .select(`
        interest_id,
        interests (
          id,
          name,
          slug,
          description
        )
      `)
      .eq('event_id', eventId);

    if (error) throw error;
    return data?.map(row => row.interests) || [];
  } catch (error) {
    console.error('Error fetching event interests:', error);
    return [];
  }
}

export async function updateEventInterests(eventId: string, interestIds: number[]): Promise<void> {
  try {
    // First, delete existing interests for this event
    const { error: deleteError } = await supabase
      .from('event_interests')
      .delete()
      .eq('event_id', eventId);

    if (deleteError) throw deleteError;

    // Then insert new interests
    if (interestIds.length > 0) {
      const { error: insertError } = await supabase
        .from('event_interests')
        .insert(
          interestIds.map(interestId => ({
            event_id: eventId,
            interest_id: interestId
          }))
        );

      if (insertError) throw insertError;
    }
  } catch (error) {
    console.error('Error updating event interests:', error);
    throw error;
  }
}