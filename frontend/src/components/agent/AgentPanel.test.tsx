import { describe, it, expect, vi } from 'vitest';
import { render, screen, fireEvent } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { AgentPanel } from './AgentPanel';
import type { AgentTurn } from '../../hooks/useAgentChat';
import type { ContextItem } from '../../services/types/agent';

const turns: AgentTurn[] = [];
const noop = () => {};

const ctxA: ContextItem = { ref: 'ctx-1', label: '引言', content: '## 引言\n一些文字' };
const ctxB: ContextItem = { ref: 'ctx-2', label: '结论', content: '## 结论\n更多文字' };

function renderPanel(overrides: Partial<React.ComponentProps<typeof AgentPanel>> = {}) {
  return render(
    <AgentPanel
      turns={turns}
      isRunning={false}
      error={null}
      attachedContexts={[]}
      onSend={vi.fn()}
      onClearContext={vi.fn()}
      onStop={noop}
      {...overrides}
    />,
  );
}

describe('AgentPanel — attached context chips', () => {
  it('renders no chips when no contexts are attached', () => {
    renderPanel({ attachedContexts: [] });
    expect(screen.queryByText(/@ctx-/)).toBeNull();
  });

  it('renders one chip per attached context with its label', () => {
    renderPanel({ attachedContexts: [ctxA, ctxB] });
    expect(screen.getByText(/@ctx-1 · 引言/)).toBeInTheDocument();
    expect(screen.getByText(/@ctx-2 · 结论/)).toBeInTheDocument();
  });

  it('calls onClearContext with the ref when a chip dismiss (×) button is clicked', async () => {
    const onClearContext = vi.fn();
    renderPanel({ attachedContexts: [ctxA, ctxB], onClearContext });
    fireEvent.click(screen.getByRole('button', { name: /移除上下文 ctx-1/ }));
    expect(onClearContext).toHaveBeenCalledTimes(1);
    expect(onClearContext).toHaveBeenCalledWith('ctx-1');
  });
});

describe('AgentPanel — historical turn context labels', () => {
  it('renders read-only context labels under a past turn that carried contexts', () => {
    renderPanel({
      turns: [
        {
          id: 't1',
          userMessage: '改写这段',
          contexts: [ctxA],
          events: [],
          status: 'done',
        },
      ],
    });
    expect(screen.getByText(/@ctx-1 · 引言/)).toBeInTheDocument();
  });

  it('does not render context labels for a past turn without contexts', () => {
    renderPanel({
      turns: [
        { id: 't1', userMessage: '一个问题', events: [], status: 'done' },
      ],
    });
    expect(screen.queryByText(/@ctx-/)).toBeNull();
  });
});

describe('AgentPanel — submit behavior', () => {
  it('calls onSend with the message when no context is attached', async () => {
    const onSend = vi.fn();
    const user = userEvent.setup();
    renderPanel({ attachedContexts: [], onSend });

    await user.type(screen.getByPlaceholderText(/对 Agent 下指令/), '一个问题');
    await user.click(screen.getByRole('button', { name: '发送' }));

    expect(onSend).toHaveBeenCalledTimes(1);
    expect(onSend).toHaveBeenCalledWith('一个问题');
  });

  it('sends Enter as submit and Shift+Enter as a newline', async () => {
    const onSend = vi.fn();
    const user = userEvent.setup();
    renderPanel({ attachedContexts: [], onSend });
    const input = screen.getByPlaceholderText(/对 Agent 下指令/);

    await user.type(input, '第一行{Shift>}{Enter}{/Shift}第二行{Enter}');
    expect(onSend).toHaveBeenCalledTimes(1);
    expect(onSend).toHaveBeenCalledWith('第一行\n第二行');
  });
});

describe('AgentPanel — @ mention autocomplete', () => {
  it('offers @document and attached contexts after typing @', async () => {
    const user = userEvent.setup();
    renderPanel({ attachedContexts: [ctxA, ctxB] });
    const input = screen.getByPlaceholderText(/对 Agent 下指令/);

    await user.type(input, '@');
    expect(screen.getByText('@document')).toBeInTheDocument();
    expect(screen.getByText('@ctx-1')).toBeInTheDocument();
    expect(screen.getByText('@ctx-2')).toBeInTheDocument();
  });

  it('filters options by the typed query', async () => {
    const user = userEvent.setup();
    renderPanel({ attachedContexts: [ctxA, ctxB] });
    const input = screen.getByPlaceholderText(/对 Agent 下指令/);

    await user.type(input, '@ctx-2');
    // The textarea value also matches "@ctx-2", so query all matches.
    expect(screen.getAllByText('@ctx-2').length).toBeGreaterThanOrEqual(1);
    expect(screen.queryByText('@ctx-1')).toBeNull();
  });

  it('inserts the selected reference via keyboard Enter', async () => {
    const user = userEvent.setup();
    renderPanel({ attachedContexts: [ctxA, ctxB] });
    const input = screen.getByPlaceholderText(/对 Agent 下指令/) as HTMLTextAreaElement;

    await user.type(input, '把 @ctx');
    await user.keyboard('{ArrowDown}{Enter}');
    expect(input.value).toBe('把 @ctx-2 ');
  });

  it('inserts the selected reference via mouse click', async () => {
    const user = userEvent.setup();
    renderPanel({ attachedContexts: [ctxA, ctxB] });
    const input = screen.getByPlaceholderText(/对 Agent 下指令/) as HTMLTextAreaElement;

    await user.type(input, '把 @');
    await user.click(screen.getByText('@document'));
    expect(input.value).toBe('把 @document ');
  });

  it('Enter with an open mention list inserts instead of submitting', async () => {
    const onSend = vi.fn();
    const user = userEvent.setup();
    renderPanel({ attachedContexts: [ctxA], onSend });
    const input = screen.getByPlaceholderText(/对 Agent 下指令/) as HTMLTextAreaElement;

    await user.type(input, '把 @{Enter}');
    expect(input.value).toBe('把 @document ');
    expect(onSend).not.toHaveBeenCalled();
  });

  it('hides the list when the query matches nothing and submits on Enter', async () => {
    const onSend = vi.fn();
    const user = userEvent.setup();
    renderPanel({ attachedContexts: [ctxA], onSend });
    const input = screen.getByPlaceholderText(/对 Agent 下指令/) as HTMLTextAreaElement;

    await user.type(input, '把 @nope{Enter}');
    expect(onSend).toHaveBeenCalledTimes(1);
    expect(onSend).toHaveBeenCalledWith('把 @nope');
  });
});

describe('AgentPanel — final 答案的 Markdown 渲染', () => {
  it('renders final event content as markdown HTML instead of raw text', () => {
    const { container } = renderPanel({
      turns: [
        {
          id: 't1',
          userMessage: '总结一下',
          events: [
            { type: 'final', content: '## 已完成\n\n**加粗** 与 `代码`。' },
          ],
          status: 'done',
        },
      ],
    });

    const bubble = container.querySelector('.chat-markdown');
    expect(bubble).not.toBeNull();
    expect(bubble?.querySelector('h2')?.textContent).toBe('已完成');
    expect(bubble?.querySelector('strong')?.textContent).toBe('加粗');
    expect(bubble?.querySelector('code')?.textContent).toBe('代码');
  });

  it('escapes raw HTML in final event content', () => {
    const { container } = renderPanel({
      turns: [
        {
          id: 't1',
          userMessage: '注入测试',
          events: [{ type: 'final', content: '<img src=x onerror=alert(1)>' }],
          status: 'done',
        },
      ],
    });
    const bubble = container.querySelector('.chat-markdown');
    expect(bubble?.innerHTML).not.toContain('<img');
    expect(bubble?.textContent).toContain('<img src=x onerror=alert(1)>');
  });
});
