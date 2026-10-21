import test from 'node:test';
import assert from 'node:assert/strict';
import { deviationAssessment } from '../src/lib/measurementDeviation.js';

test('clasifica desviaciones menores o iguales al veinte por ciento como moderadas', () => {
  assert.deepEqual(deviationAssessment(12, 10, '<=').status, 'desviacion_moderada');
  assert.equal(deviationAssessment(12.01, 10, '<=').status, 'desviacion_critica');
  assert.equal(deviationAssessment(8, 10, '>=').status, 'desviacion_moderada');
  assert.equal(deviationAssessment(7.99, 10, '>=').status, 'desviacion_critica');
  assert.equal(deviationAssessment(10, 10, '<=').status, 'en_meta');
});

test('expone la línea crítica según la dirección del comparador', () => {
  assert.equal(deviationAssessment(11, 10, '<=').critical, 12);
  assert.equal(deviationAssessment(9, 10, '>=').critical, 8);
  const equality = deviationAssessment(11, 10, '=');
  assert.equal(equality.criticalLower, 8);
  assert.equal(equality.criticalUpper, 12);
});
