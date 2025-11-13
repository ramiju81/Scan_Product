// static/js/supabaseClient.js
// Reemplaza estos valores por los de tu proyecto Supabase

const SUPABASE_URL = "https://xhyucxumsdqgtpnwdqdu.supabase.co";
const SUPABASE_ANON_KEY = "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InhoeXVjeHVtc2RxZ3RwbndkcWR1Iiwicm9sZSI6ImFub24iLCJpYXQiOjE3NTk4ODE3MzYsImV4cCI6MjA3NTQ1NzczNn0.QxrspFLu_S3OC9G7AP9eKu17JztVS22s0BGaE4pTlkU";

window.supabase = window.supabase || {};
const supabaseClient = window.supabase.createClient(SUPABASE_URL, SUPABASE_ANON_KEY);

// Para comodidad en otros scripts
window.supabaseClient = supabaseClient;
