import { createClient } from "@supabase/supabase-js";

const supabaseUrl = "https://ahyvfpdwblrcspfkkzgo.supabase.co";
const supabaseAnonKey = "sb_publishable_YAo0UoPn9kmiVDYyJVHl8A_S3-tWmCQ";

export const supabase = createClient(supabaseUrl, supabaseAnonKey);
