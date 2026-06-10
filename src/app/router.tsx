import { createBrowserRouter } from 'react-router';

import { AppLayout } from './AppLayout';
import { HomePage } from '../features/home/HomePage';
import { PlayPage } from '../features/game/PlayPage';
import { DailyPage } from '../features/daily/DailyPage';
import { DailyDatePage } from '../features/daily/DailyDatePage';
import { DailyArchivePage } from '../features/daily/DailyArchivePage';
import { StatsPage } from '../features/stats/StatsPage';
import { AchievementsPage } from '../features/achievements/AchievementsPage';
import { ChallengesPage } from '../features/challenges/ChallengesPage';
import { TargetsPage } from '../features/targets/TargetsPage';
import { RulesPage } from '../features/rules/RulesPage';
import { SettingsPage } from '../features/settings/SettingsPage';
import { TokenGalleryPage } from '../design/gallery/TokenGalleryPage';
import { NotFoundPage } from '../features/home/NotFoundPage';

export const router = createBrowserRouter([
  {
    path: '/',
    element: <AppLayout />,
    children: [
      { index: true, element: <HomePage /> },
      { path: 'play', element: <PlayPage /> },
      { path: 'daily', element: <DailyPage /> },
      { path: 'daily/archive', element: <DailyArchivePage /> },
      { path: 'daily/:date', element: <DailyDatePage /> },
      { path: 'stats', element: <StatsPage /> },
      { path: 'achievements', element: <AchievementsPage /> },
      { path: 'challenges', element: <ChallengesPage /> },
      { path: 'targets', element: <TargetsPage /> },
      { path: 'rules', element: <RulesPage /> },
      { path: 'settings', element: <SettingsPage /> },
      { path: 'design', element: <TokenGalleryPage /> },
      { path: '*', element: <NotFoundPage /> },
    ],
  },
]);
