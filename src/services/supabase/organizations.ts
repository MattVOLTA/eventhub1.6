import { supabase } from './client';

export interface Organization {
  id: string;
  name: string;
}

export async function getOrganizations(): Promise<Organization[]> {
  try {
    const { data, error } = await supabase
      .from('organizations')
      .select('*')
      .order('name');

    if (error) throw error;
    return data || [];
  } catch (error) {
    console.error('Error fetching organizations:', error);
    return [];
  }
}