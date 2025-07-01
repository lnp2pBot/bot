/**
 * Test Setup and Utilities
 * Provides common testing helpers and configurations
 */

// Global test setup
beforeAll(() => {
  // Set test environment
  process.env.NODE_ENV = 'test';
  
  // Suppress console output during tests (optional)
  jest.spyOn(console, 'log').mockImplementation(() => {});
  jest.spyOn(console, 'warn').mockImplementation(() => {});
  jest.spyOn(console, 'error').mockImplementation(() => {});
});

afterAll(() => {
  // Restore console output
  jest.restoreAllMocks();
});

// Common test helpers
export const TestHelpers = {
  createMockFunction: <T extends (...args: any[]) => any>(
    implementation?: T
  ): jest.MockedFunction<T> => {
    return jest.fn(implementation) as jest.MockedFunction<T>;
  },

  createAsyncMock: <T>(
    resolveValue?: T,
    rejectValue?: any
  ): jest.MockedFunction<() => Promise<T>> => {
    if (rejectValue) {
      return jest.fn().mockRejectedValue(rejectValue);
    }
    return jest.fn().mockResolvedValue(resolveValue);
  },

  waitFor: (ms: number): Promise<void> => {
    return new Promise(resolve => setTimeout(resolve, ms));
  },

  generateTestData: {
    string: (length: number = 10): string => {
      return 'a'.repeat(length);
    },
    number: (min: number = 0, max: number = 100): number => {
      return Math.floor(Math.random() * (max - min + 1)) + min;
    },
    array: <T>(generator: () => T, length: number = 5): T[] => {
      return Array.from({ length }, generator);
    },
    object: (keys: string[]): Record<string, any> => {
      return keys.reduce((obj, key) => {
        obj[key] = `value_${key}`;
        return obj;
      }, {} as Record<string, any>);
    }
  }
};

// Custom matchers (if needed)
expect.extend({
  toBeWithinRange(received: number, floor: number, ceiling: number) {
    const pass = received >= floor && received <= ceiling;
    if (pass) {
      return {
        message: () =>
          `expected ${received} not to be within range ${floor} - ${ceiling}`,
        pass: true,
      };
    } else {
      return {
        message: () =>
          `expected ${received} to be within range ${floor} - ${ceiling}`,
        pass: false,
      };
    }
  },
});

declare global {
  namespace jest {
    interface Matchers<R> {
      toBeWithinRange(floor: number, ceiling: number): R;
    }
  }
}