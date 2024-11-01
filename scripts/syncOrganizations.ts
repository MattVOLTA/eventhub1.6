import dotenv from 'dotenv';
import { createClient } from '@supabase/supabase-js';
import { organizations } from '../src/data/organizations';

// Load environment variables
dotenv.config();

const SUPABASE_URL = process.env.VITE_SUPABASE_URL;
const SUPABASE_SERVICE_ROLE_KEY = process.env.VITE_SUPABASE_SERVICE_ROLE_KEY;

if (!SUPABASE_URL || !SUPABASE_SERVICE_ROLE_KEY) {
  console.error('Missing required environment variables');
  process.exit(1);
}

// Initialize Supabase client with service role key
const supabase = createClient(SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY);

async function syncOrganizations() {
  try {
    console.log('Starting organizations sync...');

    // Transform organizations for Supabase
    const transformedOrgs = organizations.map(org => ({
      id: org.id,
      name: org.name
    }));

    // Insert organizations
    const { error } = await supabase
      .from('organizations')
      .upsert(transformedOrgs, {
        onConflict: 'id',
        ignoreDuplicates: false
      });

    if (error) {
      throw error;
    }

    console.log(`Successfully synced ${transformedOrgs.length} organizations to Supabase`);
    process.exit(0);
  } catch (error) {
    console.error('Error during organizations sync:', error);
    process.exit(1);
  }
}

// Run the sync
syncOrganizations();