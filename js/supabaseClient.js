import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const supabaseUrl = "https://kdqpzfzoezstplgwiwlm.supabase.co";
const supabaseAnonKey = "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImtkcXB6ZnpvZXpzdHBsZ3dpd2xtIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NTkyNjQ1NTQsImV4cCI6MjA3NDg0MDU1NH0.9thSB-1o6gUBezrv1tw6JR_UHMpjhZnv6RGEzAFv6n8";

export const supabase = createClient(supabaseUrl, supabaseAnonKey);
