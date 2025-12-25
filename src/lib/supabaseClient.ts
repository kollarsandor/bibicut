import { createClient } from '@supabase/supabase-js';

const supabaseUrl = 'https://haebrawbsusnefurodvr.supabase.co';
const supabaseAnonKey = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImhhZWJyYXdic3VzbmVmdXJvZHZyIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NjY2MjI3NTIsImV4cCI6MjA4MjE5ODc1Mn0.h1uCzrN2BOKQW6Prp6d2x4y0MHvh9EjYgs8sS4KLq1k';

export const supabase = createClient(supabaseUrl, supabaseAnonKey);