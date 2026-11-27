import { supabase } from '@/lib/supabase';

let guestSession: Promise<string> | undefined;

export async function getFanId(): Promise<string> {
  const { data: { session }, error } = await supabase.auth.getSession();
  if (error) throw error;
  if (session) return session.user.id;
  if (!guestSession) {
    guestSession = supabase.auth.signInAnonymously().then(({ data, error: signInError }) => {
      if (signInError) throw signInError;
      if (!data.session) throw new Error('Guest session unavailable');
      return data.session.user.id;
    }).finally(() => { guestSession = undefined; });
  }
  return guestSession;
}
