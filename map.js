'use strict';

const StorageTileLayer = L.TileLayer.extend({
    _setUpTile: function (done, tile, value, blob) {
        tile.onload = L.bind(this._tileOnLoad, this, done, tile);
        tile.onerror = L.bind(this._tileOnError, this, done, tile);

        tile.src = value;
    },

    createTile: function (coords, done) {
        const tile = document.createElement('img');

        if (this.options.crossOrigin) {
            tile.crossOrigin = '';
        }

        tile.alt = '';

        const x = coords.x,
              y = this.options.tms ? this._globalTileRange.max.y - coords.y : coords.y,
              z = this._getZoomForUrl(),
              key = z + ',' + x + ',' + y,
              self = this;

        if (this.options.storage) {
            this.options.storage.get(key, function (err, value) {
                if (value) {
                    tile.src = value.v;
                    self._setUpTile(done, tile, value.v, true);
                } else {
                    self._setUpTile(done, tile, self.getTileUrl(coords));
                }
            });
        } else {
            self._setUpTile(done, tile, self.getTileUrl(coords));
        }

        return tile;
    }
});

const Control = L.Control.extend({
    onAdd: function (map) {
        const container = L.DomUtil.create('div', 'leaflet-bar leaflet-control');
        container.innerHTML = '<a href="#" class="leaflet-control-zoom-in">' + this.options.innerHTML + '</a>';
        L.DomEvent
            .on(container, 'click', L.DomEvent.stopPropagation)
            .on(container, 'click', L.DomEvent.preventDefault)
            .on(container, 'click', this.options.handler, map)
            .on(container, 'dblclick', L.DomEvent.stopPropagation);
        return container;
    }
});

const ajax = function (src, responseType, callback) {
    const xhr = new XMLHttpRequest();
    xhr.open('GET', src, true);
    xhr.responseType = responseType || 'text';
    xhr.onload = function(err) {
        if (this.status == 200) {
            callback(this.response);
        }
    };
    xhr.send();
};

const dbname = 'tile';
const db = new PouchDB(dbname);
let map = L.map('map').setView([50.7167, 2.35], 13);
new StorageTileLayer('http://{s}.tile.osm.org/{z}/{x}/{y}.png', {storage: db}).addTo(map);

map.addControl(new Control({position: 'topleft', innerHTML: 'C', handler: function () {
    ajax('cache_keys.json', 'text', function (response) {
        const tile_key_list = JSON.parse(response);
        for (let i = 0, l = tile_key_list.length; i < l; i++) {
            (function (key) {
                const src = 'http://tile.osm.org/' + key.split(',').join('/') + '.png';
                ajax(src, 'blob', function (response) {
                    const reader = new FileReader();
                    reader.onloadend = function(e) {
                        db.put({_id: key, v: e.target.result});
                    };
                    reader.readAsDataURL(response);
                });
            })(tile_key_list[i]);
        }
    });
}}));

document.getElementById('buttonbar').onclick = () => {
    document.getElementById('map').innerHTML = "<div id='map' style='width: 100%; height: 100%;'></div>";
    const osmUrl = 'http://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png',
        osmAttribution = 'Map data © <a href="http://openstreetmap.org">OpenStreetMap</a> contributors,' +
            ' <a href="http://creativecommons.org/licenses/by-sa/2.0/">CC-BY-SA</a>',
        osmLayer = new L.TileLayer(osmUrl, {maxZoom: 18, attribution: osmAttribution});

    const address = document.getElementById("address").value;
    fetch("https://api.opencagedata.com/geocode/v1/json?q="+ address +"&key=5925e3ec21c7466aa44553938ff23bf8")
        .then(response => response.json())
        .then(data => {
            map.off();
            map.remove();
            map = new L.Map('map');
            const latitude = data.results[0].geometry.lat;
            const longitude = data.results[0].geometry.lng;
            map.setView(new L.LatLng(latitude, longitude), 15);
            map.addLayer(osmLayer);
            const validatorsLayer = new OsmJs.Weather.LeafletLayer({lang: 'en'});
            map.addLayer(validatorsLayer);
        });
};



map.addControl(new Control({position: 'topleft', innerHTML: 'D', handler: function () {
    PouchDB.destroy(dbname, (err, value) => {
        if (!err) {
            db = new PouchDB(db);
        }
    });
}}));