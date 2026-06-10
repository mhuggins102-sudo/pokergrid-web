import { useParams } from 'react-router';
import { Placeholder } from '../shared/Placeholder';

export function DailyDatePage() {
  const { date } = useParams<'date'>();
  return (
    <Placeholder title="Daily Puzzle" phase="Phase 3 (daily + leaderboard)">
      <p className="text-label">
        Date from URL: <strong>{date}</strong> — this route will render the
        stored result if the puzzle was already played.
      </p>
    </Placeholder>
  );
}
