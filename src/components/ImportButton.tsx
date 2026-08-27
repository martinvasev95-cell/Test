import { useRef, useState } from 'react';
import type { ImportSummary, PendingPhoto, Visit } from '../types';
import { importPhotos } from '../lib/importPhotos';

interface ImportButtonProps {
  onImported: (visits: Visit[], pending: PendingPhoto[]) => void;
}

export function ImportButton({ onImported }: ImportButtonProps) {
  const inputRef = useRef<HTMLInputElement>(null);
  const [progress, setProgress] = useState<{ done: number; total: number } | null>(null);
  const [summary, setSummary] = useState<ImportSummary | null>(null);

  async function handleFiles(fileList: FileList | null) {
    if (!fileList || fileList.length === 0) return;
    const files = Array.from(fileList);
    setSummary(null);
    setProgress({ done: 0, total: files.length });

    const { visits, pending, summary: result } = await importPhotos(files, (done, total) =>
      setProgress({ done, total }),
    );

    onImported(visits, pending);
    setProgress(null);
    setSummary(result);
    if (inputRef.current) inputRef.current.value = '';
  }

  return (
    <div className="import-button">
      <label className="import-button__label">
        <input
          ref={inputRef}
          type="file"
          accept="image/*"
          multiple
          onChange={(e) => handleFiles(e.target.files)}
          disabled={progress !== null}
        />
        {progress ? `Processing ${progress.done}/${progress.total}…` : 'Import photos'}
      </label>
      {summary && (
        <p className="import-button__summary">
          Added {summary.imported} photo{summary.imported === 1 ? '' : 's'}.
          {summary.pending > 0 &&
            ` ${summary.pending} need${summary.pending === 1 ? 's' : ''} a country picked by hand — see below.`}
        </p>
      )}
    </div>
  );
}
