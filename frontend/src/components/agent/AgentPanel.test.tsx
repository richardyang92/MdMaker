import { describe, it, expect, vi } from 'vitest';
import { render, screen, fireEvent } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { AgentPanel } from './AgentPanel';
import type { AgentTurn } from '../../hooks/useAgentChat';

const turns: AgentTurn[] = [];
const noop = () => {};

function renderPanel(overrides: Partial<React.ComponentProps<typeof AgentPanel>> = {}) {
  return render(
    <AgentPanel
      turns={turns}
      isRunning={false}
      error={null}
      attachedContext={null}
      onSend={vi.fn()}
      onClearContext={vi.fn()}
      onStop={noop}
      {...overrides}
    />,
  );
}

describe('AgentPanel — attached context chip', () => {
  it('does not render a context chip when attachedContext is null', () => {
    renderPanel({ attachedContext: null });
    expect(screen.queryByText(/引用选区/)).toBeNull();
  });

  it('renders a chip showing the character count when attachedContext is set', () => {
    renderPanel({ attachedContext: 'some selected paragraph' });
    const chip = screen.getByText(/引用选区/);
    expect(chip).toBeInTheDocument();
    // "some selected paragraph" = 23 chars
    expect(chip).toHaveTextContent(/23/);
  });

  it('calls onClearContext when the chip dismiss (×) button is clicked', async () => {
    const onClearContext = vi.fn();
    renderPanel({ attachedContext: 'hello', onClearContext });
    fireEvent.click(screen.getByRole('button', { name: /移除上下文/ }));
    expect(onClearContext).toHaveBeenCalledTimes(1);
  });
});

describe('AgentPanel — historical turn selection label', () => {
  it('renders a read-only "引用选区" label under a past turn that carried selection', () => {
    renderPanel({
      turns: [
        {
          id: 't1',
          userMessage: '改写这段',
          selection: '历史选区文本',
          events: [],
          status: 'done',
        },
      ],
    });
    const label = screen.getByText(/引用选区/);
    expect(label).toBeInTheDocument();
    // "历史选区文本" = 6 chars
    expect(label).toHaveTextContent(/6/);
  });

  it('does not render a selection label for a past turn without selection', () => {
    renderPanel({
      turns: [
        { id: 't1', userMessage: '一个问题', events: [], status: 'done' },
      ],
    });
    expect(screen.queryByText(/引用选区/)).toBeNull();
  });
});

describe('AgentPanel — submit passes attached context to onSend', () => {
  it('calls onSend with (message, selection) when a context is attached', async () => {
    const onSend = vi.fn();
    const user = userEvent.setup();
    renderPanel({ attachedContext: 'ctx text', onSend });

    await user.type(screen.getByPlaceholderText(/对 Agent 下指令/), '改写这段');
    await user.click(screen.getByRole('button', { name: '发送' }));

    expect(onSend).toHaveBeenCalledTimes(1);
    const [message, selection] = onSend.mock.calls[0];
    expect(message).toBe('改写这段');
    expect(selection).toBe('ctx text');
  });

  it('calls onSend with (message, undefined) when no context is attached', async () => {
    const onSend = vi.fn();
    const user = userEvent.setup();
    renderPanel({ attachedContext: null, onSend });

    await user.type(screen.getByPlaceholderText(/对 Agent 下指令/), '一个问题');
    await user.click(screen.getByRole('button', { name: '发送' }));

    expect(onSend).toHaveBeenCalledTimes(1);
    const [message, selection] = onSend.mock.calls[0];
    expect(message).toBe('一个问题');
    expect(selection).toBeUndefined();
  });
});
