import { createClient } from "@supabase/supabase-js";

const supabaseUrl = import.meta.env.VITE_SUPABASE_URL || "https://xlcsqqwelopzpslxgdni.supabase.co";
const supabaseAnonKey = import.meta.env.VITE_SUPABASE_ANON_KEY || "sb_publishable_HXlaIRq65K65Yx9djOtK8Q_NKOFfPvN";

export const supabase = createClient(supabaseUrl, supabaseAnonKey);
