'use strict';

const Account = (() => {
  const config = globalThis.CAMPAIGN_LEDGER_CONFIG ?? {};
  const configured = /^https:\/\/[^/]+\.supabase\.co\/?$/i.test(config.supabaseUrl ?? '') &&
    typeof config.supabasePublishableKey === 'string' && config.supabasePublishableKey.length > 20;
  let client = null;
  let session = null;
  let ready = !configured;
  let error = configured ? '' : 'Add the Supabase project URL and publishable key to config.js.';
  let notify = () => {};

  function update(nextSession, nextError = '') {
    session = nextSession;
    error = nextError;
    ready = true;
    queueMicrotask(notify);
  }

  async function initialize(onChange) {
    notify = onChange ?? notify;
    if (!configured) {
      notify();
      return;
    }
    if (!globalThis.supabase?.createClient) {
      update(null, 'The Supabase browser library could not be loaded.');
      return;
    }

    client = globalThis.supabase.createClient(config.supabaseUrl, config.supabasePublishableKey, {
      auth: { autoRefreshToken: true, persistSession: true, detectSessionInUrl: true },
    });
    client.auth.onAuthStateChange((_event, nextSession) => update(nextSession));
    const { data, error: sessionError } = await client.auth.getSession();
    update(data?.session ?? null, sessionError?.message ?? '');
  }

  function redirectUrl() {
    return new URL(location.pathname, location.origin).href;
  }

  async function signIn() {
    if (!client) throw new Error(error || 'Supabase is not configured.');
    const { error: signInError } = await client.auth.signInWithOAuth({
      provider: 'google',
      options: { redirectTo: redirectUrl() },
    });
    if (signInError) throw signInError;
  }

  async function signOut() {
    if (!client) return;
    const { error: signOutError } = await client.auth.signOut();
    if (signOutError) throw signOutError;
  }

  return {
    get configured() { return configured; },
    get ready() { return ready; },
    get error() { return error; },
    get user() { return session?.user ?? null; },
    get client() { return client; },
    initialize,
    signIn,
    signOut,
  };
})();
