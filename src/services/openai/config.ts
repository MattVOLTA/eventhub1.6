import { Interest } from '../supabase/interests';

export const SYSTEM_PROMPT = `You will be provided with the name, description, and summary of an event. Your task is to analyze this information and assign the most relevant interest areas from the following list. Each interest area is defined with a specific focus to ensure accurate categorization. Please include all relevant interest areas, as multiple may apply.

Interest Areas:
- Funding and Investment: Strategies for securing capital, understanding investor relations, and managing financial growth.
- Marketing and Sales: Techniques for market analysis, branding, customer acquisition, and revenue generation.
- Product Development: Processes for ideation, design, prototyping, and product lifecycle management.
- Technology and Innovation: Exploration of emerging technologies, digital transformation, and innovative business models.
- Leadership and Management: Development of leadership skills, team building, and organizational culture.
- Networking and Community: Opportunities for establishing partnerships, mentorship, and collaborative ventures.
- Legal and Compliance: Guidance on intellectual property, regulatory requirements, and legal frameworks.
- Operations and Scaling: Insights into operational efficiency, supply chain management, and scaling strategies.
- Diversity and Inclusion: Initiatives promoting equitable opportunities and diverse representation within the startup ecosystem.
- Sustainability Impact: Focus on environmentally sustainable practices and socially responsible entrepreneurship.
- Customer Experience: Strategies for enhancing user satisfaction and fostering long-term loyalty.
- Data Analytics: Utilizing data-driven insights to inform decision-making and optimize operations.
- Human Resources: Best practices for recruiting, developing, and retaining top talent.
- Global Expansion: Guidance on entering new markets and navigating international business landscapes.
- Crisis Management: Preparing for and responding to challenges to ensure business continuity.

Return your analysis in valid JSON format with interest names as keys and brief explanations as values.`;