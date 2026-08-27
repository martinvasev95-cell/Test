import { useState } from 'react';
import type { PendingPhoto } from '../types';
import { countryFeatures } from '../lib/countries';

const countryOptions = countryFeatures
  .map((f) => ({ id: String(f.id), name: f.properties?.name ?? 'Unknown' }))
  .sort((a, b) => a.name.localeCompare(b.name));

interface PendingPhotosProps {
  photos: PendingPhoto[];
  onAssign: (photoId: string, countryId: string, date: string | null) => void;
  onDiscard: (photoId: string) => void;
}

function toDateInputValue(iso: string | null): string {
  return iso ? iso.slice(0, 10) : '';
}

function Row({
  photo,
  onAssign,
  onDiscard,
}: {
  photo: PendingPhoto;
  onAssign: PendingPhotosProps['onAssign'];
  onDiscard: PendingPhotosProps['onDiscard'];
}) {
  const [countryId, setCountryId] = useState('');
  const [date, setDate] = useState(toDateInputValue(photo.dateTaken));

  return (
    <li className="pending-photos__row">
      <img src={photo.photoDataUrl} alt="" className="pending-photos__thumb" />
      <div className="pending-photos__fields">
        <select
          value={countryId}
          onChange={(e) => setCountryId(e.target.value)}
          aria-label="Country this photo was taken in"
        >
          <option value="">Select country…</option>
          {countryOptions.map((c) => (
            <option key={c.id} value={c.id}>
              {c.name}
            </option>
          ))}
        </select>
        <input
          type="date"
          value={date}
          onChange={(e) => setDate(e.target.value)}
          aria-label="Date this photo was taken"
        />
      </div>
      <div className="pending-photos__actions">
        <button
          disabled={!countryId}
          onClick={() => onAssign(photo.id, countryId, date ? new Date(date).toISOString() : null)}
        >
          Add
        </button>
        <button className="pending-photos__discard" onClick={() => onDiscard(photo.id)}>
          Discard
        </button>
      </div>
    </li>
  );
}

export function PendingPhotos({ photos, onAssign, onDiscard }: PendingPhotosProps) {
  if (photos.length === 0) return null;

  return (
    <section className="pending-photos">
      <h2>Couldn't detect a location for {photos.length} photo{photos.length === 1 ? '' : 's'}</h2>
      <p className="pending-photos__hint">
        iOS strips GPS data from photos before handing them to a website, even when the
        original photo is geotagged — so there's no way to place these automatically. Pick
        the country by hand for the ones worth keeping.
      </p>
      <ul className="pending-photos__list">
        {photos.map((photo) => (
          <Row key={photo.id} photo={photo} onAssign={onAssign} onDiscard={onDiscard} />
        ))}
      </ul>
    </section>
  );
}
