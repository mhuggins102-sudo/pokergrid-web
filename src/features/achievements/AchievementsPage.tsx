import { ACHIEVEMENTS, AchievementTier } from '../../game/achievements';
import { useStatsStore } from '../progress/statsStore';
import styles from './AchievementsPage.module.css';

const GROUPS: Array<{ tier: AchievementTier; title: string; blurb: string }> = [
  {
    tier: 'easy',
    title: 'Easy',
    blurb: 'Earned in free play on Easy.',
  },
  {
    tier: 'hard-extreme',
    title: 'Hard & Extreme',
    blurb: 'Earned in free play on Hard or Extreme.',
  },
  {
    tier: 'milestone',
    title: 'Milestones',
    blurb: 'Earned across your whole history.',
  },
];

export function AchievementsPage() {
  const done = useStatsStore(s => s.stats.achievementsDone);

  return (
    <section className={styles.wrap}>
      <header className={styles.header}>
        <h1 className="text-title">Achievements</h1>
        <p className={styles.progress}>
          {done.length} of {ACHIEVEMENTS.length} earned
        </p>
      </header>
      {GROUPS.map(group => (
        <div key={group.tier} className={styles.group}>
          <h2 className="text-section">{group.title}</h2>
          <p className={styles.desc}>{group.blurb}</p>
          <div className={styles.list}>
            {ACHIEVEMENTS.filter(a => a.tier === group.tier).map(a => {
              const earned = done.includes(a.id);
              return (
                <article
                  key={a.id}
                  className={`${styles.card} ${earned ? styles.cardEarned : ''}`}
                >
                  <span className={styles.badge} aria-hidden="true">
                    {earned ? '🏆' : '○'}
                  </span>
                  <div className={styles.body}>
                    <span
                      className={`${styles.name} ${earned ? '' : styles.nameLocked}`}
                    >
                      {a.name}
                    </span>
                    <span className={styles.desc}>{a.description}</span>
                  </div>
                </article>
              );
            })}
          </div>
        </div>
      ))}
    </section>
  );
}
