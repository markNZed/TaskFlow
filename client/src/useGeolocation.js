/*
This Source Code Form is subject to the terms of the Mozilla Public
License, v. 2.0. If a copy of the MPL was not distributed with this
file, You can obtain one at https://mozilla.org/MPL/2.0/.
*/

import { useState, useEffect } from 'react';

export function useGeolocation(enable) {
  const [location, setLocation] = useState({ latitude: null, longitude: null });
  const [address, setAddress] = useState('');
  const [error, setError] = useState(null);

  useEffect(() => {
    if (enable) {
      if (navigator.geolocation) {
        const success = (position) => {
          setLocation({
            latitude: position.coords.latitude,
            longitude: position.coords.longitude,
          });
        };

        const handleError = (error) => {
          setError(error.message);
        };

        navigator.geolocation.getCurrentPosition(success, handleError);
      } else {
        const msg = 'Geolocation is not supported by this browser.'
        setError(msg);
        console.error(msg);
      }
    }
  }, []);

  useEffect(() => {
    if (location.latitude) {
      const reverse_lookup = `https://nominatim.openstreetmap.org/reverse?format=json&lat=${location.latitude}&lon=${location.longitude}&zoom=18&addressdetails=1`
      async function fetchData(reverse_lookup) { 
        let result = await fetch(reverse_lookup)
        .then((response) => response.json())
        .catch((err) => {
            console.log(err.message);
        });
        if (result?.display_name) {
          return result.display_name
        } else {
          return ''
        }
      }
      fetchData(reverse_lookup).then((address) => {
        setAddress(address)
        console.log("Address set " + address)
      })
    }
  }, [location]);

  return { address, error };
}