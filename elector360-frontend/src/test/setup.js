import { vi } from 'vitest';
import '@testing-library/jest-dom';

// Mock localStorage
const localStorageMock = {
  getItem: vi.fn(),
  setItem: vi.fn(),
  removeItem: vi.fn(),
  clear: vi.fn()
};

Object.defineProperty(window, 'localStorage', {
  value: localStorageMock
});

// Mock window.location
delete window.location;
window.location = { href: '' };

// Mock URL.createObjectURL
window.URL.createObjectURL = vi.fn(() => 'blob:test');

// Reset mocks before each test
beforeEach(() => {
  vi.clearAllMocks();
  localStorage.getItem.mockReturnValue(null);
});
