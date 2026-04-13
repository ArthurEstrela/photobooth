import { describe, it, expect, vi } from 'vitest';
import { render, screen, fireEvent } from '@testing-library/react';
import { FrameSelectionScreen } from './FrameSelectionScreen';

const TEMPLATES = [
  { id: 't-1', name: 'Floral', overlayUrl: 'https://s3/t1.png', order: 0 },
  { id: 't-2', name: 'Gold',   overlayUrl: 'https://s3/t2.png', order: 1 },
];

describe('FrameSelectionScreen', () => {
  it('renders template cards', () => {
    render(
      <FrameSelectionScreen
        templates={TEMPLATES}
        selectedId=""
        onSelect={vi.fn()}
        onConfirm={vi.fn()}
        videoRef={{ current: null }}
      />
    );
    expect(screen.getByText('Floral')).toBeTruthy();
    expect(screen.getByText('Gold')).toBeTruthy();
  });

  it('Continuar button is disabled when nothing selected', () => {
    render(
      <FrameSelectionScreen
        templates={TEMPLATES}
        selectedId=""
        onSelect={vi.fn()}
        onConfirm={vi.fn()}
        videoRef={{ current: null }}
      />
    );
    expect(screen.getByText('Continuar').closest('button')).toBeDisabled();
  });

  it('Continuar button is enabled when a template is selected', () => {
    render(
      <FrameSelectionScreen
        templates={TEMPLATES}
        selectedId="t-1"
        onSelect={vi.fn()}
        onConfirm={vi.fn()}
        videoRef={{ current: null }}
      />
    );
    expect(screen.getByText('Continuar').closest('button')).not.toBeDisabled();
  });

  it('calls onSelect when a card is clicked', () => {
    const onSelect = vi.fn();
    render(
      <FrameSelectionScreen
        templates={TEMPLATES}
        selectedId=""
        onSelect={onSelect}
        onConfirm={vi.fn()}
        videoRef={{ current: null }}
      />
    );
    fireEvent.click(screen.getByText('Floral'));
    expect(onSelect).toHaveBeenCalledWith('t-1');
  });

  it('calls onConfirm when Continuar is clicked with selection', () => {
    const onConfirm = vi.fn();
    render(
      <FrameSelectionScreen
        templates={TEMPLATES}
        selectedId="t-2"
        onSelect={vi.fn()}
        onConfirm={onConfirm}
        videoRef={{ current: null }}
      />
    );
    fireEvent.click(screen.getByText('Continuar'));
    expect(onConfirm).toHaveBeenCalledOnce();
  });
});
