import { useState } from 'react';
import { fireEvent, render, screen } from '@testing-library/react';
import { Button, Dialog, Tabs, ToastProvider, useToast } from '../index';

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
