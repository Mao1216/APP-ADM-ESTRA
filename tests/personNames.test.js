import test from 'node:test';
import assert from 'node:assert/strict';
import { personName, fiveWhyAnswers } from '../src/lib/personNames.js';
test('resuelve responsables por ID o correo y nunca muestra un UUID como nombre', () => {
  const people = [{ id: '123-uuid', email: 'molin@biomont.com.pe', name: 'Manuel Olin' }];
  assert.equal(personName('123-uuid', people), 'Manuel Olin');
  assert.equal(personName('MOLIN@biomont.com.pe', people), 'Manuel Olin');
  assert.equal(personName('sig@biomont.com.pe'), 'SIG');
  assert.equal(personName('unknown-uuid', people), 'Responsable asignado');
});
test('requiere los dos primeros porqués y conserva hasta cinco respuestas', () => {
  assert.equal(fiveWhyAnswers(['a', '', 'c']), null);
  assert.deepEqual(fiveWhyAnswers(['a', 'b', '', '', '']), ['a', 'b']);
  assert.deepEqual(fiveWhyAnswers(['a', 'b', 'c', 'd', 'e']), ['a', 'b', 'c', 'd', 'e']);
});
