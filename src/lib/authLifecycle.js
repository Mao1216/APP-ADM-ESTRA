// Keep Supabase's synchronous auth callback free of awaited API calls.
export function observeAuthentication(auth, { onAccount, onRefresh, onSignedOut, onError }, schedule = callback => setTimeout(callback, 0)) {
  let active = true;
  let accountId = null;
  let revision = 0;
  const accept = (event, session) => {
    if (!active) return;
    if (!session?.user) {
      if (event !== 'SIGNED_OUT' && event !== 'INITIAL_SESSION') return;
      accountId = null;
      revision += 1;
      onSignedOut();
      return;
    }
    if (accountId === session.user.id) {
      onRefresh(session);
      return;
    }
    accountId = session.user.id;
    const currentRevision = ++revision;
    schedule(() => {
      if (!active || revision !== currentRevision) return;
      Promise.resolve(onAccount(session, () => active && revision === currentRevision)).catch(error => {
        if (active && revision === currentRevision) onError(error);
      });
    });
  };
  const { data: { subscription } } = auth.onAuthStateChange(accept);
  const initialRevision = revision;
  auth.getSession().then(({ data, error }) => {
    if (!active || revision !== initialRevision) return;
    if (error) onError(error);
    else accept('INITIAL_SESSION', data.session);
  }).catch(error => { if (active && revision === initialRevision) onError(error); });
  return () => { active = false; revision += 1; subscription.unsubscribe(); };
}
