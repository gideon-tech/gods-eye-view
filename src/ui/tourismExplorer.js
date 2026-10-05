import * as Cesium from 'cesium';
import { UGANDA_TOURISM_DESTINATIONS } from '../data/tourism/ugandaDestinations.js';
import {
  buildCityFocusMap,
  buildTourismExplorerModel,
  createExplorerState,
  filterTourismDestinations,
  selectCity,
  selectDestination,
} from '../data/tourism/explorerModel.js';

const DEFAULT_UGANDA_VIEW = Object.freeze({
  lat: 1.3733,
  lon: 32.2903,
  heightM: 1600000,
});

function destinationById(destinations) {
  return new Map(destinations.map((item) => [item.id, item]));
}

function option(value, label) {
  const node = document.createElement('option');
  node.value = value;
  node.textContent = label;
  return node;
}

export class TourismExplorer {
  constructor({
    viewer,
    showToast = () => {},
    onBeforeFocus = () => {},
    onResetWorld = null,
  }) {
    this.viewer = viewer;
    this.showToast = showToast;
    this.onBeforeFocus = onBeforeFocus;
    this.onResetWorld = onResetWorld;
    this.model = buildTourismExplorerModel(UGANDA_TOURISM_DESTINATIONS);
    this.byId = destinationById(this.model.destinations);
    this.cityFocus = buildCityFocusMap(this.model.destinations);
    this.state = createExplorerState(this.model);
    if (typeof document === 'undefined') return;
    this._onKeydown = (event) => {
      if (event.key === 'Escape')
        this.panel.classList.toggle('collapsed', true);
    };
    this._buildDom();
    this._populateFilters();
    this._mountMarkers();
    this._attachEvents();
    this._render();
    this.focusUganda({ smooth: false });
  }

  _buildDom() {
    this.panel = document.createElement('aside');
    this.panel.id = 'tourism-explorer';
    this.panel.className = 'tourism-explorer';
    this.panel.innerHTML = `
      <div class="tourism-explorer-header">
        <button type="button" class="tourism-explorer-toggle" aria-expanded="true" aria-controls="tourism-explorer-body">Uganda Tourism Explorer</button>
      </div>
      <div id="tourism-explorer-body" class="tourism-explorer-body">
        <div class="tourism-controls">
          <label>
            <span>Search destinations</span>
            <input type="search" class="tourism-search" placeholder="Search Uganda destinations" />
          </label>
          <label>
            <span>Category</span>
            <select class="tourism-category"></select>
          </label>
          <label>
            <span>Region</span>
            <select class="tourism-region"></select>
          </label>
          <label>
            <span>City / Area</span>
            <select class="tourism-city"></select>
          </label>
          <div class="tourism-actions">
            <button type="button" class="tourism-focus-uganda">Focus Uganda</button>
            <button type="button" class="tourism-reset-world">Reset World View</button>
          </div>
        </div>
        <section class="tourism-section" aria-label="Featured destinations">
          <h3>Featured Uganda picks</h3>
          <ul class="tourism-featured-list"></ul>
        </section>
        <section class="tourism-section" aria-label="Filtered destination results">
          <h3>Destinations</h3>
          <p class="tourism-empty" hidden>No destinations match this filter.</p>
          <ul class="tourism-results-list"></ul>
        </section>
        <section class="tourism-section tourism-detail" aria-live="polite">
          <h3>Destination details</h3>
          <div class="tourism-detail-card">Select a destination marker or list item.</div>
        </section>
      </div>
    `;
    document.body.appendChild(this.panel);
    this.toggleButton = this.panel.querySelector('.tourism-explorer-toggle');
    this.body = this.panel.querySelector('.tourism-explorer-body');
    this.searchInput = this.panel.querySelector('.tourism-search');
    this.categorySelect = this.panel.querySelector('.tourism-category');
    this.regionSelect = this.panel.querySelector('.tourism-region');
    this.citySelect = this.panel.querySelector('.tourism-city');
    this.focusUgandaButton = this.panel.querySelector('.tourism-focus-uganda');
    this.resetWorldButton = this.panel.querySelector('.tourism-reset-world');
    this.featuredList = this.panel.querySelector('.tourism-featured-list');
    this.resultsList = this.panel.querySelector('.tourism-results-list');
    this.emptyState = this.panel.querySelector('.tourism-empty');
    this.detailCard = this.panel.querySelector('.tourism-detail-card');
  }

  _populateFilters() {
    this.categorySelect.append(
      option('all', 'All categories'),
      ...this.model.categories.map((item) => option(item, item)),
    );
    this.regionSelect.append(
      option('all', 'All regions'),
      ...this.model.regions.map((item) => option(item, item)),
    );
    this.citySelect.append(
      option('all', 'All cities / areas'),
      ...this.model.cities.map((item) => option(item, item)),
    );
  }

  _mountMarkers() {
    if (!this.viewer?.dataSources?.add) return;
    this.dataSource = new Cesium.CustomDataSource('uganda-tourism');
    for (const destination of this.model.destinations) {
      this.dataSource.entities.add({
        id: `tourism-${destination.id}`,
        position: Cesium.Cartesian3.fromDegrees(
          destination.coordinates.lon,
          destination.coordinates.lat,
          0,
        ),
        point: {
          pixelSize: destination.featured ? 11 : 9,
          color: destination.featured
            ? Cesium.Color.fromCssColorString('#f8de7e')
            : Cesium.Color.fromCssColorString('#4dc8ff'),
          outlineColor: Cesium.Color.fromCssColorString('#122030'),
          outlineWidth: 2,
        },
        properties: {
          destinationId: destination.id,
        },
      });
    }
    this.viewer.dataSources.add(this.dataSource);
    if (!this.viewer?.scene?.canvas || !this.viewer?.scene?.pick) return;
    this.clickHandler = new Cesium.ScreenSpaceEventHandler(
      this.viewer.scene.canvas,
    );
    this.clickHandler.setInputAction((movement) => {
      const picked = this.viewer.scene.pick(movement.position);
      const destinationId = picked?.id?.properties?.destinationId?.getValue?.();
      if (!destinationId) return;
      this.activateDestination(destinationId, { fly: true });
    }, Cesium.ScreenSpaceEventType.LEFT_CLICK);
  }

  _attachEvents() {
    this.toggleButton.addEventListener('click', () => {
      const collapsed = this.panel.classList.toggle('collapsed');
      this.toggleButton.setAttribute('aria-expanded', String(!collapsed));
    });
    this.searchInput.addEventListener('input', () => {
      this.state.query = this.searchInput.value;
      this._renderResults();
    });
    this.categorySelect.addEventListener('change', () => {
      this.state.category = this.categorySelect.value;
      this._renderResults();
    });
    this.regionSelect.addEventListener('change', () => {
      this.state.region = this.regionSelect.value;
      this._renderResults();
    });
    this.citySelect.addEventListener('change', () => {
      const city = this.citySelect.value;
      this.state = selectCity(this.state, city, this.cityFocus);
      this._renderResults();
      if (city !== 'all') this.focusCity(city);
    });
    this.focusUgandaButton.addEventListener('click', () => this.focusUganda());
    this.resetWorldButton.addEventListener('click', () => {
      if (typeof this.onResetWorld === 'function') this.onResetWorld();
      else this.focusUganda();
    });
    window.addEventListener('keydown', this._onKeydown);
  }

  _render() {
    this._renderFeatured();
    this._renderResults();
    if (this.state.selectedId)
      this._renderDetail(this.byId.get(this.state.selectedId));
  }

  _renderFeatured() {
    this.featuredList.replaceChildren();
    for (const destination of this.model.featured.slice(0, 6)) {
      const item = document.createElement('li');
      const button = document.createElement('button');
      button.type = 'button';
      button.className = 'tourism-destination-button';
      button.textContent = `${destination.icon} ${destination.name}`;
      button.addEventListener('click', () =>
        this.activateDestination(destination.id, { fly: true }),
      );
      item.appendChild(button);
      this.featuredList.appendChild(item);
    }
  }

  _renderResults() {
    const results = filterTourismDestinations(this.model.destinations, {
      query: this.state.query,
      category: this.state.category,
      region: this.state.region,
      city: this.state.city,
    });
    this.resultsList.replaceChildren();
    this.emptyState.hidden = results.length > 0;
    for (const destination of results) {
      const item = document.createElement('li');
      const button = document.createElement('button');
      button.type = 'button';
      button.className = 'tourism-destination-button';
      button.dataset.destinationId = destination.id;
      button.innerHTML = `<strong>${destination.icon} ${destination.name}</strong><span>${destination.kind} · ${destination.region}</span>`;
      button.addEventListener('click', () =>
        this.activateDestination(destination.id, { fly: true }),
      );
      if (destination.id === this.state.selectedId)
        button.classList.add('active');
      item.appendChild(button);
      this.resultsList.appendChild(item);
    }
  }

  _renderDetail(destination) {
    if (!destination) return;
    this.detailCard.innerHTML = `
      <h4>${destination.name}</h4>
      <p class="tourism-detail-meta">${destination.kind} · ${destination.category}</p>
      <p>${destination.description}</p>
      <p class="tourism-detail-meta">${destination.city}, ${destination.region}</p>
    `;
  }

  focusUganda({ smooth = true } = {}) {
    this.onBeforeFocus();
    if (!this.viewer?.camera?.flyTo) return;
    this.viewer.camera.flyTo({
      destination: Cesium.Cartesian3.fromDegrees(
        DEFAULT_UGANDA_VIEW.lon,
        DEFAULT_UGANDA_VIEW.lat,
        DEFAULT_UGANDA_VIEW.heightM,
      ),
      duration: smooth ? 2.2 : 0,
      orientation: {
        heading: 0,
        pitch: Cesium.Math.toRadians(-52),
        roll: 0,
      },
    });
  }

  focusCity(city) {
    const target = this.cityFocus[city];
    if (!target) return;
    this.onBeforeFocus();
    if (!this.viewer?.camera?.flyTo) return;
    this.viewer.camera.flyTo({
      destination: Cesium.Cartesian3.fromDegrees(
        target.lon,
        target.lat,
        260000,
      ),
      duration: 2.4,
      orientation: {
        heading: 0,
        pitch: Cesium.Math.toRadians(-45),
        roll: 0,
      },
    });
  }

  activateDestination(destinationId, { fly = false } = {}) {
    const destination = this.byId.get(destinationId);
    if (!destination) return;
    this.state = selectDestination(this.state, destination);
    this._renderResults();
    this._renderDetail(destination);
    if (!fly) return;
    this.onBeforeFocus();
    try {
      if (!this.viewer?.camera?.flyTo) return;
      this.viewer.camera.flyTo({
        destination: Cesium.Cartesian3.fromDegrees(
          destination.coordinates.lon,
          destination.coordinates.lat,
          destination.kind === 'city' ? 22000 : 14000,
        ),
        duration: 2.6,
        orientation: {
          heading: 0,
          pitch: Cesium.Math.toRadians(-35),
          roll: 0,
        },
      });
    } catch (error) {
      this.showToast('Unable to focus destination');
      console.warn('[TourismExplorer] focus failed', error);
    }
  }

  destroy() {
    if (typeof window !== 'undefined' && this._onKeydown)
      window.removeEventListener('keydown', this._onKeydown);
    this.clickHandler?.destroy();
    if (this.dataSource && this.viewer?.dataSources?.remove)
      this.viewer.dataSources.remove(this.dataSource, true);
    this.panel?.remove();
  }
}
