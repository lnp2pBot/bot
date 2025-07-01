/**
 * Common test utilities for CLAUDE tests
 */

export const createMockData = (overrides: any = {}) => ({
  id: 1,
  name: 'test',
  value: 100,
  active: true,
  ...overrides
});

export const delay = (ms: number): Promise<void> => 
  new Promise(resolve => setTimeout(resolve, ms));

export const expectAsync = async (
  asyncFn: () => Promise<any>,
  expectation: (result: any) => void
) => {
  const result = await asyncFn();
  expectation(result);
};

export const createMockCallback = () => {
  const calls: any[][] = [];
  const fn = (...args: any[]) => {
    calls.push(args);
    return args[0];
  };
  fn.calls = calls;
  fn.reset = () => calls.length = 0;
  return fn;
};

export const testWithTimeout = (
  testFn: () => Promise<void>,
  timeoutMs: number = 5000
): Promise<void> => {
  return Promise.race([
    testFn(),
    new Promise<void>((_, reject) =>
      setTimeout(() => reject(new Error('Test timeout')), timeoutMs)
    )
  ]);
};

export class MockEventEmitter {
  private events: { [key: string]: Function[] } = {};

  on(event: string, callback: Function) {
    if (!this.events[event]) this.events[event] = [];
    this.events[event].push(callback);
  }

  emit(event: string, ...args: any[]) {
    if (this.events[event]) {
      this.events[event].forEach(callback => callback(...args));
    }
  }

  removeAllListeners(event?: string) {
    if (event) {
      delete this.events[event];
    } else {
      this.events = {};
    }
  }
}