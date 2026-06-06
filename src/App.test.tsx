import { render, screen } from '@testing-library/react';
import { describe, expect, it } from 'vitest';
import { App } from './App';

describe('App shell', () => {
  it('shows the canvas name', () => {
    render(<App />);

    expect(screen.getByRole('heading', { name: 'Canvas' })).toBeInTheDocument();
  });
});
