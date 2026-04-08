import { render, screen, fireEvent } from '@testing-library/react';
import { vi } from 'vitest';
import { TemplateSelector } from './TemplateSelector';
import { ITemplate } from '@packages/shared';
import React from 'react';

const mockTemplates: ITemplate[] = [
  { id: 't1', name: 'Rosa', overlayUrl: '/rosa.png', eventId: 'ev-1', createdAt: new Date(), updatedAt: new Date() },
  { id: 't2', name: 'Azul', overlayUrl: '/azul.png', eventId: 'ev-1', createdAt: new Date(), updatedAt: new Date() },
];

const videoRef = { current: null } as React.RefObject<HTMLVideoElement>;

describe('TemplateSelector', () => {
  it('renders all template names', () => {
    render(
      <TemplateSelector
        templates={mockTemplates}
        selectedTemplateId=""
        onSelect={vi.fn()}
        onConfirm={vi.fn()}
        videoRef={videoRef}
      />,
    );
    expect(screen.getByText('Rosa')).toBeInTheDocument();
    expect(screen.getByText('Azul')).toBeInTheDocument();
  });

  it('calls onSelect with template id when clicked', () => {
    const onSelect = vi.fn();
    render(
      <TemplateSelector
        templates={mockTemplates}
        selectedTemplateId=""
        onSelect={onSelect}
        onConfirm={vi.fn()}
        videoRef={videoRef}
      />,
    );
    fireEvent.click(screen.getByText('Rosa'));
    expect(onSelect).toHaveBeenCalledWith('t1');
  });

  it('disables confirm button when no template selected', () => {
    render(
      <TemplateSelector
        templates={mockTemplates}
        selectedTemplateId=""
        onSelect={vi.fn()}
        onConfirm={vi.fn()}
        videoRef={videoRef}
      />,
    );
    expect(screen.getByRole('button', { name: /confirmar/i })).toBeDisabled();
  });

  it('enables confirm button when template is selected', () => {
    render(
      <TemplateSelector
        templates={mockTemplates}
        selectedTemplateId="t1"
        onSelect={vi.fn()}
        onConfirm={vi.fn()}
        videoRef={videoRef}
      />,
    );
    expect(screen.getByRole('button', { name: /confirmar/i })).not.toBeDisabled();
  });
});
