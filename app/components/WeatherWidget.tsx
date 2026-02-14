'use client';

import { useEffect, useState, useCallback } from 'react';
import { trackEvent } from '@/lib/analytics';

interface WeatherData {
  temperature: number;
  condition: string;
  icon: string;
  high: number;
  low: number;
}

export default function WeatherWidget() {
  const [weather, setWeather] = useState<WeatherData | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const fetchWeather = useCallback(async () => {
    try {
      setLoading(true);
      setError(null);
      
      // Fetch from our API route (server-side proxy to avoid CORS)
      const response = await fetch('/api/weather');
      
      if (!response.ok) throw new Error('Failed to fetch weather');
      
      const data = await response.json();
      
      // Check for error response from API
      if (data.error) throw new Error(data.error);
      
      const weatherCode = data.current.weather_code;
      const condition = getWeatherCondition(weatherCode);
      const icon = getWeatherIcon(weatherCode);
      
      setWeather({
        temperature: Math.round(data.current.temperature_2m),
        condition,
        icon,
        high: Math.round(data.daily.temperature_2m_max[0]),
        low: Math.round(data.daily.temperature_2m_min[0]),
      });
    } catch (err) {
      setError('Unable to load weather');
      console.error('Weather fetch error:', err);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    fetchWeather();
  }, [fetchWeather]);

  const getWeatherCondition = (code: number): string => {
    // WMO Weather interpretation codes
    if (code === 0) return 'Clear';
    if (code <= 3) return 'Partly Cloudy';
    if (code <= 48) return 'Foggy';
    if (code <= 67) return 'Rainy';
    if (code <= 77) return 'Snowy';
    if (code <= 82) return 'Showers';
    if (code <= 86) return 'Snow Showers';
    return 'Thunderstorms';
  };

  const getWeatherIcon = (code: number): string => {
    // Returns Material Icons icon names
    if (code === 0) return 'wb_sunny'; // Clear
    if (code <= 3) return 'wb_cloudy'; // Partly Cloudy
    if (code <= 48) return 'foggy'; // Foggy
    if (code <= 67) return 'rainy'; // Rainy
    if (code <= 77) return 'ac_unit'; // Snowy
    if (code <= 82) return 'grain'; // Showers
    if (code <= 86) return 'weather_snowy'; // Snow Showers
    return 'thunderstorm'; // Thunderstorms
  };

  if (loading) {
    return (
      <div className="bg-[#0B1F3F] rounded-2xl p-4 border border-blue-800/30 backdrop-blur-sm animate-fadeIn">
        <div className="flex items-center justify-between">
          <div className="space-y-2">
            <div className="h-12 bg-blue-800/20 rounded animate-pulse w-24" />
            <div className="h-4 bg-blue-800/20 rounded w-16 animate-pulse" />
          </div>
          <div className="animate-pulse text-4xl text-gray-400">☁️</div>
        </div>
      </div>
    );
  }

  if (error || !weather) {
    return (
      <div className="bg-[#0B1F3F] rounded-3xl p-4  backdrop-blur-sm animate-fadeIn">
        <p className="text-sm text-gray-400">{error}</p>
        <button
          onClick={fetchWeather}
          className="mt-2 px-3 py-1 bg-berkeley-blue/20 hover:bg-berkeley-blue/30 rounded-lg text-xs transition-colors"
        >
          Retry
        </button>
      </div>
    );
  }

const handleClick = () => {
    trackEvent('weather_clicked');
    window.open('https://www.timeanddate.com/weather/usa/berkeley', '_blank');
  };

  return (
    <div 
      onClick={handleClick}
      className="-mt-2 flex flex-col justify-center backdrop-blur-sm w-1/2 lg:w-1/2 lg:ml-auto px-2 h-17 mb-0 lg:mb-1 backdrop-blur-lg shadow-[0_2px_8px_-2px_rgba(0,0,0,0.08)] saturate-[80%] cursor-pointer hover:bg-white/5 transition-colors"
      title="View detailed Berkeley weather"
    >
      {/* Small screens: All elements in one horizontal line */}
      {/* Large screens: Header on top (right-aligned), content below in two columns */}
      
      {/* Header - hidden on small, shown on large */}
      <div className="hidden lg:flex justify-end mb-0">
        <span className="text-sm font-semibold whitespace-nowrap">
          <span className="text-gray-200">UC Berkeley</span> <span className="text-gray-400">Weather</span>
        </span>
      </div>
      
      {/* Small screen: header stacked above, elements in horizontal row */}
      <div className="flex flex-col lg:hidden justify-start gap-0">
        {/* Header on top */}
        <span className="text-sm font-semibold whitespace-nowrap mb-0">
          <span className="text-gray-200">UC Berkeley</span> <span className="text-gray-400">Weather</span>
        </span>
        
        {/* All elements in horizontal row below */}
        <div className="flex flex-row items-center justify-start gap-2">
          <div className="flex items-baseline gap-0">
            <span className="text-md font-semibold text-white">{weather.temperature}°</span>
            <span className="text-xs text-gray-600 translate-y-1">F</span>
          </div>

          <div className="flex flex-row items-center gap-1">
            <i className="material-icons text-gray-200" style={{ fontSize: '20px' }}>
              {weather.icon}
            </i>
            <p className="text-xs font-medium text-gray-400 mt-0">{weather.condition}</p>
          </div>
        </div>
      </div>
      
      {/* Large screen: two column layout */}
      <div className="hidden lg:flex justify-end gap-1">
        {/* Column 1: Temperature Data */}
        <div className="flex flex-col pr-0">
          <div className="flex gap-1">
            <div className="flex items-baseline gap-0">
              <span className="text-md font-semibold text-white">
                {weather.temperature}°
              </span>
              <span className="text-xs text-gray-600 translate-y-1">F</span>
            </div>
            
            {/* High/Low - vertical on large */}
            <div className="flex flex-col gap-0">
              <div className="flex items-center gap-1">
                <span className="text-red-400/60 text-xs">↑</span>
                <span className="text-xs text-gray-400">{weather.high}°</span>
              </div>
              <div className="flex items-center -mt-1 gap-1">
                <span className="text-blue-400/60 text-xs">↓</span>
                <span className="text-xs text-gray-400">{weather.low}°</span>
              </div>
            </div>
          </div>
        </div>

        {/* Column 2: Weather Icon & Condition */}
        <div className="flex flex-row items-center gap-1">
          <i className="material-icons text-gray-200" style={{ fontSize: '20px' }}>
            {weather.icon}
          </i>
          <p className="text-xs font-medium text-gray-400 mt-0">{weather.condition}</p>
        </div>
      </div>
    </div>
);
}
