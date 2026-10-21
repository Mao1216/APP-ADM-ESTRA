import test from 'node:test';
import assert from 'node:assert/strict';
import { accountIdentities, indicatorAccess, supportIndicators } from '../src/lib/responsibility.js';

test('matches directory IDs and normalized account emails', () => {
  const ids = accountIdentities(' Manager@Example.com ', [{ id: 'person-1', email: 'manager@example.com' }]);
  assert.equal(indicatorAccess({}, { ownerId: 'person-1' }, ids).canManage, true);
  assert.equal(indicatorAccess({ ownerId: 'MANAGER@example.com' }, null, ids).canManage, true);
});

test('objective manager inherits every indicator and retains access after delegation', () => {
  const objective = { ownerId: 'manager@example.com' };
  for (const indicator of [{}, { ownerId: 'someone-else', reporter_email: 'delegate@example.com' }]) {
    assert.deepEqual(indicatorAccess(indicator, objective, ['manager@example.com']), { canManage: true, canReport: true });
  }
});

test('delegate may report but cannot manage; unrelated accounts have no access', () => {
  const indicator = { reporter_email: 'delegate@example.com' };
  assert.deepEqual(indicatorAccess(indicator, null, ['delegate@example.com']), { canManage: false, canReport: true });
  assert.deepEqual(indicatorAccess(indicator, null, ['other@example.com']), { canManage: false, canReport: false });
});

test('superadministrator sees all indicators; missing emails never match unlinked people', () => {
  assert.equal(indicatorAccess({}, null, [], true).canReport, true);
  assert.deepEqual(accountIdentities(undefined, [{ id: 'unlinked' }]), []);
  assert.equal(indicatorAccess({}, {}, []).canReport, false);
});

test('support portfolio includes only explicit delegations, never objective or indicator ownership', () => {
  const indicators = [
    { id: 1, ownerId: 'support@example.com' },
    { id: 2, reporter_email: ' SUPPORT@example.com ' },
    { id: 3, reporter_email: 'directory-id' },
    { id: 4, reporter_email: 'someone-else@example.com' },
    { id: 5, reporter_email: '' },
  ];
  assert.deepEqual(supportIndicators(indicators, ['support@example.com', 'directory-id']).map(row => row.id), [2, 3]);
  assert.deepEqual(supportIndicators(indicators, []), []);
  assert.deepEqual(supportIndicators([{ id: 6 }], ['']), []);
});
