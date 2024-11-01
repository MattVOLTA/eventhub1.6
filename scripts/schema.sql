-- Drop existing tables if they exist
DROP TABLE IF EXISTS event_interests;
DROP TABLE IF EXISTS events;
DROP TABLE IF EXISTS interests;
DROP TABLE IF EXISTS organizations;

-- Create organizations table
CREATE TABLE organizations (
  id TEXT PRIMARY KEY,
  name TEXT NOT NULL,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT TIMEZONE('utc'::text, NOW()) NOT NULL
);

-- Create interests table
CREATE TABLE interests (
  id SERIAL PRIMARY KEY,
  name TEXT NOT NULL UNIQUE,
  slug TEXT NOT NULL UNIQUE,
  description TEXT NOT NULL,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT TIMEZONE('utc'::text, NOW()) NOT NULL
);

-- Create events table
CREATE TABLE events (
  eventbrite_id TEXT PRIMARY KEY,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT TIMEZONE('utc'::text, NOW()) NOT NULL,
  name TEXT NOT NULL,
  description TEXT,
  summary TEXT,
  start_date TIMESTAMP WITH TIME ZONE NOT NULL,
  end_date TIMESTAMP WITH TIME ZONE NOT NULL,
  organizer_id TEXT NOT NULL REFERENCES organizations(id),
  organizer_name TEXT NOT NULL,
  is_virtual BOOLEAN NOT NULL DEFAULT false,
  is_free BOOLEAN NOT NULL DEFAULT false,
  status TEXT NOT NULL,
  listed BOOLEAN NOT NULL DEFAULT true,
  is_locked BOOLEAN NOT NULL DEFAULT false,
  venue_name TEXT,
  venue_address TEXT,
  venue_city TEXT,
  venue_latitude TEXT,
  venue_longitude TEXT,
  url TEXT NOT NULL,
  logo_url TEXT
);

-- Create event_interests junction table
CREATE TABLE event_interests (
  event_id TEXT REFERENCES events(eventbrite_id) ON DELETE CASCADE,
  interest_id INTEGER REFERENCES interests(id) ON DELETE CASCADE,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT TIMEZONE('utc'::text, NOW()) NOT NULL,
  PRIMARY KEY (event_id, interest_id)
);

-- Create indexes
CREATE INDEX idx_events_status ON events(status);
CREATE INDEX idx_events_end_date ON events(end_date);
CREATE INDEX idx_event_interests_event_id ON event_interests(event_id);
CREATE INDEX idx_event_interests_interest_id ON event_interests(interest_id);
CREATE INDEX idx_interests_slug ON interests(slug);

-- Disable Row Level Security temporarily for initial data load
ALTER TABLE organizations DISABLE ROW LEVEL SECURITY;
ALTER TABLE events DISABLE ROW LEVEL SECURITY;
ALTER TABLE interests DISABLE ROW LEVEL SECURITY;
ALTER TABLE event_interests DISABLE ROW LEVEL SECURITY;

-- Insert initial interests with descriptions
INSERT INTO interests (name, slug, description) VALUES
  ('Funding and Investment', 'funding-investment', 'Strategies for securing capital, understanding investor relations, and managing financial growth. Learn about venture capital, angel investment, and alternative funding sources.'),
  
  ('Marketing and Sales', 'marketing-sales', 'Techniques for market analysis, branding, customer acquisition, and revenue generation. Explore digital marketing, sales strategies, and customer engagement.'),
  
  ('Product Development', 'product-development', 'Processes for ideation, design, prototyping, and product lifecycle management. Learn about user research, MVP development, and iterative improvement.'),
  
  ('Technology and Innovation', 'technology-innovation', 'Exploration of emerging technologies, digital transformation, and innovative business models. Stay current with tech trends and their business applications.'),
  
  ('Leadership and Management', 'leadership-management', 'Development of leadership skills, team building, and organizational culture. Master people management, strategic planning, and effective communication.'),
  
  ('Networking and Community', 'networking-community', 'Opportunities for establishing partnerships, mentorship, and collaborative ventures. Build valuable connections within the startup ecosystem.'),
  
  ('Legal and Compliance', 'legal-compliance', 'Guidance on intellectual property, regulatory requirements, and legal frameworks. Navigate business law, contracts, and regulatory compliance.'),
  
  ('Operations and Scaling', 'operations-scaling', 'Insights into operational efficiency, supply chain management, and scaling strategies. Learn to grow and optimize your business operations.'),
  
  ('Diversity and Inclusion', 'diversity-inclusion', 'Initiatives promoting equitable opportunities and diverse representation within the startup ecosystem. Build inclusive workplaces and diverse teams.'),
  
  ('Sustainability Impact', 'sustainability-impact', 'Focus on environmentally sustainable practices and socially responsible entrepreneurship. Create positive environmental and social impact.'),
  
  ('Customer Experience', 'customer-experience', 'Strategies for enhancing user satisfaction and fostering long-term loyalty. Improve customer service and build lasting relationships.'),
  
  ('Data Analytics', 'data-analytics', 'Utilizing data-driven insights to inform decision-making and optimize operations. Master business intelligence and performance metrics.'),
  
  ('Human Resources', 'human-resources', 'Best practices for recruiting, developing, and retaining top talent. Build strong teams and maintain positive workplace culture.'),
  
  ('Global Expansion', 'global-expansion', 'Guidance on entering new markets and navigating international business landscapes. Expand your business across borders effectively.'),
  
  ('Crisis Management', 'crisis-management', 'Preparing for and responding to challenges to ensure business continuity. Build resilient organizations that can weather uncertainty.')
ON CONFLICT (slug) DO NOTHING;