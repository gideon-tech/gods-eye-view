const ALL = 'all';

function normalize(value) {
  return String(value || '')
    .trim()
    .toLowerCase();
}

export function buildTourismExplorerModel(destinations) {
  const records = (Array.isArray(destinations) ? destinations : []).map(
    (item) =>
      Object.freeze({
        ...item,
        coordinates: Object.freeze({ ...item.coordinates }),
        media: Object.freeze({ ...(item.media || { image: null }) }),
      }),
  );
  const categories = [...new Set(records.map((item) => item.category))].sort();
  const regions = [...new Set(records.map((item) => item.region))].sort();
  const cities = [...new Set(records.map((item) => item.city))].sort();
  const featured = records.filter((item) => item.featured);
  return Object.freeze({
    destinations: Object.freeze(records),
    categories: Object.freeze(categories),
    regions: Object.freeze(regions),
    cities: Object.freeze(cities),
    featured: Object.freeze(featured),
  });
}

export function filterTourismDestinations(
  destinations,
  { query = '', category = ALL, region = ALL, city = ALL } = {},
) {
  const queryKey = normalize(query);
  const categoryKey = normalize(category);
  const regionKey = normalize(region);
  const cityKey = normalize(city);
  return (Array.isArray(destinations) ? destinations : []).filter((item) => {
    if (categoryKey !== ALL && normalize(item.category) !== categoryKey)
      return false;
    if (regionKey !== ALL && normalize(item.region) !== regionKey) return false;
    if (cityKey !== ALL && normalize(item.city) !== cityKey) return false;
    if (!queryKey) return true;
    return [item.name, item.category, item.kind, item.region, item.city]
      .filter(Boolean)
      .some((value) => normalize(value).includes(queryKey));
  });
}

export function buildCityFocusMap(destinations) {
  const groups = new Map();
  for (const item of Array.isArray(destinations) ? destinations : []) {
    const key = item.city;
    if (!groups.has(key)) groups.set(key, []);
    groups.get(key).push(item.coordinates);
  }
  const entries = [...groups.entries()].map(([city, coordinates]) => {
    const lat =
      coordinates.reduce((total, item) => total + item.lat, 0) /
      coordinates.length;
    const lon =
      coordinates.reduce((total, item) => total + item.lon, 0) /
      coordinates.length;
    return [city, Object.freeze({ lat, lon })];
  });
  return Object.freeze(Object.fromEntries(entries));
}

export function createExplorerState(model) {
  return {
    query: '',
    category: ALL,
    region: ALL,
    city: ALL,
    selectedId:
      model?.featured?.[0]?.id || model?.destinations?.[0]?.id || null,
    focusedTarget: null,
  };
}

export function selectDestination(state, destination) {
  if (!destination) return state;
  return {
    ...state,
    selectedId: destination.id,
    focusedTarget: {
      mode: 'destination',
      id: destination.id,
      lat: destination.coordinates.lat,
      lon: destination.coordinates.lon,
    },
  };
}

export function selectCity(state, city, focusMap) {
  const target = focusMap?.[city];
  if (!target) return state;
  return {
    ...state,
    city,
    focusedTarget: {
      mode: 'city',
      id: city,
      lat: target.lat,
      lon: target.lon,
    },
  };
}
