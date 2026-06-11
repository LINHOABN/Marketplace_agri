import { useEffect } from 'react';
import { MapContainer, TileLayer, Marker, Popup, Polyline, useMap } from 'react-leaflet';
import L from 'leaflet';
import 'leaflet/dist/leaflet.css';

// Fix for default marker icons in Leaflet + React
import markerIcon from 'leaflet/dist/images/marker-icon.png';
import markerShadow from 'leaflet/dist/images/marker-shadow.png';

let DefaultIcon = L.icon({
    iconUrl: markerIcon,
    shadowUrl: markerShadow,
    iconSize: [25, 41],
    iconAnchor: [12, 41]
});
L.Marker.prototype.options.icon = DefaultIcon;

// Custom Icons
const houseIcon = L.divIcon({
    html: '<div style="background: #D32F2F; width: 30px; height: 30px; border-radius: 50%; display: flex; align-items: center; justify-content: center; color: white; border: 2px solid white; box-shadow: 0 2px 5px rgba(0,0,0,0.3)"><i class="house-icon">🏠</i></div>',
    className: '',
    iconSize: [30, 30],
    iconAnchor: [15, 15]
});

const truckIcon = L.divIcon({
    html: '<div style="background: #2E7D32; width: 30px; height: 30px; border-radius: 50%; display: flex; align-items: center; justify-content: center; color: white; border: 2px solid white; box-shadow: 0 2px 5px rgba(0,0,0,0.3)"><i class="truck-icon">🚚</i></div>',
    className: '',
    iconSize: [30, 30],
    iconAnchor: [15, 15]
});

const shopIcon = L.divIcon({
    html: '<div style="background: #F57C00; width: 30px; height: 30px; border-radius: 50%; display: flex; align-items: center; justify-content: center; color: white; border: 2px solid white; box-shadow: 0 2px 5px rgba(0,0,0,0.3)"><i class="shop-icon">🏬</i></div>',
    className: '',
    iconSize: [30, 30],
    iconAnchor: [15, 15]
});

interface DeliveryMapProps {
    delivererPos: [number, number] | null;
    shopPos: [number, number] | null;
    buyerPos: [number, number] | null;
}

function ChangeView({ center }: { center: [number, number] }) {
    const map = useMap();
    useEffect(() => {
        map.setView(center, 14);
    }, [center]);
    return null;
}

export default function DeliveryMap({ delivererPos, shopPos, buyerPos }: DeliveryMapProps) {
    const defaultCenter: [number, number] = delivererPos || shopPos || buyerPos || [3.848, 11.502]; // Yaoundé default

    return (
        <MapContainer
            center={defaultCenter}
            zoom={13}
            style={{ height: '100%', width: '100%', borderRadius: '12px' }}
        >
            <TileLayer
                attribution='&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a> contributors'
                url="https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png"
            />
            {delivererPos && (
                <Marker position={delivererPos} icon={truckIcon}>
                    <Popup>Ma position actuelle</Popup>
                </Marker>
            )}
            {shopPos && (
                <Marker position={shopPos} icon={shopIcon}>
                    <Popup>Point de retrait (Magasin)</Popup>
                </Marker>
            )}
            {buyerPos && (
                <Marker position={buyerPos} icon={houseIcon}>
                    <Popup>Destination (Client)</Popup>
                </Marker>
            )}

            {/* Simple Route Line */}
            {delivererPos && buyerPos && (
                <Polyline
                    positions={[delivererPos, buyerPos]}
                    color="#2E7D32"
                    dashArray="10, 10"
                    weight={4}
                />
            )}

            {delivererPos && <ChangeView center={delivererPos} />}
        </MapContainer>
    );
}
