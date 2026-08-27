import { useEffect, useState } from 'react';
import type { Visit } from '../types';

interface CountryPanelProps {
  countryName: string;
  visits: Visit[];
  onClose: () => void;
  onDeleteVisit: (id: string) => void;
}

function formatDate(iso: string | null): string {
  if (!iso) return 'Date unknown';
  return new Date(iso).toLocaleDateString(undefined, {
    year: 'numeric',
    month: 'long',
    day: 'numeric',
  });
}

export function CountryPanel({ countryName, visits, onClose, onDeleteVisit }: CountryPanelProps) {
  const sorted = [...visits].sort((a, b) => (b.dateTaken ?? '').localeCompare(a.dateTaken ?? ''));
  const [activeId, setActiveId] = useState(sorted[0]?.id ?? null);

  // Keep the active photo valid as visits change (e.g. after a delete, or
  // when a different country is selected).
  useEffect(() => {
    if (!sorted.some((v) => v.id === activeId)) {
      setActiveId(sorted[0]?.id ?? null);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [visits]);

  const active = sorted.find((v) => v.id === activeId) ?? sorted[0] ?? null;

  return (
    <aside className="country-panel">
      <div className="country-panel__header">
        <h2>{countryName}</h2>
        <button className="country-panel__close" onClick={onClose} aria-label="Close">
          ×
        </button>
      </div>
      <p className="country-panel__count">
        {visits.length} photo{visits.length === 1 ? '' : 's'}
      </p>

      {active && (
        <figure className="country-panel__photo">
          <img src={active.photoDataUrl} alt={`Photo taken in ${countryName}`} />
          <figcaption>
            <span className="country-panel__date">{formatDate(active.dateTaken)}</span>
            <button
              className="country-panel__delete"
              onClick={() => onDeleteVisit(active.id)}
              aria-label="Remove this photo"
            >
              Remove
            </button>
          </figcaption>
        </figure>
      )}

      {sorted.length > 1 && (
        <div className="country-panel__strip">
          {sorted.map((v) => (
            <button
              key={v.id}
              className={
                'country-panel__thumb' +
                (v.id === active?.id ? ' country-panel__thumb--active' : '')
              }
              onClick={() => setActiveId(v.id)}
              aria-label={`Show photo from ${formatDate(v.dateTaken)}`}
            >
              <img src={v.photoDataUrl} alt="" />
            </button>
          ))}
        </div>
      )}
    </aside>
  );
}
