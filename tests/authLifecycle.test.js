import test from 'node:test';
import assert from 'node:assert/strict';
import { observeAuthentication } from '../src/lib/authLifecycle.js';

function fixture() {
  let emit;
  let resolveSession;
  const jobs = [];
  const events = [];
  const auth = {
    onAuthStateChange(callback) { emit = callback; return { data: { subscription: { unsubscribe() {} } } }; },
    getSession() { return new Promise(resolve => { resolveSession = resolve; }); },
  };
  const stop = observeAuthentication(auth, {
    onAccount(session, isCurrent) { events.push(['account', session.user.id, isCurrent]); },
    onRefresh(session) { events.push(['refresh', session.user.id]); },
    onSignedOut() { events.push(['out']); },
    onError(error) { events.push(['error', error]); },
  }, job => jobs.push(job));
  return { emit: (...args) => emit(...args), resolve: session => resolveSession({ data: { session } }), flush: () => jobs.splice(0).forEach(job => job()), events, stop };
}
const session = { user: { id: 'admin' }, access_token: 'test' };

test('renewal and tab focus preserve selected role by loading the account only once', () => {
  const f = fixture();
  f.emit('INITIAL_SESSION', session);
  assert.equal(f.events.length, 0, 'no API work inside the auth callback');
  f.flush();
  f.emit('TOKEN_REFRESHED', session);
  f.emit('SIGNED_IN', session);
  f.flush();
  assert.deepEqual(f.events.map(e => e[0]), ['account', 'refresh', 'refresh']);
});
test('sign-out cancels pending account loading and invalidates in-flight work', () => {
  const f = fixture();
  f.emit('SIGNED_IN', session); f.flush();
  const isCurrent = f.events[0][2];
  f.emit('SIGNED_OUT', null);
  assert.equal(isCurrent(), false);
  f.emit('SIGNED_IN', session); f.emit('SIGNED_OUT', null); f.flush();
  assert.equal(f.events.filter(e => e[0] === 'account').length, 1);
});
test('a stale getSession result cannot reopen a signed-out session', async () => {
  const f = fixture();
  f.emit('SIGNED_IN', session); f.flush(); f.emit('SIGNED_OUT', null);
  f.resolve(session); await Promise.resolve(); f.flush();
  assert.equal(f.events.at(-1)[0], 'out');
});
test('switching accounts reloads authorization and cancels the old response', () => {
  const f = fixture();
  f.emit('SIGNED_IN', session); f.flush();
  const isCurrent = f.events[0][2];
  f.emit('SIGNED_IN', { user: { id: 'manager' } }); f.flush();
  assert.equal(isCurrent(), false);
  assert.equal(f.events.at(-1)[1], 'manager');
  f.stop(); assert.equal(f.events.at(-1)[2](), false);
});
