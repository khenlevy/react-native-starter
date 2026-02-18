import Geolocation from '@react-native-community/geolocation';
// or: import * as Location from 'expo-location';
import { requestLocationPermission } from './permissions';

const API_URL = 'https://parcus-backend.fly.dev/api/nearby-businesses';

export async function startLocationTracking() {
  const hasPermission = await requestLocationPermission();
  if (!hasPermission) {
    console.warn('Location permission denied');
    return;
  }

  Geolocation.getCurrentPosition(
    position => {
      const { latitude, longitude } = position.coords;
      console.log(`Sending location: ${latitude}, ${longitude}`);

      fetch(`${API_URL}?latitude=${latitude}&longitude=${longitude}`)
        .then(response => response.json())
        .then(data => {
          console.log('Nearby businesses:', data);
        })
        .catch(error => {
          console.error('Failed to fetch nearby businesses:', error);
        });
    },
    error => {
      console.error('Location error:', error.message);
    },
    { enableHighAccuracy: true, timeout: 10000, maximumAge: 10000 }
  );
}
