export type Json =
  | string
  | number
  | boolean
  | null
  | { [key: string]: Json | undefined }
  | Json[]

export interface Database {
  public: {
    Tables: {
      events: {
        Row: {
          eventbrite_id: string
          created_at: string
          name: string
          description: string | null
          summary: string | null
          start_date: string
          end_date: string
          organizer_id: string
          organizer_name: string
          is_virtual: boolean
          is_free: boolean
          status: string
          listed: boolean
          is_locked: boolean
          venue_name: string | null
          venue_address: string | null
          venue_city: string | null
          venue_latitude: string | null
          venue_longitude: string | null
          url: string
          logo_url: string | null
        }
        Insert: {
          eventbrite_id: string
          created_at?: string
          name: string
          description?: string | null
          summary?: string | null
          start_date: string
          end_date: string
          organizer_id: string
          organizer_name: string
          is_virtual: boolean
          is_free: boolean
          status: string
          listed?: boolean
          is_locked?: boolean
          venue_name?: string | null
          venue_address?: string | null
          venue_city?: string | null
          venue_latitude?: string | null
          venue_longitude?: string | null
          url: string
          logo_url?: string | null
        }
      }
      interests: {
        Row: {
          id: number
          name: string
          slug: string
          description: string
          created_at: string
        }
        Insert: {
          id?: number
          name: string
          slug: string
          description: string
          created_at?: string
        }
      }
      event_interests: {
        Row: {
          event_id: string
          interest_id: number
          created_at: string
        }
        Insert: {
          event_id: string
          interest_id: number
          created_at?: string
        }
      }
      organizations: {
        Row: {
          id: string
          name: string
          created_at: string
        }
        Insert: {
          id: string
          name: string
          created_at?: string
        }
      }
    }
  }
}