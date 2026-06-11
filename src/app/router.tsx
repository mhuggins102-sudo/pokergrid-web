import { Suspense, lazy } from 'react';
import { createBrowserRouter } from 'react-router';

import { AppLayout } from './AppLayout';
import { HomePage } from '../features/home/HomePage';
import { NotFoundPage } from '../features/home/NotFoundPage';

// Route-level code splitting: the game engine + motion load with the
// play surfaces, supabase/query with the daily surfaces — the shell
// and home stay light.
const PlayPage = lazy(() =>
  import('../features/game/PlayPage').then(m => ({ default: m.PlayPage }))
);
const DailyPage = lazy(() =>
  import('../features/daily/DailyPage').then(m => ({ default: m.DailyPage }))
);
const DailyDatePage = lazy(() =>
  import('../features/daily/DailyDatePage').then(m => ({
    default: m.DailyDatePage,
  }))
);
const DailyArchivePage = lazy(() =>
  import('../features/daily/DailyArchivePage').then(m => ({
    default: m.DailyArchivePage,
  }))
);
const StatsPage = lazy(() =>
  import('../features/stats/StatsPage').then(m => ({ default: m.StatsPage }))
);
const AchievementsPage = lazy(() =>
  import('../features/achievements/AchievementsPage').then(m => ({
    default: m.AchievementsPage,
  }))
);
const ChallengesPage = lazy(() =>
  import('../features/challenges/ChallengesPage').then(m => ({
    default: m.ChallengesPage,
  }))
);
const ChallengePlayPage = lazy(() =>
  import('../features/challenges/ChallengePlayPage').then(m => ({
    default: m.ChallengePlayPage,
  }))
);
const TargetsPage = lazy(() =>
  import('../features/targets/TargetsPage').then(m => ({
    default: m.TargetsPage,
  }))
);
const TargetsPlayPage = lazy(() =>
  import('../features/targets/TargetsPlayPage').then(m => ({
    default: m.TargetsPlayPage,
  }))
);
const TutorialPage = lazy(() =>
  import('../features/tutorial/TutorialPage').then(m => ({
    default: m.TutorialPage,
  }))
);
const RulesPage = lazy(() =>
  import('../features/rules/RulesPage').then(m => ({ default: m.RulesPage }))
);
const BonusCardReferencePage = lazy(() =>
  import('../features/rules/BonusCardReferencePage').then(m => ({
    default: m.BonusCardReferencePage,
  }))
);
const SettingsPage = lazy(() =>
  import('../features/settings/SettingsPage').then(m => ({
    default: m.SettingsPage,
  }))
);
const TokenGalleryPage = lazy(() =>
  import('../design/gallery/TokenGalleryPage').then(m => ({
    default: m.TokenGalleryPage,
  }))
);

const page = (el: React.ReactNode) => (
  <Suspense fallback={null}>{el}</Suspense>
);

export const router = createBrowserRouter([
  {
    path: '/',
    element: <AppLayout />,
    children: [
      { index: true, element: <HomePage /> },
      { path: 'play', element: page(<PlayPage />) },
      { path: 'daily', element: page(<DailyPage />) },
      { path: 'daily/archive', element: page(<DailyArchivePage />) },
      { path: 'daily/:date', element: page(<DailyDatePage />) },
      { path: 'stats', element: page(<StatsPage />) },
      { path: 'achievements', element: page(<AchievementsPage />) },
      { path: 'challenges', element: page(<ChallengesPage />) },
      { path: 'challenges/:id', element: page(<ChallengePlayPage />) },
      { path: 'targets', element: page(<TargetsPage />) },
      { path: 'targets/play', element: page(<TargetsPlayPage />) },
      { path: 'tutorial', element: page(<TutorialPage />) },
      { path: 'rules', element: page(<RulesPage />) },
      { path: 'rules/cards', element: page(<BonusCardReferencePage />) },
      { path: 'settings', element: page(<SettingsPage />) },
      { path: 'design', element: page(<TokenGalleryPage />) },
      { path: '*', element: <NotFoundPage /> },
    ],
  },
]);
