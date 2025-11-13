// static/js/supabaseClient.js
// Reemplaza estos valores por los de tu proyecto Supabase

const SUPABASE_URL = "https://TU-PROYECTO.supabase.co";
const SUPABASE_ANON_KEY = "TU-CLAVE-ANON";

window.supabase = window.supabase || {};
const supabaseClient = window.supabase.createClient(SUPABASE_URL, SUPABASE_ANON_KEY);

// Para comodidad en otros scripts
window.supabaseClient = supabaseClient;
