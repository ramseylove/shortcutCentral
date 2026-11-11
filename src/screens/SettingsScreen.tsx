import { useRef, useState } from 'react';
import { exportData, importData, parseExport } from '../store/backup';
import { loadStoredConfigs } from '../store/config';
import { resetProgress } from '../store/progress';
import { DEFAULT_SESSION_CAP, setSetting, settingNames, useSetting } from '../store/settings';

function download(filename: string, text: string): void {
  const url = URL.createObjectURL(new Blob([text], { type: 'application/json' }));
  const link = document.createElement('a');
  link.href = url;
  link.download = filename;
  link.click();
  URL.revokeObjectURL(url);
}

export function SettingsScreen() {
  const cap = useSetting(settingNames.sessionCap, DEFAULT_SESSION_CAP);
  const fileInput = useRef<HTMLInputElement>(null);
  const [message, setMessage] = useState<{ tone: 'ok' | 'bad'; text: string } | null>(null);

  const onExport = async () => {
    const data = await exportData();
    download(`shortcut-central-${new Date().toISOString().slice(0, 10)}.json`, JSON.stringify(data, null, 2));
    setMessage({ tone: 'ok', text: 'Progress exported.' });
  };

  const onImport = async (file: File) => {
    try {
      const data = parseExport(await file.text());
      const summary = `${data.lessons.length} lessons, ${data.cards.length} cards and ${data.attempts.length} attempts`;
      if (!window.confirm(`Replace all progress on this device with the file's ${summary}?`)) return;
      await importData(data);
      await loadStoredConfigs();
      setMessage({ tone: 'ok', text: `Imported ${summary}.` });
    } catch (error) {
      setMessage({ tone: 'bad', text: error instanceof Error ? error.message : String(error) });
    } finally {
      if (fileInput.current) fileInput.current.value = '';
    }
  };

  return (
    <div className="screen">
      <h1>Settings</h1>

      <h2>Reviews</h2>
      <label className="field">
        <span>Most reviews in one session</span>
        <input
          type="number"
          min={1}
          max={500}
          value={cap ?? ''}
          onChange={(event) => {
            const value = Math.round(Number(event.target.value));
            if (value >= 1 && value <= 500) void setSetting(settingNames.sessionCap, value);
          }}
        />
      </label>

      <h2>Your data</h2>
      <p className="lede">
        Progress and your config are stored in this browser only. Export it to keep a backup or move to another
        device. Importing replaces everything stored here.
      </p>
      <div className="button-row">
        <button type="button" className="button" onClick={() => void onExport()}>
          Export progress
        </button>
        <button type="button" className="button" onClick={() => fileInput.current?.click()}>
          Import progress
        </button>
        <input
          ref={fileInput}
          type="file"
          accept="application/json,.json"
          hidden
          data-testid="import-file"
          onChange={(event) => {
            const file = event.target.files?.[0];
            if (file) void onImport(file);
          }}
        />
        <button
          type="button"
          className="button danger"
          onClick={() => {
            if (window.confirm('Delete all lessons, cards and attempts stored in this browser?')) {
              void resetProgress().then(() => setMessage({ tone: 'ok', text: 'Progress deleted.' }));
            }
          }}
        >
          Delete progress
        </button>
      </div>
      {message && (
        <p className={`notice ${message.tone}`} role="status" data-testid="settings-message">
          {message.text}
        </p>
      )}
    </div>
  );
}
