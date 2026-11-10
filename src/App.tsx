import { HashRouter, NavLink, Navigate, Outlet, Route, Routes } from 'react-router-dom';
import { DEFAULT_APP_ID } from './apps';
import { CurriculumScreen } from './screens/CurriculumScreen';
import { KeyTestScreen } from './screens/KeyTestScreen';
import { LessonScreen } from './screens/LessonScreen';
import { PluginsScreen } from './screens/PluginsScreen';
import { ReferenceScreen } from './screens/ReferenceScreen';
import { ReviewScreen } from './screens/ReviewScreen';
import { SettingsScreen } from './screens/SettingsScreen';
import { TodayScreen } from './screens/TodayScreen';

function Shell() {
  const app = DEFAULT_APP_ID;
  return (
    <div className="shell">
      <nav className="side-nav">
        <div className="brand">Shortcut Central</div>
        <NavLink to={`/${app}/today`}>Today</NavLink>
        <NavLink to={`/${app}/curriculum`}>Curriculum</NavLink>
        <NavLink to={`/${app}/plugins`}>Plugins</NavLink>
        <NavLink to={`/${app}/reference`}>Reference</NavLink>
        <NavLink to="/settings">Settings</NavLink>
        <NavLink to="/key-test">Key test</NavLink>
      </nav>
      <main className="content">
        <Outlet />
      </main>
    </div>
  );
}

export function App() {
  return (
    <HashRouter>
      <Routes>
        <Route element={<Shell />}>
          <Route path="/:appId/today" element={<TodayScreen />} />
          <Route path="/:appId/curriculum" element={<CurriculumScreen />} />
          <Route path="/:appId/plugins" element={<PluginsScreen />} />
          <Route path="/:appId/reference" element={<ReferenceScreen />} />
          <Route path="/settings" element={<SettingsScreen />} />
          <Route path="/key-test" element={<KeyTestScreen />} />
        </Route>
        {/* Lessons and reviews run outside the shell, covering the whole window. */}
        <Route path="/:appId/lesson/:packId/:lessonId" element={<LessonScreen />} />
        <Route path="/:appId/review" element={<ReviewScreen />} />
        <Route path="*" element={<Navigate to={`/${DEFAULT_APP_ID}/today`} replace />} />
      </Routes>
    </HashRouter>
  );
}
