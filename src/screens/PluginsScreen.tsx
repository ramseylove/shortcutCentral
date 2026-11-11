import { useParams } from 'react-router-dom';
import { getApp } from '../apps';
import { isBuiltIn, useEnabledPacks } from '../packs/enabled';
import { packsForApp } from '../packs/registry';
import { resolveConfig } from '../config/resolve';
import type { StoredConfig } from '../store/config';
import { setPackEnabled } from '../store/packs';
import { settingNames, useSetting } from '../store/settings';

/** The pack catalogue: one toggle per plugin pack. */
export function PluginsScreen() {
  const { appId = '' } = useParams();
  const app = getApp(appId);
  const enabled = useEnabledPacks(appId);
  const chosen = useSetting<string[]>(settingNames.enabledPacks(appId), []);
  const config = useSetting<StoredConfig | null>(settingNames.config(appId), null);
  if (!app) return <p>Unknown app “{appId}”.</p>;
  if (!enabled || !chosen || config === undefined) return null;

  const withoutPack = config
    ? resolveConfig(appId, config.recording).plugins.filter((plugin) => !plugin.packId)
    : [];

  const all = packsForApp(appId);
  const plugins = all.filter((pack) => !isBuiltIn(pack));
  const active = new Set(enabled.map((pack) => pack.id));

  return (
    <div className="screen">
      <h1>Plugins</h1>
      <p className="lede">
        Turning a plugin on adds its lessons to the curriculum. Turning it off hides them and
        pauses its reviews; your history is kept.
      </p>
      <ul className="plugin-list">
        {plugins.map((pack) => {
          const missing = pack.requires
            .filter((id) => !active.has(id))
            .map((id) => all.find((p) => p.id === id)?.name ?? id);
          const on = chosen.includes(pack.id);
          const shortcuts = pack.lessons.reduce((sum, lesson) => sum + lesson.items.length, 0);
          return (
            <li key={pack.id} className="plugin" data-testid={`plugin-${pack.id}`}>
              <div>
                <div className="plugin-name">{pack.name}</div>
                <div className="plugin-meta">
                  {pack.repo} · {pack.lessons.length} {pack.lessons.length === 1 ? 'lesson' : 'lessons'} ·{' '}
                  {shortcuts} shortcuts
                </div>
                {missing.length > 0 && (
                  <div className="plugin-note">
                    {on ? 'Paused until you turn on' : 'Needs'} {missing.join(', ')}.
                  </div>
                )}
              </div>
              <label className="toggle">
                <input
                  type="checkbox"
                  role="switch"
                  aria-label={`Enable ${pack.name}`}
                  checked={on}
                  disabled={!on && missing.length > 0}
                  onChange={(event) => void setPackEnabled(appId, pack.id, event.target.checked)}
                />
                <span>{on ? 'On' : 'Off'}</span>
              </label>
            </li>
          );
        })}
      </ul>
      {withoutPack.length > 0 && (
        <section data-testid="plugins-without-pack">
          <h2>In your config, without a pack</h2>
          <p className="lede">
            No pack exists yet for these plugins. A first draft of one can be generated from a plugin's documentation
            with the command shown, run in a checkout of this project.
          </p>
          <ul className="plugin-list">
            {withoutPack.map((plugin) => (
              <li key={plugin.repo} className="plugin">
                <div>
                  <div className="plugin-name">{plugin.repo}</div>
                  <code className="plugin-meta">npm run pack:draft -- {plugin.repo}</code>
                </div>
              </li>
            ))}
          </ul>
        </section>
      )}
    </div>
  );
}
