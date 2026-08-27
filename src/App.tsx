import { useEffect, useMemo, useState } from 'react';
import './App.css';
import type { Visit } from './types';
import { loadVisits, saveVisits } from './lib/db';
import { getCountryName } from './lib/countries';
import { WorldMap } from './components/WorldMap';
import { ImportButton } from './components/ImportButton';
import { CountryPanel } from './components/CountryPanel';

export default function App() {
  const [visits, setVisits] = useState<Visit[]>([]);
  const [loaded, setLoaded] = useState(false);
  const [selectedCountryId, setSelectedCountryId] = useState<string | null>(null);

  useEffect(() => {
    loadVisits().then((stored) => {
      setVisits(stored);
      setLoaded(true);
    });
  }, []);

  // Persist any time the visit list changes, once the initial load has
  // happened (otherwise the empty initial state would clobber storage).
  useEffect(() => {
    if (loaded) saveVisits(visits);
  }, [visits, loaded]);

  const visitCounts = useMemo(() => {
    const counts = new Map<string, number>();
    for (const v of visits) counts.set(v.countryId, (counts.get(v.countryId) ?? 0) + 1);
    return counts;
  }, [visits]);

  const countryCount = visitCounts.size;
  const selectedVisits = useMemo(
    () => visits.filter((v) => v.countryId === selectedCountryId),
    [visits, selectedCountryId],
  );

  function handleImported(newVisits: Visit[]) {
    setVisits((prev) => [...prev, ...newVisits]);
  }

  function handleDeleteVisit(id: string) {
    const next = visits.filter((v) => v.id !== id);
    setVisits(next);
    // Close the panel if that was the country's last remaining photo.
    if (selectedCountryId && !next.some((v) => v.countryId === selectedCountryId)) {
      setSelectedCountryId(null);
    }
  }

  function handleClearAll() {
    if (!confirm('Remove all imported photos and visited countries? This cannot be undone.')) {
      return;
    }
    setVisits([]);
    setSelectedCountryId(null);
  }

  return (
    <div className="app">
      <header className="app__header">
        <div>
          <h1>Travel Map</h1>
          <p className="app__stats">
            {countryCount} {countryCount === 1 ? 'country' : 'countries'} · {visits.length} photo
            {visits.length === 1 ? '' : 's'}
          </p>
        </div>
        <div className="app__actions">
          <ImportButton onImported={handleImported} />
          {visits.length > 0 && (
            <button className="app__clear" onClick={handleClearAll}>
              Clear all
            </button>
          )}
        </div>
      </header>

      <main className="app__main">
        <WorldMap
          visitCounts={visitCounts}
          selectedCountryId={selectedCountryId}
          onSelectCountry={setSelectedCountryId}
        />
        {selectedCountryId && (
          <CountryPanel
            countryName={getCountryName(selectedCountryId)}
            visits={selectedVisits}
            onClose={() => setSelectedCountryId(null)}
            onDeleteVisit={handleDeleteVisit}
          />
        )}
      </main>

      {loaded && visits.length === 0 && (
        <div className="app__empty">
          <p>
            Tap <strong>Import photos</strong> and choose photos from your library. Photos with
            location data will be pinned to their country — click a highlighted country to see
            the date and photo.
          </p>
        </div>
      )}
    </div>
  );
}
