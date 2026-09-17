import { render, screen } from '@testing-library/react';
import { describe, it, expect } from 'vitest';
import '@testing-library/jest-dom/vitest';
import { AppProviders } from '../app/providers';

describe('App', () => {
  it('renders NexoSalud title', () => {
    render(<AppProviders />);
    expect(screen.getAllByText(/NexoSalud/i)[0]).toBeInTheDocument();
  });
});
