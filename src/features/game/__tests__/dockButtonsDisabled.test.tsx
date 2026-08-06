import { fireEvent, render, screen } from '@testing-library/react';
import { MemoryRouter, Route, Routes } from 'react-router';
import { ToastProvider } from '../../../design/primitives';
import {
  DockLayout,
  useSettingsStore,
} from '../../settings/settingsStore';
import { PlayPage } from '../PlayPage';

/*
 * Dock consistency: Discard and Undo are always PRESENT — disabled
 * when the configuration forbids them (Extreme: noDiscards + 0 undos)
 * — in every phone dock arrangement. Split behaved this way already;
 * Classic / Center Stage / Hand Stack used to omit the buttons
 * entirely, leaving holes in the dock.
 */

const renderPlay = (search: string) =>
  render(
    <ToastProvider>
      <MemoryRouter initialEntries={[`/play${search}`]}>
        <Routes>
          <Route path="/play" element={<PlayPage />} />
        </Routes>
      </MemoryRouter>
    </ToastProvider>
  );

const DOCKS: DockLayout[] = ['desktop', 'classic', 'center-stage', 'hand-stack'];

describe.each(DOCKS)('dock "%s"', dock => {
  beforeEach(() => {
    localStorage.clear();
    useSettingsStore.setState({ dockLayout: dock });
  });

  it('Extreme: Discard and Undo render disabled', () => {
    renderPlay('?difficulty=extreme&seed=7');
    expect(screen.getByRole('button', { name: 'Discard' })).toBeDisabled();
    expect(screen.getByRole('button', { name: /Undo \(0 left\)/ })).toBeDisabled();
  });

  it('Easy: Discard enabled; Undo enables once there is a move to undo', () => {
    renderPlay('?difficulty=easy&seed=7');
    expect(screen.getByRole('button', { name: 'Discard' })).toBeEnabled();
    // No move yet — nothing to undo.
    expect(screen.getByRole('button', { name: /Undo/ })).toBeDisabled();
    fireEvent.click(screen.getByRole('button', { name: 'Place' }));
    expect(screen.getByRole('button', { name: /Undo/ })).toBeEnabled();
  });
});
