import { createClient } from '@supabase/supabase-js';

const supabaseUrl = import.meta.env.VITE_SUPABASE_URL ?? '';
const supabaseAnonKey = import.meta.env.VITE_SUPABASE_ANON_KEY ?? '';

export const supabase = createClient(supabaseUrl, supabaseAnonKey, {
  auth: {
    // Disable navigator.locks to prevent deadlocks in React StrictMode.
    // StrictMode double-fires effects, which orphans the Web Lock from the
    // first mount and causes getSession() / onAuthStateChange to hang forever.
    lock: async (_name: string, _acquireTimeout: number, fn: () => Promise<any>) => fn(),
  },
});
