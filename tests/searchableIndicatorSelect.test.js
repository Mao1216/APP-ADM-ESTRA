import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { filterIndicators } from '../src/lib/indicatorViews.js';

test('indicator menu replaces name and lower select with one searchable selector in the first column', () => {
  const view = readFileSync(new URL('../src/BioIndicatorsView.jsx', import.meta.url), 'utf8').split('export function IndicatorYearFilter')[0];
  assert.equal(view.includes('Nombre o código'), false);
  assert.equal(view.includes('Seleccionar indicador ('), false);
  assert.equal(view.match(/<SearchableIndicatorSelect/g)?.length, 1);
  assert.ok(view.indexOf('<SearchableIndicatorSelect') < view.indexOf('>Objetivo<select'));
  assert.ok(view.includes("onChange({ ...filters, search: '', indicatorId })"));
});
test('indicator search supports accents, names, codes and no matches', () => {
  const items = [{ id: 1, code: 'IND-26001', name: 'Producción' }, { id: 2, code: 'IND-26002', name: 'Calidad' }];
  assert.deepEqual(filterIndicators(items, { search: 'PRODUCCION' }).map(item => item.id), [1]);
  assert.deepEqual(filterIndicators(items, { search: '26002' }).map(item => item.id), [2]);
  assert.deepEqual(filterIndicators(items, { search: 'no existe' }), []);
});
test('searchable dropdown exposes accessible keyboard and empty state controls', () => {
  const component = readFileSync(new URL('../src/SearchableIndicatorSelect.jsx', import.meta.url), 'utf8');
  for (const text of ['role="combobox"', 'role="listbox"', 'role="option"', 'ArrowDown', 'ArrowUp', 'Enter', 'Escape', 'No hay indicadores que coincidan.']) assert.ok(component.includes(text));
});
