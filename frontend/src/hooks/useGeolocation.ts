import { useEffect, useState } from 'react';
import api from '../api';

export function useGeolocation() {
    const [coords, setCoords] = useState<{ lat: number; lng: number } | null>(null);

    useEffect(() => {
        if (!navigator.geolocation) return;

        const watchId = navigator.geolocation.watchPosition(
            (pos) => {
                const newCoords = {
                    lat: pos.coords.latitude,
                    lng: pos.coords.longitude
                };
                setCoords(newCoords);

                // Update backend silently
                api.post('/auth/update-location', newCoords).catch(() => { });
            },
            (err) => console.error("Geolocation error:", err),
            { enableHighAccuracy: true, timeout: 10000, maximumAge: 60000 }
        );

        return () => navigator.geolocation.clearWatch(watchId);
    }, []);

    return coords;
}
