import { useEffect, useMemo, useRef, useState } from 'react';
import { Link, useParams } from 'react-router-dom';
import { getApp } from '../apps';
import { resolveConfig } from '../config/resolve';
import sampleConfig from '../config/sample.lua?raw';
import { KeySequence } from '../drills/KeyEcho';
import { parseKeys } from '../keys/notation';
import { applyConfig, removeConfig, type StoredConfig } from '../store/config';
import { settingNames, useSetting } from '../store/settings';

function Keys({ keys }: { keys: string[] }) {
  return (
    <>
      {keys.map((sequence, i) => (
        <span key={sequence}>
          {i > 0 && <span className="answer-or"> or </span>}
          <KeySequence keys={parseKeys(sequence)} />
        </span>
      ))}
    </>
  );
}

function Results({ appId, stored }: { appId: string; stored: StoredConfig }) {
  const result = useMemo(() => resolveConfig(appId, stored.recording), [appId, stored]);
  const withPack = result.plugins.filter((plugin) => plugin.packId);
  const withoutPack = result.plugins.filter((plugin) => !plugin.packId);

  return (
    <section className="config-results" data-testid="config-results">
      <h2>What the config changed</h2>
      {result.error && (
        <p className="notice bad" data-testid="config-error">
          The config stopped{result.error.line ? ` at line ${result.error.line}` : ''}: {result.error.message}
          <br />
          Everything it did before that point is applied.
        </p>
      )}
      <dl className="config-facts">
        <dt>Leader</dt>
        <dd data-testid="config-leader">
          <KeySequence keys={parseKeys(result.leader.keys)} />
          {!result.leader.fromConfig && <span className="muted"> (Neovim's default; the config does not set one)</span>}
        </dd>
        <dt>Plugins with a pack</dt>
        <dd data-testid="config-packs">
          {withPack.length === 0 ? <span className="muted">None</span> : withPack.map((p) => p.packName).join(', ')}
          {withPack.length > 0 && <span className="muted"> — turned on</span>}
        </dd>
        <dt>Plugins without a pack</dt>
        <dd>
          {withoutPack.length === 0 ? (
            <span className="muted">None</span>
          ) : (
            <>
              {withoutPack.length} — listed on the <Link to={`/${appId}/plugins`}>Plugins</Link> screen
            </>
          )}
        </dd>
        <dt>Your own mappings</dt>
        <dd data-testid="config-own">
          {result.ownMappings === 0 ? (
            <span className="muted">None with a desc</span>
          ) : (
            <>
              {result.ownMappings} in the My config pack — see the <Link to={`/${appId}/curriculum`}>Curriculum</Link>
            </>
          )}
        </dd>
      </dl>

      <h3>Keys replaced in packs ({result.overrides.length})</h3>
      {result.overrides.length === 0 ? (
        <p className="muted">No mapping in the config matches an action taught by a pack.</p>
      ) : (
        <table className="config-table" data-testid="config-overrides">
          <tbody>
            {result.overrides.map((override) => (
              <tr key={override.cardKey} data-card={override.cardKey}>
                <td>
                  {override.prompt}
                  <div className="muted">{override.packName}</div>
                </td>
                <td className="was">
                  <Keys keys={override.from} />
                </td>
                <td>→</td>
                <td>
                  <Keys keys={override.to} />
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      )}

      <h3>Warnings ({result.warnings.length})</h3>
      {result.warnings.length === 0 ? (
        <p className="muted">None.</p>
      ) : (
        <ul className="config-warnings" data-testid="config-warnings">
          {result.warnings.map((warning, i) => (
            <li key={i}>
              {warning.line !== undefined && <span className="line-no">line {warning.line}</span>}
              {warning.message}
            </li>
          ))}
        </ul>
      )}
    </section>
  );
}

/** The user's `init.lua`: edited here, run in a sandboxed Lua VM, and applied to the packs. */
export function ConfigScreen() {
  const { appId = '' } = useParams();
  const app = getApp(appId);
  const stored = useSetting<StoredConfig | null>(settingNames.config(appId), null);
  const [draft, setDraft] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const [failure, setFailure] = useState<string | null>(null);
  const fileInput = useRef<HTMLInputElement>(null);

  // The editor starts from the stored config once it has loaded.
  useEffect(() => {
    if (stored !== undefined && draft === null) setDraft(stored?.source ?? '');
  }, [stored, draft]);

  if (!app) return <p>Unknown app “{appId}”.</p>;
  if (stored === undefined || draft === null) return null;

  const onApply = async () => {
    setBusy(true);
    setFailure(null);
    try {
      // The Lua VM is only downloaded when a config is first run.
      const { runConfig } = await import('../config/runConfig');
      await applyConfig(appId, draft, await runConfig(draft));
    } catch (error) {
      setFailure(error instanceof Error ? error.message : String(error));
    } finally {
      setBusy(false);
    }
  };

  const unchanged = stored !== null && stored.source === draft;

  return (
    <div className="screen wide">
      <h1>Config</h1>
      <p className="lede">
        Paste your <code>init.lua</code>. It is run in a sandbox in this browser — nothing is uploaded — to read your
        leader key, your lazy.nvim plugins and your key mappings. Only this one file is read; mappings in files it
        requires are not seen.
      </p>
      <textarea
        className="config-editor"
        aria-label="init.lua"
        spellCheck={false}
        value={draft}
        placeholder="-- init.lua"
        onChange={(event) => setDraft(event.target.value)}
      />
      <div className="button-row">
        <button type="button" className="button primary" disabled={busy || draft.trim() === ''} onClick={() => void onApply()}>
          {busy ? 'Running…' : unchanged ? 'Apply again' : 'Apply'}
        </button>
        <button type="button" className="button" onClick={() => fileInput.current?.click()}>
          Open a file…
        </button>
        <input
          ref={fileInput}
          type="file"
          accept=".lua,text/plain"
          hidden
          data-testid="config-file"
          onChange={(event) => {
            const file = event.target.files?.[0];
            if (file) void file.text().then(setDraft);
            event.target.value = '';
          }}
        />
        <button type="button" className="button" onClick={() => setDraft(sampleConfig)}>
          Load the sample
        </button>
        {stored && (
          <button
            type="button"
            className="button danger"
            onClick={() => {
              if (window.confirm('Remove the config? Packs go back to their own keys. Your progress is kept.')) {
                void removeConfig(appId).then(() => setDraft(''));
              }
            }}
          >
            Remove config
          </button>
        )}
      </div>
      {failure && (
        <p className="notice bad" role="alert" data-testid="config-failure">
          {failure}
        </p>
      )}
      {stored && !unchanged && <p className="muted">The results below are for the config applied earlier, not the text above.</p>}
      {stored && <Results appId={appId} stored={stored} />}
    </div>
  );
}
