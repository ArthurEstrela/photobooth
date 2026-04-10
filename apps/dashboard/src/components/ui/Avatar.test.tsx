import { describe, it, expect } from 'vitest';
import { render, screen } from '@testing-library/react';
import { Avatar } from './Avatar';

describe('Avatar', () => {
  it('renders initials from full name', () => {
    render(<Avatar name="Arthur Estrela" />);
    expect(screen.getByText('AE')).toBeTruthy();
  });

  it('renders initials from single name', () => {
    render(<Avatar name="Arthur" />);
    expect(screen.getByText('A')).toBeTruthy();
  });

  it('renders ? when no name', () => {
    render(<Avatar />);
    expect(screen.getByText('?')).toBeTruthy();
  });

  it('renders image when src provided', () => {
    render(<Avatar name="Arthur" src="http://example.com/avatar.jpg" />);
    expect(screen.getByRole('img')).toBeTruthy();
  });
});
