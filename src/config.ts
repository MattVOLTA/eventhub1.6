export const EVENTBRITE_TOKEN = import.meta.env.VITE_EVENTBRITE_TOKEN;
export const EVENTBRITE_API_BASE = 'https://www.eventbriteapi.com/v3';

export interface EventbriteConfig {
  token: string;
  apiBase: string;
}

export const config: EventbriteConfig = {
  token: EVENTBRITE_TOKEN,
  apiBase: EVENTBRITE_API_BASE,
};