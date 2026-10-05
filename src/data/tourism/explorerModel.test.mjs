import assert from 'node:assert/strict';
import test from 'node:test';
import { UGANDA_TOURISM_DESTINATIONS } from './ugandaDestinations.js';
import {
  buildCityFocusMap,
  buildTourismExplorerModel,
  createExplorerState,
  filterTourismDestinations,
  selectCity,
  selectDestination,
} from './explorerModel.js';

test('uganda tourism dataset includes required seeded destinations', () => {
  const names = new Set(UGANDA_TOURISM_DESTINATIONS.map((item) => item.name));
  for (const required of [
    'Kampala',
    'Entebbe',
    'Jinja (Source of the Nile)',
    'Murchison Falls National Park',
    'Queen Elizabeth National Park',
    'Bwindi Impenetrable National Park',
    'Mgahinga Gorilla National Park',
    'Kidepo Valley National Park',
    'Lake Bunyonyi',
    'Rwenzori Mountains',
    'Ssese Islands',
    'Sipi Falls',
  ]) {
    assert.equal(names.has(required), true, `missing ${required}`);
  }
});

test('tourism filtering supports query + category + region', () => {
  const model = buildTourismExplorerModel(UGANDA_TOURISM_DESTINATIONS);
  const parks = filterTourismDestinations(model.destinations, {
    category: 'National Park',
  });
  assert.ok(parks.length >= 5);
  const western = filterTourismDestinations(model.destinations, {
    category: 'National Park',
    region: 'Western Region',
  });
  assert.equal(
    western.some((item) => item.name === 'Queen Elizabeth National Park'),
    true,
  );
  const searched = filterTourismDestinations(model.destinations, {
    query: 'jinja',
  });
  assert.equal(searched.length, 1);
  assert.equal(searched[0].city, 'Jinja');
});

test('destination and city selection updates explorer focus state', () => {
  const model = buildTourismExplorerModel(UGANDA_TOURISM_DESTINATIONS);
  const focusMap = buildCityFocusMap(model.destinations);
  let state = createExplorerState(model);
  const destination = model.destinations.find((item) => item.city === 'Kampala');
  state = selectDestination(state, destination);
  assert.equal(state.selectedId, destination.id);
  assert.deepEqual(state.focusedTarget, {
    mode: 'destination',
    id: destination.id,
    lat: destination.coordinates.lat,
    lon: destination.coordinates.lon,
  });
  state = selectCity(state, 'Jinja', focusMap);
  assert.equal(state.city, 'Jinja');
  assert.equal(state.focusedTarget.mode, 'city');
  assert.equal(typeof state.focusedTarget.lat, 'number');
  assert.equal(typeof state.focusedTarget.lon, 'number');
});

