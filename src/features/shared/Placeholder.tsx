import { ReactNode } from 'react';
import styles from './Placeholder.module.css';

export interface PlaceholderProps {
  title: string;
  phase: string;
  children?: ReactNode;
}

/**
 * Stand-in screen for routes whose feature lands in a later phase. Keeps
 * every route deep-linkable from day one so URLs are stable before the
 * features behind them exist.
 */
export function Placeholder({ title, phase, children }: PlaceholderProps) {
  return (
    <section className={styles.wrap}>
      <h1 className="text-title">{title}</h1>
      <p className={`text-body ${styles.note}`}>
        This screen arrives in {phase}. The route is already stable — links
        here will keep working when the feature ships.
      </p>
      {children}
    </section>
  );
}
