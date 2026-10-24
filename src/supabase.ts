import { createClient } from '@supabase/supabase-js';

// Colocamos as chaves diretamente no código para ignorar o bloqueio de cache do Next.js
const supabaseUrl = 'https://zvoovsbzvjrlxtsxlmqp.supabase.co';
const supabaseAnonKey = 'sb_publishable_fnGaLrJ9IIliVSCmbOWcww_5cU3OVuH';

export const supabase = createClient(supabaseUrl, supabaseAnonKey);