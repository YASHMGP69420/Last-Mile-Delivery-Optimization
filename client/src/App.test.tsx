import { describe, it, expect } from 'vitest';
import { renderWithProviders } from './test/test-utils';
import App from './App';

describe('Smoke Test', () => {
  it('renders App without crashing', () => {
    const { container } = renderWithProviders(<App />);
    expect(container).toBeInTheDocument();
  });
});