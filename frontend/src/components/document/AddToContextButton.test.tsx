import { describe, it, expect, vi } from 'vitest';
import { render, screen, fireEvent } from '@testing-library/react';
import { AddToContextButton } from './AddToContextButton';

describe('AddToContextButton', () => {
  it('renders nothing when pendingSelection is null', () => {
    const onAdd = vi.fn();
    const { container } = render(
      <AddToContextButton pendingSelection={null} anchor={{ top: 10, left: 10 }} onAdd={onAdd} />,
    );
    expect(container).toBeEmptyDOMElement();
    expect(onAdd).not.toHaveBeenCalled();
  });

  it('renders nothing when pendingSelection is empty string', () => {
    const onAdd = vi.fn();
    const { container } = render(
      <AddToContextButton pendingSelection="" anchor={{ top: 10, left: 10 }} onAdd={onAdd} />,
    );
    expect(container).toBeEmptyDOMElement();
  });

  it('renders nothing when anchor is null even if selection exists', () => {
    const onAdd = vi.fn();
    const { container } = render(
      <AddToContextButton pendingSelection="some text" anchor={null} onAdd={onAdd} />,
    );
    expect(container).toBeEmptyDOMElement();
  });

  it('renders the button showing the selection character count when visible', () => {
    const onAdd = vi.fn();
    render(
      <AddToContextButton
        pendingSelection="a selected paragraph"
        anchor={{ top: 100, left: 50 }}
        onAdd={onAdd}
      />,
    );
    const btn = screen.getByRole('button');
    expect(btn).toBeInTheDocument();
    // "a selected paragraph" = 20 chars
    expect(btn).toHaveTextContent(/20/);
  });

  it('calls onAdd with the selected text when clicked', () => {
    const onAdd = vi.fn();
    render(
      <AddToContextButton
        pendingSelection="hello world"
        anchor={{ top: 0, left: 0 }}
        onAdd={onAdd}
      />,
    );
    fireEvent.click(screen.getByRole('button'));
    expect(onAdd).toHaveBeenCalledTimes(1);
    expect(onAdd).toHaveBeenCalledWith('hello world');
  });
});
