import { useSearchParams } from 'react-router';
import { Placeholder } from '../shared/Placeholder';

export function PlayPage() {
  const [params] = useSearchParams();
  const difficulty = params.get('difficulty') ?? 'easy';
  return (
    <Placeholder title="Free Play" phase="Phase 2 (playable game)">
      <p className="text-label">
        Requested difficulty: <strong>{difficulty}</strong> (read from
        ?difficulty=…)
      </p>
    </Placeholder>
  );
}
