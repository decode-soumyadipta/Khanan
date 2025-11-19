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
        <div className="bg-linear-to-r from-blue-50 to-indigo-50 rounded-lg p-4 border border-blue-200">
          <div className="flex items-center space-x-3">
            <div className="bg-blue-500 rounded-full p-2">
              <User className="text-white" size={20} />
            </div>
            <div>
              <p className="text-sm text-gray-600">Logged in as</p>
              <p className="font-semibold text-gray-900">{user.name}</p>
              <p className="text-xs text-gray-500">{user.email}</p>
            </div>
          </div>
        </div>
      )}

      {/* Search Box */}
      <div className="bg-white rounded-lg shadow-md p-4">
        <label className="block text-sm font-semibold text-gray-700 mb-3">
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
              className="flex-1 px-4 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500 text-sm"
              disabled={isSearching}
            />
            <button
              onClick={handleSearch}
              disabled={isSearching}
              className="px-4 py-2 bg-blue-500 text-white rounded-lg hover:bg-blue-600 disabled:bg-gray-400 transition-colors font-semibold text-sm"
            >
              {isSearching ? 'Searching...' : 'Search'}
            </button>
          </div>

          {/* Search Results / Suggestions Dropdown */}
          {showSuggestions && (
            <div className="border border-gray-200 rounded-lg bg-white shadow-lg max-h-80 overflow-y-auto">
              {/* Recent Searches */}
              {recentSearches.length > 0 && !searchQuery && (
                <>
                  <div className="px-4 py-2 bg-gray-50 border-b text-xs font-semibold text-gray-600 sticky top-0">
                    📍 Recent Searches
                  </div>
                  {recentSearches.map((item, idx) => (
                    <button
                      key={`recent-${idx}`}
                      onClick={() => {
                        setSearchQuery(item);
                        handleSearch();
                      }}
                      className="w-full text-left px-4 py-2 hover:bg-blue-50 transition-colors border-b border-gray-100 last:border-b-0"
                    >
                      <p className="text-sm text-gray-700">{item}</p>
                    </button>
                  ))}
                  <div className="border-t"></div>
                </>
              )}

              {/* Suggested Coal Mining Locations */}
              {!searchQuery && (
                <>
                  <div className="px-4 py-2 bg-gray-50 text-xs font-semibold text-gray-600">
                    ⛏️ Suggested Coal Mining Regions
                  </div>
                  {suggestedLocations.map((location, idx) => (
                    <button
                      key={`suggested-${idx}`}
                      onClick={() => handleSuggestedLocation(location)}
                      className="w-full text-left px-4 py-2 hover:bg-amber-50 transition-colors border-b border-gray-100 last:border-b-0"
                    >
                      <p className="text-sm font-medium text-gray-800">{location.name}</p>
                      <p className="text-xs text-gray-600">{location.displayName}</p>
                    </button>
                  ))}
                </>
              )}

              {/* Search Results */}
              {searchResults.length > 0 && (
                <>
                  <div className="px-4 py-2 bg-gray-50 text-xs font-semibold text-gray-600">
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
                      className="w-full text-left px-4 py-2 hover:bg-green-50 transition-colors border-b border-gray-100 last:border-b-0"
                    >
                      <p className="font-medium text-gray-900 text-sm">{result.name}</p>
                      <p className="text-xs text-gray-500">{result.displayName}</p>
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
      <div className="bg-white rounded-lg shadow-md p-4">
        <h3 className="text-sm font-semibold text-gray-700 mb-3">
          Area of Interest (AOI)
        </h3>
        <div className="space-y-2">
          <button
            className="w-full flex items-center justify-center space-x-2 px-4 py-3 bg-indigo-500 text-white rounded-lg hover:bg-indigo-600 transition-colors font-semibold"
          >
            <Edit3 size={18} />
            <span>Draw Polygon on Map</span>
          </button>
        </div>
      </div>

      {/* Analysis */}
      <div className="bg-white rounded-lg shadow-md p-4">
        <h3 className="text-sm font-semibold text-gray-700 mb-3">
          Run Analysis
        </h3>
        <button
          onClick={onStartAnalysis}
          disabled={!canStartAnalysis}
          className={`w-full flex items-center justify-center space-x-2 px-4 py-3 rounded-lg font-semibold transition-colors ${
            canStartAnalysis
              ? 'bg-green-500 text-white hover:bg-green-600'
              : 'bg-gray-300 text-gray-500 cursor-not-allowed'
          }`}
        >
          <Play size={18} />
          <span>Start Mining Detection</span>
        </button>
        {!canStartAnalysis && (
          <p className="text-xs text-gray-500 mt-2 text-center">
            Please create an AOI first
          </p>
        )}
      </div>
    </div>
  );
};

export default ControlPanel;
