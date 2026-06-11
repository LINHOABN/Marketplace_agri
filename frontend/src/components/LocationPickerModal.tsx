import { useState, useEffect } from 'react';
import { MapContainer, TileLayer, Marker, useMapEvents } from 'react-leaflet';
import L from 'leaflet';
import 'leaflet/dist/leaflet.css';
import { Navigation, MapPin, Check } from 'lucide-react';

// Fix icons
import markerIcon from 'leaflet/dist/images/marker-icon.png';
import markerShadow from 'leaflet/dist/images/marker-shadow.png';
let DefaultIcon = L.icon({
    iconUrl: markerIcon,
    shadowUrl: markerShadow,
    iconSize: [25, 41],
    iconAnchor: [12, 41]
});
L.Marker.prototype.options.icon = DefaultIcon;

interface LocationPickerModalProps {
    initialPos: [number, number] | null;
    onSelect: (pos: [number, number]) => void;
    onClose: () => void;
}

function LocationMarker({ position, setPosition }: { position: [number, number] | null, setPosition: (pos: [number, number]) => void }) {
    useMapEvents({
        click(e) {
            setPosition([e.latlng.lat, e.latlng.lng]);
        },
    });

    return position === null ? null : (
        <Marker position={position} />
    );
}

export default function LocationPickerModal({ initialPos, onSelect, onClose }: LocationPickerModalProps) {
    const [tempPos, setTempPos] = useState<[number, number] | null>(initialPos || [3.848, 11.502]);

    return (
        <div className="modal-overlay" style={{ position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.8)', zIndex: 10000, display: 'flex', alignItems: 'center', justifyContent: 'center', padding: '1rem' }}>
            <div className="modal-content" style={{ background: 'var(--surface)', borderRadius: '1.5rem', width: '100%', maxWidth: '600px', height: '80vh', display: 'flex', flexDirection: 'column', overflow: 'hidden' }}>
                <header style={{ padding: '1.5rem', borderBottom: '1px solid var(--border-color)', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                    <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
                        <MapPin size={24} color="var(--primary)" />
                        <h2 style={{ margin: 0, fontSize: '1.25rem', fontWeight: 900 }}>Où livrer votre colis ?</h2>
                    </div>
                    <button className="btn btn-secondary" onClick={onClose}>Annuler</button>
                </header>

                <div style={{ flex: 1, position: 'relative' }}>
                    <MapContainer center={tempPos || [3.848, 11.502]} zoom={13} style={{ height: '100%', width: '100%' }}>
                        <TileLayer url="https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png" />
                        <LocationMarker position={tempPos} setPosition={setTempPos} />
                    </MapContainer>
                    <div style={{ position: 'absolute', bottom: '20px', left: '50%', transform: 'translateX(-50%)', zIndex: 1000, width: '90%' }}>
                        <button
                            className="btn btn-primary"
                            style={{ width: '100%', boxShadow: '0 4px 15px rgba(0,0,0,0.2)', height: '54px', fontSize: '16px', fontWeight: 800, display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '10px' }}
                            onClick={() => tempPos && onSelect(tempPos)}
                        >
                            <Check size={20} /> Confirmer cet emplacement
                        </button>
                    </div>
                    <div style={{ position: 'absolute', top: '10px', left: '50%', transform: 'translateX(-50%)', zIndex: 1000, background: 'white', padding: '8px 16px', borderRadius: '20px', fontSize: '13px', fontWeight: 700, boxShadow: '0 2px 10px rgba(0,0,0,0.1)', border: '1px solid var(--primary)' }}>
                        Touchez la carte pour placer l'épingle
                    </div>
                </div>
            </div>
        </div>
    );
}
