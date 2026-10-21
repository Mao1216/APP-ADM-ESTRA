import test from 'node:test';
import assert from 'node:assert/strict';
import { linkedProjectProgress, withLinkedProjectProgress } from '../src/lib/objectiveViews.js';

test('calculates objective progress as the rounded average of linked projects', () => {
  assert.equal(linkedProjectProgress([{ progress: 42 }, { progress: 85 }]), 64);
});

test('assigns linked project progress only to its matching objective', () => {
  const objectives = [{ id: 1, progress: 99 }, { id: 2, progress: 50 }];
  const actual = withLinkedProjectProgress(objectives, [{ objectiveId: 1, progress: 20 }, { objective_id: 1, progress: 60 }]);
  assert.deepEqual(actual.map(item => item.progress), [40, 0]);
});
