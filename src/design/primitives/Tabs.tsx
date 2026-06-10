import { KeyboardEvent, ReactNode, useId, useRef } from 'react';
import styles from './Tabs.module.css';

export interface TabItem {
  id: string;
  label: ReactNode;
  content: ReactNode;
}

export interface TabsProps {
  tabs: TabItem[];
  value: string;
  onChange: (id: string) => void;
  /** Accessible name for the tab list. */
  label?: string;
}

/**
 * Controlled tabs with WAI-ARIA roles and arrow-key navigation
 * (roving tabindex).
 */
export function Tabs({ tabs, value, onChange, label }: TabsProps) {
  const baseId = useId();
  const listRef = useRef<HTMLDivElement>(null);
  const active = tabs.find(t => t.id === value) ?? tabs[0];

  const onKeyDown = (e: KeyboardEvent<HTMLDivElement>) => {
    const idx = tabs.findIndex(t => t.id === active.id);
    let next: number | null = null;
    if (e.key === 'ArrowRight') next = (idx + 1) % tabs.length;
    else if (e.key === 'ArrowLeft') next = (idx - 1 + tabs.length) % tabs.length;
    else if (e.key === 'Home') next = 0;
    else if (e.key === 'End') next = tabs.length - 1;
    if (next === null) return;
    e.preventDefault();
    onChange(tabs[next].id);
    const buttons = listRef.current?.querySelectorAll<HTMLButtonElement>(
      '[role="tab"]'
    );
    buttons?.[next]?.focus();
  };

  return (
    <div>
      <div
        ref={listRef}
        role="tablist"
        aria-label={label}
        className={styles.list}
        onKeyDown={onKeyDown}
      >
        {tabs.map(t => (
          <button
            key={t.id}
            role="tab"
            type="button"
            id={`${baseId}-tab-${t.id}`}
            aria-selected={t.id === active.id}
            aria-controls={`${baseId}-panel-${t.id}`}
            tabIndex={t.id === active.id ? 0 : -1}
            className={styles.tab}
            onClick={() => onChange(t.id)}
          >
            {t.label}
          </button>
        ))}
      </div>
      <div
        role="tabpanel"
        id={`${baseId}-panel-${active.id}`}
        aria-labelledby={`${baseId}-tab-${active.id}`}
        tabIndex={0}
        className={styles.panel}
      >
        {active.content}
      </div>
    </div>
  );
}
