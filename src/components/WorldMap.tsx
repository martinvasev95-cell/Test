import { useEffect, useMemo, useRef, useState } from 'react';
import { geoNaturalEarth1, geoPath } from 'd3-geo';
import { countriesGeoJSON, type CountryFeature } from '../lib/countries';

interface WorldMapProps {
  visitCounts: Map<string, number>;
  selectedCountryId: string | null;
  onSelectCountry: (id: string) => void;
}

export function WorldMap({ visitCounts, selectedCountryId, onSelectCountry }: WorldMapProps) {
  const containerRef = useRef<HTMLDivElement>(null);
  const [size, setSize] = useState({ width: 960, height: 520 });
  const [hoveredId, setHoveredId] = useState<string | null>(null);

  useEffect(() => {
    const el = containerRef.current;
    if (!el) return;
    const observer = new ResizeObserver((entries) => {
      const entry = entries[0];
      if (!entry) return;
      const { width } = entry.contentRect;
      setSize({ width, height: width * 0.55 });
    });
    observer.observe(el);
    return () => observer.disconnect();
  }, []);

  const path = useMemo(() => {
    const projection = geoNaturalEarth1().fitSize([size.width, size.height], countriesGeoJSON);
    return geoPath(projection);
  }, [size]);

  const hoveredCountry = hoveredId
    ? countriesGeoJSON.features.find((f) => String(f.id) === hoveredId)
    : null;

  return (
    <div className="world-map" ref={containerRef}>
      <svg
        viewBox={`0 0 ${size.width} ${size.height}`}
        width="100%"
        height={size.height}
        role="img"
        aria-label="World map of visited countries"
      >
        <rect x={0} y={0} width={size.width} height={size.height} className="world-map__ocean" />
        {countriesGeoJSON.features.map((feature: CountryFeature) => {
          const id = String(feature.id);
          const count = visitCounts.get(id) ?? 0;
          const visited = count > 0;
          const d = path(feature);
          if (!d) return null;
          return (
            <path
              key={id}
              d={d}
              className={[
                'world-map__country',
                visited ? 'world-map__country--visited' : '',
                id === selectedCountryId ? 'world-map__country--selected' : '',
                id === hoveredId && visited ? 'world-map__country--hovered' : '',
              ]
                .filter(Boolean)
                .join(' ')}
              onClick={() => visited && onSelectCountry(id)}
              onMouseEnter={() => setHoveredId(id)}
              onMouseLeave={() => setHoveredId((current) => (current === id ? null : current))}
            />
          );
        })}
      </svg>
      {hoveredCountry && (
        <div className="world-map__tooltip">
          {hoveredCountry.properties?.name}
          {visitCounts.get(String(hoveredCountry.id)) ? (
            <span className="world-map__tooltip-count">
              {' '}
              · {visitCounts.get(String(hoveredCountry.id))} photo
              {visitCounts.get(String(hoveredCountry.id)) === 1 ? '' : 's'}
            </span>
          ) : null}
        </div>
      )}
    </div>
  );
}
