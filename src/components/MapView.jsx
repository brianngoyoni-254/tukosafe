import { useEffect, useMemo } from 'react';
import { MapContainer, TileLayer, Marker, Popup, Circle, useMap } from 'react-leaflet';
import L from 'leaflet';
import 'leaflet/dist/leaflet.css';
import { useApp } from '../context/AppContext';

// Fix Leaflet's default marker icon paths (Vite bundling issue)
delete L.Icon.Default.prototype._getIconUrl;
L.Icon.Default.mergeOptions({
  iconRetinaUrl: 'https://unpkg.com/leaflet@1.9.4/dist/images/marker-icon-2x.png',
  iconUrl: 'https://unpkg.com/leaflet@1.9.4/dist/images/marker-icon.png',
  shadowUrl: 'https://unpkg.com/leaflet@1.9.4/dist/images/marker-shadow.png',
});

// Custom amber dot for friends (smaller, distinct from you)
const friendIcon = new L.DivIcon({
  className: '',
  html: `<div style="width:14px;height:14px;border-radius:50%;background:#b36b00;border:2px solid #fff;box-shadow:0 1px 4px rgba(0,0,0,0.3)"></div>`,
  iconSize: [14, 14],
  iconAnchor: [7, 7],
});

// Controller: flies the map to the user's position when it changes
function MapController({ pos }) {
  const map = useMap();
  useEffect(() => {
    if (pos) {
      map.flyTo([pos.lat, pos.lng], 15, { duration: 1.2 });
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [pos?.lat, pos?.lng, map]);
  return null;
}

const staleIcon = new L.DivIcon({
  className: '',
  html: `<div style="width:14px;height:14px;border-radius:50%;background:#8a949c;border:2px dashed #fff;box-shadow:0 1px 4px rgba(0,0,0,0.3)"></div>`,
  iconSize: [14, 14],
  iconAnchor: [7, 7],
});

// `friends` come from useSharedLocations: only people who explicitly share with the viewer.
export default function MapView({ showMembers = true, height = 420, friends = [] }) {
  const { pos } = useApp();

  // Default center: Nairobi CBD. Used until geolocation resolves.
  const defaultCenter = useMemo(() => [-1.2864, 36.8172], []);
  const center = pos ? [pos.lat, pos.lng] : defaultCenter;

  return (
    <div
      className="relative rounded-2xl overflow-hidden border border-line bg-mapbg"
      style={{ height }}
    >
      <MapContainer
        center={center}
        zoom={pos ? 15 : 12}
        scrollWheelZoom={true}
        style={{ width: '100%', height: '100%' }}
        attributionControl={true}
      >
        <TileLayer
          attribution='&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a> contributors'
          url="https://tile.openstreetmap.org/{z}/{x}/{y}.png"
          maxZoom={19}
        />

        <MapController pos={pos} />

        {/* Your position */}
        {pos && (
          <>
            <Marker position={[pos.lat, pos.lng]}>
              <Popup>
                <b>You are here</b>
                <br />
                Accuracy: ±{Math.round(pos.accuracy)} m
              </Popup>
            </Marker>
            <Circle
              center={[pos.lat, pos.lng]}
              radius={pos.accuracy || 30}
              pathOptions={{
                color: '#1c8277',
                fillColor: '#1c8277',
                fillOpacity: 0.12,
                weight: 1,
              }}
            />
          </>
        )}

        {/* Friends (only if consent + sharing on) */}
        {showMembers && friends.map((f) => (
          <Marker key={f.id} position={[f.lat, f.lng]} icon={f.state === 'live' ? friendIcon : staleIcon}>
            <Popup>
              <b>{f.name}</b>
              <br />
              {f.state === 'live' ? 'Live' : f.state === 'stale' ? 'Stale' : 'Offline, last known position'}
              {' · '}updated {new Date(f.updatedAt).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
              {f.accuracy != null && <><br />Accuracy ±{Math.round(f.accuracy)} m</>}
            </Popup>
          </Marker>
        ))}
      </MapContainer>

      {/* Status chip overlay */}
      <div className="absolute left-3 top-3 z-[1000]">
        <span
          className={`inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-xs font-bold shadow ${
            pos ? 'bg-greenbg text-green' : 'bg-line text-mut'
          }`}
        >
          {pos ? 'Located' : 'Locating…'}
        </span>
      </div>
    </div>
  );
}