import { useState } from 'react';
import { fireEvent, render, screen } from '@testing-library/react';
import { MemoryRouter, useNavigate } from 'react-router';
import {
  Button,
  Dialog,
  Tabs,
  TapPopoverProvider,
  ToastProvider,
  useTapPopover,
  useTapPopoverCloseAll,
  useToast,
} from '../index';

describe('Button', () => {
  it('renders and fires onClick', () => {
    const onClick = vi.fn();
    render(<Button onClick={onClick}>Deal</Button>);
    fireEvent.click(screen.getByRole('button', { name: 'Deal' }));
    expect(onClick).toHaveBeenCalledTimes(1);
  });

  it('defaults to type="button" so it never submits forms by accident', () => {
    render(<Button>Deal</Button>);
    expect(screen.getByRole('button')).toHaveAttribute('type', 'button');
  });
});

describe('Dialog', () => {
  it('shows content when open and calls onClose from the close button', () => {
    const onClose = vi.fn();
    render(
      <Dialog open onClose={onClose} title="Deck info">
        <p>32 cards left</p>
      </Dialog>
    );
    expect(screen.getByText('32 cards left')).toBeInTheDocument();
    fireEvent.click(screen.getByRole('button', { name: 'Close' }));
    expect(onClose).toHaveBeenCalled();
  });
});

describe('Tabs', () => {
  function Harness() {
    const [tab, setTab] = useState('a');
    return (
      <Tabs
        label="Demo"
        value={tab}
        onChange={setTab}
        tabs={[
          { id: 'a', label: 'Alpha', content: <p>Alpha panel</p> },
          { id: 'b', label: 'Beta', content: <p>Beta panel</p> },
        ]}
      />
    );
  }

  it('switches panels on click', () => {
    render(<Harness />);
    expect(screen.getByText('Alpha panel')).toBeInTheDocument();
    fireEvent.click(screen.getByRole('tab', { name: 'Beta' }));
    expect(screen.getByText('Beta panel')).toBeInTheDocument();
    expect(screen.queryByText('Alpha panel')).not.toBeInTheDocument();
  });

  it('moves selection with arrow keys', () => {
    render(<Harness />);
    fireEvent.keyDown(screen.getByRole('tablist'), { key: 'ArrowRight' });
    expect(screen.getByRole('tab', { name: 'Beta' })).toHaveAttribute(
      'aria-selected',
      'true'
    );
  });
});

describe('TapPopover', () => {
  // The tier mock (src/test/tier.ts) only answers width/reduced-motion
  // queries — it doesn't intercept `(pointer: coarse)`. Copy the
  // query-intercepting pattern from useGameFamily.test.tsx to force the
  // coarse pointer the touch machine gates on.
  function mockCoarse(): () => void {
    const base = window.matchMedia;
    window.matchMedia = ((query: string) =>
      ({
        matches: query.includes('pointer: coarse'),
        media: query,
        onchange: null,
        addEventListener: () => {},
        removeEventListener: () => {},
        addListener: () => {},
        removeListener: () => {},
        dispatchEvent: () => false,
      }) as unknown as MediaQueryList) as typeof window.matchMedia;
    return () => {
      window.matchMedia = base;
    };
  }

  // A popover renders its tooltip only while open, so assertions read the
  // hook's `open` boolean directly through the DOM.
  function Popover({ id }: { id: string }) {
    const { open, wrapRef, toggleProps } = useTapPopover(id);
    return (
      <div ref={wrapRef}>
        <button {...toggleProps}>trigger-{id}</button>
        {open && <div role="tooltip">pop-{id}</div>}
      </div>
    );
  }

  function NavButton() {
    const navigate = useNavigate();
    return <button onClick={() => navigate('/other')}>navigate</button>;
  }

  function CloseAllButton() {
    const closeAll = useTapPopoverCloseAll();
    return <button onClick={closeAll}>close-all</button>;
  }

  function Harness() {
    return (
      <MemoryRouter initialEntries={['/']}>
        <TapPopoverProvider>
          <Popover id="a" />
          <Popover id="b" />
          <NavButton />
          <CloseAllButton />
          <span data-testid="outside">outside</span>
        </TapPopoverProvider>
      </MemoryRouter>
    );
  }

  let restore: (() => void) | null = null;
  afterEach(() => {
    restore?.();
    restore = null;
  });

  it('fine pointer: the trigger is inert and never opens', () => {
    // No coarse mock — setup.ts answers `(pointer: coarse)` false.
    render(<Harness />);
    fireEvent.click(screen.getByText('trigger-a'));
    expect(screen.queryByRole('tooltip')).not.toBeInTheDocument();
  });

  it('coarse tap opens, a second tap closes', () => {
    restore = mockCoarse();
    render(<Harness />);
    fireEvent.click(screen.getByText('trigger-a'));
    expect(screen.getByText('pop-a')).toBeInTheDocument();
    fireEvent.click(screen.getByText('trigger-a'));
    expect(screen.queryByText('pop-a')).not.toBeInTheDocument();
  });

  it('opening one popover closes another (single-open registry)', () => {
    restore = mockCoarse();
    render(<Harness />);
    fireEvent.click(screen.getByText('trigger-a'));
    expect(screen.getByText('pop-a')).toBeInTheDocument();
    fireEvent.click(screen.getByText('trigger-b'));
    expect(screen.getByText('pop-b')).toBeInTheDocument();
    expect(screen.queryByText('pop-a')).not.toBeInTheDocument();
  });

  it('Escape closes the open popover', () => {
    restore = mockCoarse();
    render(<Harness />);
    fireEvent.click(screen.getByText('trigger-a'));
    fireEvent.keyDown(document, { key: 'Escape' });
    expect(screen.queryByText('pop-a')).not.toBeInTheDocument();
  });

  it('an outside pointerdown closes the open popover', () => {
    restore = mockCoarse();
    render(<Harness />);
    fireEvent.click(screen.getByText('trigger-a'));
    fireEvent.pointerDown(screen.getByTestId('outside'));
    expect(screen.queryByText('pop-a')).not.toBeInTheDocument();
  });

  it('a route change closes the open popover', () => {
    restore = mockCoarse();
    render(<Harness />);
    fireEvent.click(screen.getByText('trigger-a'));
    expect(screen.getByText('pop-a')).toBeInTheDocument();
    fireEvent.click(screen.getByText('navigate'));
    expect(screen.queryByText('pop-a')).not.toBeInTheDocument();
  });

  it('closeAll from useTapPopoverCloseAll closes the open popover', () => {
    restore = mockCoarse();
    render(<Harness />);
    fireEvent.click(screen.getByText('trigger-a'));
    expect(screen.getByText('pop-a')).toBeInTheDocument();
    fireEvent.click(screen.getByText('close-all'));
    expect(screen.queryByText('pop-a')).not.toBeInTheDocument();
  });
});

describe('Toast', () => {
  function Trigger() {
    const { toast } = useToast();
    return <Button onClick={() => toast('Score submitted.')}>Notify</Button>;
  }

  it('shows a message in the live region', () => {
    render(
      <ToastProvider>
        <Trigger />
      </ToastProvider>
    );
    fireEvent.click(screen.getByRole('button', { name: 'Notify' }));
    expect(screen.getByRole('status')).toHaveTextContent('Score submitted.');
  });
});
