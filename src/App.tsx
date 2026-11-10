import { HashRouter, NavLink, Navigate, Outlet, Route, Routes } from 'react-router-dom';
import { DEFAULT_APP_ID } from './apps';
import { CurriculumScreen } from './screens/CurriculumScreen';
import { KeyTestScreen } from './screens/KeyTestScreen';
import { LessonScreen } from './screens/LessonScreen';

function Shell() {
  return (
    <div className="shell">
      <nav className="side-nav">
        <div className="brand">Shortcut Central</div>
        <NavLink to={`/${DEFAULT_APP_ID}/curriculum`}>Curriculum</NavLink>
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
          <Route path="/:appId/curriculum" element={<CurriculumScreen />} />
          <Route path="/key-test" element={<KeyTestScreen />} />
        </Route>
        {/* A lesson runs outside the shell, covering the whole window. */}
        <Route path="/:appId/lesson/:packId/:lessonId" element={<LessonScreen />} />
        <Route path="*" element={<Navigate to={`/${DEFAULT_APP_ID}/curriculum`} replace />} />
      </Routes>
    </HashRouter>
  );
}
