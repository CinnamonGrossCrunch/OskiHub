'use client';

import { useEffect, useState, useCallback } from 'react';

interface TravelTimeData {
  driving: {
    duration: number;
    distance: string;
    formatted: string;
  } | null;
  transit: {
    duration: number;
    distance: string;
    formatted: string;
  } | null;
  destination: string;
}

export default function TravelTimeWidget() {
  const [travelTime, setTravelTime] = useState<TravelTimeData | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [locationDenied, setLocationDenied] = useState(false);
  const [debugInfo, setDebugInfo] = useState<string>('init');

  const fetchTravelTime = useCallback(async () => {
    try {
      setLoading(true);
      setError(null);
      setLocationDenied(false);
      setDebugInfo('getting location...');
      
      // Get user's current location
      if (!navigator.geolocation) {
        setDebugInfo('no geolocation API');
        throw new Error('Geolocation not supported');
      }

      navigator.geolocation.getCurrentPosition(
        async (position) => {
          const { latitude, longitude } = position.coords;
          console.log('📍 Got location:', { latitude, longitude });
          setDebugInfo(`loc: ${latitude.toFixed(2)}, ${longitude.toFixed(2)}`);
          
          // Call our API route with user's location
          try {
            setDebugInfo('fetching API...');
            const response = await fetch('/api/travel-time', {
              method: 'POST',
              headers: {
                'Content-Type': 'application/json',
              },
              body: JSON.stringify({
                origin: { latitude, longitude }
              })
            });
            
            console.log('🚗 Travel time API status:', response.status);
            setDebugInfo(`API status: ${response.status}`);
            
            if (!response.ok) {
              const errorText = await response.text();
              console.error('🚗 Travel time API failed:', errorText);
              throw new Error('Failed to fetch travel time');
            }
          
            const data = await response.json();
            
            console.log('🚗 Travel time API response:', JSON.stringify(data, null, 2));
            
            if (data.error) {
              console.error('🚗 Travel time API error:', data.error);
              throw new Error(data.error);
            }
            
            setTravelTime(data);
            setDebugInfo(`done: d=${data.driving?.duration || 'null'}, t=${data.transit?.duration || 'null'}`);
            setLoading(false);
          } catch (fetchErr) {
            console.error('🚗 Fetch error in callback:', fetchErr);
            setDebugInfo(`fetch err: ${fetchErr}`);
            setError('Failed to get travel time');
            setLoading(false);
          }
        },
        (error) => {
          console.error('📍 Geolocation error:', error.code, error.message);
          setDebugInfo(`geo err: ${error.code} ${error.message}`);
          setLocationDenied(true);
          setError('Location access denied');
          setLoading(false);
        },
        {
          enableHighAccuracy: false,
          timeout: 15000,  // Increased timeout for iOS
          maximumAge: 300000 // Cache location for 5 minutes
        }
      );
    } catch (err) {
      setError('Unable to load travel time');
      console.error('Travel time fetch error:', err);
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    fetchTravelTime();
  }, [fetchTravelTime]);

  if (loading) {
    return (
      <div className="rounded-3xl items-start backdrop-blur-sm mt-0">
        <div className="flex justify-end mb-1">
          <span className="text-xs font-bold">
            <span className="text-gray-200">Time to</span>{' '}
            <span className="text-gray-400">Haas</span>
          </span>
        </div>
        <div className="flex flex-col gap-1 items-end">
          <div className="h-4 bg-gray-700/30 rounded animate-pulse w-24" />
          <div className="h-4 bg-gray-700/30 rounded animate-pulse w-24" />
          {/* Debug info - remove after testing */}
          <span className="text-[10px] text-yellow-500">{debugInfo}</span>
        </div>
      </div>
    );
  }

  if (error || locationDenied) {
    return (
      <div className="rounded-3xl items-start backdrop-blur-sm mt-0">
        <div className="flex justify-end mb-1">
          <span className="text-xs font-bold">
            <span className="text-gray-200">Time to</span>{' '}
            <span className="text-gray-400">Haas</span>
          </span>
        </div>
        <button
          onClick={fetchTravelTime}
          className="text-xs text-gray-400 hover:text-gray-300 transition-colors"
        >
          📍 Enable Location to get travel times
        </button>
      </div>
    );
  }

  if (!travelTime || (!travelTime.driving && !travelTime.transit)) {
    // Show a minimal indicator instead of hiding completely
    return (
      <div className="lg:border-t-3 border-dotted flex flex-col justify-center backdrop-blur-sm w-1/2 lg:w-auto lg:ml-auto px-2 mb-0 lg:mb-1 backdrop-blur-lg shadow-[0_2px_8px_-2px_rgba(0,0,0,0.08)] saturate-[80%] lg:pt-1 -mt-2 lg:-mt-2" style={{ borderTopColor: '#9ca3af31' }}>
        <div className="flex justify-end mb-0">
          <span className="text-sm font-medium">
            <span className="text-gray-200">Time</span>{' '}
            <span className="text-gray-400">To Haas</span>
          </span>
        </div>
        <div className="flex justify-end">
          <span className="text-xs text-gray-500">No route data</span>
        </div>
      </div>
    );
  }

  return (
    <div className="lg:border-t-3 border-dotted flex flex-col justify-center backdrop-blur-sm w-1/2 lg:w-auto lg:ml-auto px-2 mb-0 lg:mb-1 backdrop-blur-lg shadow-[0_2px_8px_-2px_rgba(0,0,0,0.08)] saturate-[80%] lg:pt-1 -mt-2 lg:-mt-2" style={{ borderTopColor: '#9ca3af31' }}>
      {/* Small screens: All elements in one horizontal line */}
      {/* Large screens: Header on top (right-aligned), driving/transit below (horizontal) */}
      
      {/* Header - hidden on small, shown on large */}
      <div className="hidden lg:flex justify-end mb-0">
        <span className="text-sm font-medium">
          <span className="text-gray-200">Time</span>{' '}
          <span className="text-gray-400">To Haas</span>
        </span>
      </div>
      
      {/* Small screen: header stacked above, elements in horizontal row */}
      <div className="flex flex-col lg:hidden justify-end gap-0">
        {/* Header on top */}
        <span className="text-sm font-medium whitespace-nowrap mb-0 text-right">
          <span className="text-gray-200">Time</span>{' '}
          <span className="text-gray-400">To Haas</span>
        </span>
        
        {/* Driving/Transit in horizontal row below */}
        <div className="flex flex-row items-center justify-end gap-2">
          {travelTime.driving && (
            <div className="flex items-center gap-1">
              <svg className="w-4 h-4 text-gray-200" fill="currentColor" viewBox="0 0 24 24">
                <path d="M18.92 6.01C18.72 5.42 18.16 5 17.5 5h-11c-.66 0-1.21.42-1.42 1.01L3 12v8c0 .55.45 1 1 1h1c.55 0 1-.45 1-1v-1h12v1c0 .55.45 1 1 1h1c.55 0 1-.45 1-1v-8l-2.08-5.99zM6.5 16c-.83 0-1.5-.67-1.5-1.5S5.67 13 6.5 13s1.5.67 1.5 1.5S7.33 16 6.5 16zm11 0c-.83 0-1.5-.67-1.5-1.5s.67-1.5 1.5-1.5 1.5.67 1.5 1.5-.67 1.5-1.5 1.5zM5 11l1.5-4.5h11L19 11H5z"/>
              </svg>
              <span className="text-md font-medium text-gray-200 whitespace-nowrap">{travelTime.driving.formatted.replace(' min', '')}<span className="text-xs font-light text-gray-500"> min</span></span>
            </div>
          )}
          
          {travelTime.transit && (
            <div className="flex items-center gap-1">
              <svg className="w-5 h-4 text-gray-300" fill="currentColor" viewBox="0 0 24 24">
                <path d="M12 2c-4 0-8 .5-8 4v9.5C4 17.43 5.57 19 7.5 19L6 20.5v.5h2l2-2h4l2 2h2v-.5L16.5 19c1.93 0 3.5-1.57 3.5-3.5V6c0-3.5-4-4-8-4zM7.5 17c-.83 0-1.5-.67-1.5-1.5S6.67 14 7.5 14s1.5.67 1.5 1.5S8.33 17 7.5 17zm3.5-6H6V6h5v5zm5.5 6c-.83 0-1.5-.67-1.5-1.5s.67-1.5 1.5-1.5 1.5.67 1.5 1.5-.67 1.5-1.5 1.5zm1.5-6h-5V6h5v5z"/>
              </svg>
              <span className="text-md font-medium text-gray-200 whitespace-nowrap">{travelTime.transit.formatted.replace(' min', '')}<span className="text-xs font-light text-gray-500"> min</span></span>
            </div>
          )}
        </div>
      </div>
      
      {/* Large screen: header above, driving/transit horizontal below */}
      <div className="hidden lg:flex gap-4 items-center justify-end -mt-1">
        {travelTime.driving && (
          <div className="flex items-center gap-2">
            <svg className="w-5 h-5 text-gray-200" fill="currentColor" viewBox="0 0 24 24">
              <path d="M18.92 6.01C18.72 5.42 18.16 5 17.5 5h-11c-.66 0-1.21.42-1.42 1.01L3 12v8c0 .55.45 1 1 1h1c.55 0 1-.45 1-1v-1h12v1c0 .55.45 1 1 1h1c.55 0 1-.45 1-1v-8l-2.08-5.99zM6.5 16c-.83 0-1.5-.67-1.5-1.5S5.67 13 6.5 13s1.5.67 1.5 1.5S7.33 16 6.5 16zm11 0c-.83 0-1.5-.67-1.5-1.5s.67-1.5 1.5-1.5 1.5.67 1.5 1.5-.67 1.5-1.5 1.5zM5 11l1.5-4.5h11L19 11H5z"/>
            </svg>
            <div className="flex flex-col">
              <span>
                <span className="text-md font-medium text-gray-200 whitespace-nowrap">{travelTime.driving.formatted.replace(' min', '')}<span className="text-xs font-light text-gray-500"> min</span></span>
              </span>
            </div>
          </div>
        )}
        
        {travelTime.transit && (
          <div className="flex items-center justify-end gap-2">
            <svg className="w-6 h-5 text-gray-300" fill="currentColor" viewBox="0 0 24 24">
              <path d="M12 2c-4 0-8 .5-8 4v9.5C4 17.43 5.57 19 7.5 19L6 20.5v.5h2l2-2h4l2 2h2v-.5L16.5 19c1.93 0 3.5-1.57 3.5-3.5V6c0-3.5-4-4-8-4zM7.5 17c-.83 0-1.5-.67-1.5-1.5S6.67 14 7.5 14s1.5.67 1.5 1.5S8.33 17 7.5 17zm3.5-6H6V6h5v5zm5.5 6c-.83 0-1.5-.67-1.5-1.5s.67-1.5 1.5-1.5 1.5.67 1.5 1.5-.67 1.5-1.5 1.5zm1.5-6h-5V6h5v5z"/>
            </svg>
            <div className="flex flex-col">
              <span>
                <span className="text-md font-medium text-gray-200 whitespace-nowrap">{travelTime.transit.formatted.replace(' min', '')}<span className="text-xs font-light text-gray-500"> min</span></span>
              </span>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}