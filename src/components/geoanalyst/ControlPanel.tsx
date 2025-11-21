'use client';

import React, { useState } from 'react';
import { Search, Edit3, Play, User } from 'lucide-react';
import { AOI } from '@/types/geoanalyst';
import { searchLocation } from '@/services/geoanalyst/api';
import { useAuth } from '@/contexts/AuthContext';

interface ControlPanelProps {
  onAOICreated: (aoi: AOI) => void;
  onStartAnalysis: () => void;
  canStartAnalysis: boolean;
  onLocationSearch?: (lat: number, lng: number) => void;
}

const ControlPanel: React.FC<ControlPanelProps> = ({
  onAOICreated,
  onStartAnalysis,
  canStartAnalysis,
  onLocationSearch,
}) => {
  const { user } = useAuth();
  const [searchQuery, setSearchQuery] = useState('');
  const [searchResults, setSearchResults] = useState<any[]>([]);
  const [isSearching, setIsSearching] = useState(false);
  const [showSuggestions, setShowSuggestions] = useState(false);
  const [recentSearches, setRecentSearches] = useState<string[]>([]);

  // Popular coal mining regions
  const suggestedLocations = [
    { name: 'Chhattisgarh', displayName: 'Chhattisgarh, India - Major Coal Mining Region', coordinates: { latitude: 21.8787, longitude: 81.8661 } },
    { name: 'Jharkhand', displayName: 'Jharkhand, India - Coal Mining Hub', coordinates: { latitude: 23.6102, longitude: 85.2799 } },
    { name: 'Odisha', displayName: 'Odisha, India - Eastern Coal Region', coordinates: { latitude: 20.9517, longitude: 85.0985 } },
    { name: 'Madhya Pradesh', displayName: 'Madhya Pradesh, India - Coal Mining Zone', coordinates: { latitude: 22.9734, longitude: 78.6569 } },
    { name: 'West Bengal', displayName: 'West Bengal, India - Raniganj Coal Belt', coordinates: { latitude: 23.8103, longitude: 87.1312 } },
    { name: 'Newcastle', displayName: 'Newcastle, Australia - Coal Mining Region', coordinates: { latitude: -32.9167, longitude: 151.7833 } },
    { name: 'Appalachia', displayName: 'Appalachia, USA - Coal Mining Region', coordinates: { latitude: 38.5976, longitude: -82.4554 } },
  ];

  // Load recent searches from localStorage
  React.useEffect(() => {
    const stored = localStorage.getItem('recentLocationSearches');
    if (stored) {
      setRecentSearches(JSON.parse(stored));
    }
  }, []);

  // Save search to recent searches
  const addToRecentSearches = (query: string) => {
    const updated = [query, ...recentSearches.filter(s => s !== query)].slice(0, 5);
    setRecentSearches(updated);
    localStorage.setItem('recentLocationSearches', JSON.stringify(updated));
  };

  const handleSearch = async () => {
    if (!searchQuery.trim()) return;

    setIsSearching(true);
    try {
      const results = await searchLocation(searchQuery);
      setSearchResults(results);
      addToRecentSearches(searchQuery);

      // Auto-select first result
      if (results.length > 0 && onLocationSearch) {
        const { latitude, longitude } = results[0].coordinates;
        onLocationSearch(latitude, longitude);
      }
    } catch (error) {
      console.error('Search error:', error);
    } finally {
      setIsSearching(false);
    }
  };

  const handleSuggestedLocation = (location: any) => {
    if (onLocationSearch) {
      onLocationSearch(location.coordinates.latitude, location.coordinates.longitude);
    }
    setSearchQuery(location.name);
    addToRecentSearches(location.name);
    setShowSuggestions(false);
  };

  const handleKeyPress = (e: React.KeyboardEvent) => {
    if (e.key === 'Enter') {
      handleSearch();
    }
  };

  return (
    <div className="space-y-4 p-4">
      {/* User Info */}
      {user && (
        <div className="bg-gradient-to-r from-amber-50 via-orange-50 to-red-50 rounded-xl p-4 border border-amber-200 shadow-[0_16px_32px_rgba(217,119,6,0.12)]">
          <div className="flex items-center space-x-3">
            <div className="bg-gradient-to-br from-amber-500 to-orange-600 rounded-full p-2 shadow-[0_8px_16px_rgba(217,119,6,0.3)]">
              <User className="text-white" size={20} />
            </div>
            <div>
              <p className="text-sm text-amber-700">Logged in as</p>
              <p className="font-semibold text-amber-900">{user.name}</p>
              <p className="text-xs text-amber-700">{user.email}</p>
            </div>
          </div>
        </div>
      )}

      {/* Search Box */}
      <div className="bg-gradient-to-br from-amber-50 via-orange-50 to-yellow-50 rounded-xl shadow-[0_18px_42px_rgba(217,119,6,0.14)] p-4 border border-amber-200/70">
        <label className="block text-sm font-semibold text-amber-900 mb-3">
          <Search className="inline mr-2" size={16} />
          Search Location
        </label>
        <div className="space-y-3">
          <div className="flex space-x-2">
            <input
              type="text"
              value={searchQuery}
              onChange={(e) => {
                setSearchQuery(e.target.value);
                setShowSuggestions(true);
              }}
              onKeyPress={handleKeyPress}
              onFocus={() => setShowSuggestions(true)}
              placeholder="Enter city name, region, or coordinates..."
              className="flex-1 px-4 py-2 border border-amber-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-amber-500 text-sm bg-white/80 text-gray-900"
              disabled={isSearching}
            />
            <button
              onClick={handleSearch}
              disabled={isSearching}
              className="px-4 py-2 bg-gradient-to-r from-amber-500 to-orange-600 text-white rounded-lg hover:from-amber-600 hover:to-orange-700 disabled:from-gray-400 disabled:to-gray-500 transition-all font-semibold text-sm shadow-[0_8px_16px_rgba(217,119,6,0.25)]"
            >
              {isSearching ? 'Searching...' : 'Search'}
            </button>
          </div>

          {/* Search Results / Suggestions Dropdown */}
          {showSuggestions && (
            <div className="border border-amber-200/70 rounded-lg bg-white/95 shadow-[0_20px_48px_rgba(217,119,6,0.18)] max-h-80 overflow-y-auto">
              {/* Recent Searches */}
              {recentSearches.length > 0 && !searchQuery && (
                <>
                  <div className="px-4 py-2 bg-gradient-to-r from-amber-50 to-orange-50 border-b border-amber-100 text-xs font-semibold text-amber-800 sticky top-0">
                    📍 Recent Searches
                  </div>
                  {recentSearches.map((item, idx) => (
                    <button
                      key={`recent-${idx}`}
                      onClick={() => {
                        setSearchQuery(item);
                        handleSearch();
                      }}
                      className="w-full text-left px-4 py-2 hover:bg-amber-50 transition-colors border-b border-amber-50 last:border-b-0"
                    >
                      <p className="text-sm text-amber-900">{item}</p>
                    </button>
                  ))}
                  <div className="border-t"></div>
                </>
              )}

              {/* Suggested Coal Mining Locations */}
              {!searchQuery && (
                <>
                  <div className="px-4 py-2 bg-gradient-to-r from-amber-50 to-orange-50 border-b border-amber-100 text-xs font-semibold text-amber-800">
                    ⛏️ Suggested Coal Mining Regions
                  </div>
                  {suggestedLocations.map((location, idx) => (
                    <button
                      key={`suggested-${idx}`}
                      onClick={() => handleSuggestedLocation(location)}
                      className="w-full text-left px-4 py-2 hover:bg-yellow-50 transition-colors border-b border-amber-50 last:border-b-0"
                    >
                      <p className="text-sm font-medium text-amber-900">{location.name}</p>
                      <p className="text-xs text-amber-700">{location.displayName}</p>
                    </button>
                  ))}
                </>
              )}

              {/* Search Results */}
              {searchResults.length > 0 && (
                <>
                  <div className="px-4 py-2 bg-gradient-to-r from-amber-50 to-orange-50 border-b border-amber-100 text-xs font-semibold text-amber-800">
                    🔍 Search Results
                  </div>
                  {searchResults.slice(0, 8).map((result, index) => (
                    <button
                      key={`result-${index}`}
                      onClick={() => {
                        if (onLocationSearch) {
                          onLocationSearch(
                            result.coordinates.latitude,
                            result.coordinates.longitude
                          );
                        }
                        setShowSuggestions(false);
                      }}
                      className="w-full text-left px-4 py-2 hover:bg-yellow-50 transition-colors border-b border-amber-50 last:border-b-0"
                    >
                      <p className="font-medium text-amber-900 text-sm">{result.name}</p>
                      <p className="text-xs text-amber-700">{result.displayName}</p>
                    </button>
                  ))}
                </>
              )}

              {!searchResults.length && searchQuery && !isSearching && (
                <div className="px-4 py-3 text-center text-sm text-gray-500">
                  No results found for "{searchQuery}"
                </div>
              )}
            </div>
          )}
        </div>
      </div>

      {/* AOI Tools */}
      <div className="bg-gradient-to-br from-amber-50 via-orange-50 to-yellow-50 rounded-xl shadow-[0_18px_42px_rgba(217,119,6,0.14)] p-4 border border-amber-200/70">
        <h3 className="text-sm font-semibold text-amber-900 mb-3">
          Area of Interest (AOI)
        </h3>
        <div className="space-y-2">
          <button
            className="w-full flex items-center justify-center space-x-2 px-4 py-3 bg-gradient-to-r from-orange-500 to-amber-600 text-white rounded-lg hover:from-orange-600 hover:to-amber-700 transition-all font-semibold shadow-[0_10px_24px_rgba(217,119,6,0.25)]"
          >
            <Edit3 size={18} />
            <span>Draw Polygon on Map</span>
          </button>
        </div>
      </div>

      {/* Analysis */}
      <div className="bg-gradient-to-br from-amber-50 via-orange-50 to-yellow-50 rounded-xl shadow-[0_18px_42px_rgba(217,119,6,0.14)] p-4 border border-amber-200/70">
        <h3 className="text-sm font-semibold text-amber-900 mb-3">
          Run Analysis
        </h3>
        <button
          onClick={onStartAnalysis}
          disabled={!canStartAnalysis}
          className={`w-full flex items-center justify-center space-x-2 px-4 py-3 rounded-lg font-semibold transition-all ${
            canStartAnalysis
              ? 'bg-gradient-to-r from-emerald-500 to-teal-600 text-white hover:from-emerald-600 hover:to-teal-700 shadow-[0_10px_24px_rgba(16,185,129,0.25)]'
              : 'bg-gradient-to-r from-gray-300 to-gray-400 text-gray-600 cursor-not-allowed'
          }`}
        >
          <Play size={18} />
          <span>Start Mining Detection</span>
        </button>
        {!canStartAnalysis && (
          <p className="text-xs text-amber-700 mt-2 text-center">
            Please create an AOI first
          </p>
        )}
      </div>
    </div>
  );
};

export default ControlPanel;
