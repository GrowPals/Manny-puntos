import { createClient } from '@supabase/supabase-js';

const supabaseUrl = 'https://kuftyqupibyjliaukpxn.supabase.co';
const supabaseAnonKey = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6Imt1ZnR5cXVwaWJ5amxpYXVrcHhuIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NjEyMzYzNTUsImV4cCI6MjA3NjgxMjM1NX0.A0JbcXOcK6J_EYTSZvfyKybvFRTBUndYc6O084jK3sE';

export const supabase = createClient(supabaseUrl, supabaseAnonKey);