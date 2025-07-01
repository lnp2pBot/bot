import {
  formatDate,
  isValidEmail,
  debounce,
  throttle,
  deepClone,
  mergeObjects,
  generateId,
  validateRequired,
  sanitizeInput,
  calculateAge,
  formatCurrency,
  parseQuery,
  buildUrl,
  retry,
  memoize,
  capitalize,
  camelCase,
  kebabCase,
  truncate,
  isEmptyObject,
  pick,
  omit,
  flatten,
  chunk,
  unique,
  groupBy,
  sortBy,
  formatNumber,
  randomInt,
  sleep,
  isValidUrl,
  extractDomain,
  formatFileSize,
  validatePassword,
  generateSlug,
  parseJSON,
  stringifyJSON,
  hashString,
  compareVersions,
  clamp,
  lerp,
  formatRelativeTime,
  isValidDate
} from './index';

// Testing Framework: Jest
describe('util/index - Comprehensive Test Suite', () => {
  // Date and Time Utilities
  describe('Date and Time Functions', () => {
    describe('formatDate', () => {
      it('should format date with default format (ISO)', () => {
        const date = new Date('2023-12-25T10:30:00Z');
        expect(formatDate(date)).toBe('2023-12-25');
      });

      it('should format date with custom format patterns', () => {
        const date = new Date('2023-12-25T10:30:00Z');
        expect(formatDate(date, 'MM/dd/yyyy')).toBe('12/25/2023');
        expect(formatDate(date, 'dd-MM-yyyy')).toBe('25-12-2023');
        expect(formatDate(date, 'yyyy-MM-dd HH:mm:ss')).toContain('2023-12-25');
      });

      it('should handle different timezones', () => {
        const date = new Date('2023-12-25T10:30:00Z');
        expect(formatDate(date, 'yyyy-MM-dd', 'UTC')).toBe('2023-12-25');
        expect(formatDate(date, 'yyyy-MM-dd', 'America/New_York')).toBeDefined();
      });

      it('should throw error for invalid dates', () => {
        expect(() => formatDate(new Date('invalid'))).toThrow();
        expect(() => formatDate(null as any)).toThrow();
        expect(() => formatDate(undefined as any)).toThrow();
      });

      it('should handle edge cases', () => {
        const leapYear = new Date('2024-02-29T00:00:00Z');
        expect(formatDate(leapYear)).toBe('2024-02-29');
        
        const endOfYear = new Date('2023-12-31T23:59:59Z');
        expect(formatDate(endOfYear)).toBe('2023-12-31');
      });
    });

    describe('calculateAge', () => {
      it('should calculate age correctly for different scenarios', () => {
        const birthDate = new Date('1990-01-01');
        const currentDate = new Date('2023-01-01');
        expect(calculateAge(birthDate, currentDate)).toBe(33);
      });

      it('should handle birthday not yet occurred this year', () => {
        const birthDate = new Date('1990-06-15');
        const currentDate = new Date('2023-03-01');
        expect(calculateAge(birthDate, currentDate)).toBe(32);
      });

      it('should handle birthday on same day', () => {
        const birthDate = new Date('1990-03-15');
        const currentDate = new Date('2023-03-15');
        expect(calculateAge(birthDate, currentDate)).toBe(33);
      });

      it('should throw error for future birth dates', () => {
        const birthDate = new Date('2025-01-01');
        const currentDate = new Date('2023-01-01');
        expect(() => calculateAge(birthDate, currentDate)).toThrow('Birth date cannot be in the future');
      });

      it('should handle leap year birthdays', () => {
        const birthDate = new Date('1992-02-29');
        const currentDate = new Date('2023-02-28');
        expect(calculateAge(birthDate, currentDate)).toBe(30);
      });
    });

    describe('isValidDate', () => {
      it('should validate correct dates', () => {
        expect(isValidDate(new Date('2023-01-01'))).toBe(true);
        expect(isValidDate(new Date())).toBe(true);
      });

      it('should reject invalid dates', () => {
        expect(isValidDate(new Date('invalid'))).toBe(false);
        expect(isValidDate(null as any)).toBe(false);
        expect(isValidDate(undefined as any)).toBe(false);
        expect(isValidDate('2023-01-01' as any)).toBe(false);
      });
    });

    describe('formatRelativeTime', () => {
      it('should format relative time correctly', () => {
        const now = new Date();
        const anHourAgo = new Date(now.getTime() - 60 * 60 * 1000);
        const tomorrow = new Date(now.getTime() + 24 * 60 * 60 * 1000);

        expect(formatRelativeTime(anHourAgo)).toContain('hour');
        expect(formatRelativeTime(tomorrow)).toContain('day');
      });
    });
  });

  // String Manipulation Functions
  describe('String Utilities', () => {
    describe('capitalize', () => {
      it('should capitalize first letter', () => {
        expect(capitalize('hello')).toBe('Hello');
        expect(capitalize('HELLO')).toBe('Hello');
      });

      it('should handle edge cases', () => {
        expect(capitalize('')).toBe('');
        expect(capitalize('a')).toBe('A');
        expect(capitalize('123abc')).toBe('123abc');
      });

      it('should handle non-string inputs', () => {
        expect(() => capitalize(null as any)).toThrow();
        expect(() => capitalize(undefined as any)).toThrow();
      });
    });

    describe('camelCase', () => {
      it('should convert to camelCase', () => {
        expect(camelCase('hello world')).toBe('helloWorld');
        expect(camelCase('hello-world')).toBe('helloWorld');
        expect(camelCase('hello_world')).toBe('helloWorld');
        expect(camelCase('Hello World')).toBe('helloWorld');
      });

      it('should handle special characters', () => {
        expect(camelCase('hello@world#test')).toBe('helloWorldTest');
        expect(camelCase('  hello   world  ')).toBe('helloWorld');
      });
    });

    describe('kebabCase', () => {
      it('should convert to kebab-case', () => {
        expect(kebabCase('helloWorld')).toBe('hello-world');
        expect(kebabCase('HelloWorld')).toBe('hello-world');
        expect(kebabCase('hello world')).toBe('hello-world');
        expect(kebabCase('hello_world')).toBe('hello-world');
      });
    });

    describe('truncate', () => {
      it('should truncate long strings', () => {
        const longString = 'This is a very long string that should be truncated';
        expect(truncate(longString, 20)).toBe('This is a very long...');
      });

      it('should not truncate short strings', () => {
        const shortString = 'Short';
        expect(truncate(shortString, 20)).toBe('Short');
      });

      it('should handle custom ellipsis', () => {
        const string = 'Hello world';
        expect(truncate(string, 8, ' [more]')).toBe('Hello [more]');
      });

      it('should handle edge cases', () => {
        expect(truncate('', 10)).toBe('');
        expect(truncate('Hello', 0)).toBe('...');
        expect(truncate('Hello', 5)).toBe('Hello');
      });
    });

    describe('generateSlug', () => {
      it('should generate URL-friendly slugs', () => {
        expect(generateSlug('Hello World')).toBe('hello-world');
        expect(generateSlug('This is a Test!')).toBe('this-is-a-test');
        expect(generateSlug('Special@Characters#Here')).toBe('special-characters-here');
      });

      it('should handle unicode characters', () => {
        expect(generateSlug('Café & Résumé')).toBe('cafe-resume');
        expect(generateSlug('Müller & Sön')).toBe('muller-son');
      });
    });
  });

  // Validation Functions
  describe('Validation Utilities', () => {
    describe('isValidEmail', () => {
      it('should validate correct email addresses', () => {
        const validEmails = [
          'test@example.com',
          'user.name@domain.co.uk',
          'user+tag@example.org',
          'firstname.lastname@company.com',
          'user123@test-domain.com'
        ];

        validEmails.forEach(email => {
          expect(isValidEmail(email)).toBe(true);
        });
      });

      it('should reject invalid email addresses', () => {
        const invalidEmails = [
          'invalid-email',
          'test@',
          '@domain.com',
          'test@domain',
          '',
          'test..test@example.com',
          'test@.com',
          'test@domain.',
          '.test@domain.com'
        ];

        invalidEmails.forEach(email => {
          expect(isValidEmail(email)).toBe(false);
        });
      });

      it('should handle edge cases and whitespace', () => {
        expect(isValidEmail('  test@example.com  ')).toBe(true);
        expect(isValidEmail(null as any)).toBe(false);
        expect(isValidEmail(undefined as any)).toBe(false);
        expect(isValidEmail(123 as any)).toBe(false);
      });
    });

    describe('isValidUrl', () => {
      it('should validate correct URLs', () => {
        const validUrls = [
          'https://example.com',
          'http://test.org',
          'https://sub.domain.com/path?query=1',
          'ftp://files.example.com',
          'https://localhost:3000'
        ];

        validUrls.forEach(url => {
          expect(isValidUrl(url)).toBe(true);
        });
      });

      it('should reject invalid URLs', () => {
        const invalidUrls = [
          'not-a-url',
          'http://',
          '://example.com',
          'example.com',
          '',
          'javascript:alert(1)'
        ];

        invalidUrls.forEach(url => {
          expect(isValidUrl(url)).toBe(false);
        });
      });
    });

    describe('validatePassword', () => {
      it('should validate strong passwords', () => {
        const strongPasswords = [
          'MyStr0ngP@ssw0rd',
          'C0mpl3x!P@ssw0rd123',
          'Secure#Password2023'
        ];

        strongPasswords.forEach(password => {
          expect(validatePassword(password)).toBe(true);
        });
      });

      it('should reject weak passwords', () => {
        const weakPasswords = [
          'password',
          '123456',
          'abc123',
          'PASSWORD',
          'Pass123'  // too short
        ];

        weakPasswords.forEach(password => {
          expect(validatePassword(password)).toBe(false);
        });
      });
    });

    describe('validateRequired', () => {
      it('should validate objects with all required fields', () => {
        const data = { name: 'John', email: 'john@example.com', age: 30 };
        const required = ['name', 'email'];
        expect(validateRequired(data, required)).toBe(true);
      });

      it('should fail validation for missing fields', () => {
        const data = { name: 'John' };
        const required = ['name', 'email'];
        expect(validateRequired(data, required)).toBe(false);
      });

      it('should handle empty values as invalid', () => {
        const data = { name: '', email: 'john@example.com' };
        const required = ['name', 'email'];
        expect(validateRequired(data, required)).toBe(false);
      });

      it('should handle null/undefined values', () => {
        const data = { name: null, email: undefined, age: 0 };
        const required = ['name', 'email', 'age'];
        expect(validateRequired(data, required)).toBe(false);
      });
    });
  });

  // Array and Object Manipulation
  describe('Array and Object Utilities', () => {
    describe('deepClone', () => {
      it('should clone primitive values', () => {
        expect(deepClone(42)).toBe(42);
        expect(deepClone('hello')).toBe('hello');
        expect(deepClone(true)).toBe(true);
        expect(deepClone(null)).toBe(null);
        expect(deepClone(undefined)).toBe(undefined);
      });

      it('should deep clone objects', () => {
        const obj = { a: 1, b: { c: 2, d: { e: 3 } } };
        const cloned = deepClone(obj);
        
        expect(cloned).toEqual(obj);
        expect(cloned).not.toBe(obj);
        expect(cloned.b).not.toBe(obj.b);
        expect(cloned.b.d).not.toBe(obj.b.d);
      });

      it('should deep clone arrays', () => {
        const arr = [1, [2, 3], { a: 4 }, [[5, 6]]];
        const cloned = deepClone(arr);
        
        expect(cloned).toEqual(arr);
        expect(cloned).not.toBe(arr);
        expect(cloned[1]).not.toBe(arr[1]);
        expect(cloned[2]).not.toBe(arr[2]);
      });

      it('should handle special objects', () => {
        const date = new Date('2023-01-01');
        const regex = /test/g;
        const map = new Map([['key', 'value']]);
        const set = new Set([1, 2, 3]);

        expect(deepClone(date)).toEqual(date);
        expect(deepClone(regex)).toEqual(regex);
        expect(deepClone(map)).toEqual(map);
        expect(deepClone(set)).toEqual(set);
      });

      it('should handle circular references', () => {
        const obj: any = { a: 1 };
        obj.self = obj;
        
        const cloned = deepClone(obj);
        expect(cloned.a).toBe(1);
        expect(cloned.self).toBe(cloned);
      });
    });

    describe('mergeObjects', () => {
      it('should merge simple objects', () => {
        const obj1 = { a: 1, b: 2 };
        const obj2 = { c: 3, d: 4 };
        expect(mergeObjects(obj1, obj2)).toEqual({ a: 1, b: 2, c: 3, d: 4 });
      });

      it('should handle property overwrites', () => {
        const obj1 = { a: 1, b: 2 };
        const obj2 = { b: 3, c: 4 };
        expect(mergeObjects(obj1, obj2)).toEqual({ a: 1, b: 3, c: 4 });
      });

      it('should deep merge nested objects', () => {
        const obj1 = { a: { x: 1, y: 2 }, b: 1 };
        const obj2 = { a: { y: 3, z: 4 }, c: 2 };
        expect(mergeObjects(obj1, obj2)).toEqual({ 
          a: { x: 1, y: 3, z: 4 }, 
          b: 1, 
          c: 2 
        });
      });

      it('should handle multiple objects', () => {
        const obj1 = { a: 1 };
        const obj2 = { b: 2 };
        const obj3 = { c: 3 };
        expect(mergeObjects(obj1, obj2, obj3)).toEqual({ a: 1, b: 2, c: 3 });
      });

      it('should handle null/undefined inputs', () => {
        const obj = { a: 1 };
        expect(mergeObjects(obj, null)).toEqual({ a: 1 });
        expect(mergeObjects(obj, undefined)).toEqual({ a: 1 });
        expect(mergeObjects(null, obj)).toEqual({ a: 1 });
      });
    });

    describe('isEmptyObject', () => {
      it('should identify empty objects', () => {
        expect(isEmptyObject({})).toBe(true);
        expect(isEmptyObject(Object.create(null))).toBe(true);
      });

      it('should identify non-empty objects', () => {
        expect(isEmptyObject({ a: 1 })).toBe(false);
        expect(isEmptyObject({ a: undefined })).toBe(false);
      });

      it('should handle non-objects', () => {
        expect(isEmptyObject(null)).toBe(true);
        expect(isEmptyObject(undefined)).toBe(true);
        expect(isEmptyObject([])).toBe(true);
        expect(isEmptyObject('')).toBe(false);
      });
    });

    describe('pick', () => {
      it('should pick specified properties', () => {
        const obj = { a: 1, b: 2, c: 3, d: 4 };
        expect(pick(obj, ['a', 'c'])).toEqual({ a: 1, c: 3 });
      });

      it('should handle non-existent properties', () => {
        const obj = { a: 1, b: 2 };
        expect(pick(obj, ['a', 'x'] as any)).toEqual({ a: 1 });
      });

      it('should handle empty selection', () => {
        const obj = { a: 1, b: 2 };
        expect(pick(obj, [])).toEqual({});
      });
    });

    describe('omit', () => {
      it('should omit specified properties', () => {
        const obj = { a: 1, b: 2, c: 3, d: 4 };
        expect(omit(obj, ['b', 'd'])).toEqual({ a: 1, c: 3 });
      });

      it('should handle non-existent properties', () => {
        const obj = { a: 1, b: 2 };
        expect(omit(obj, ['b', 'x'] as any)).toEqual({ a: 1 });
      });
    });

    describe('flatten', () => {
      it('should flatten nested arrays', () => {
        expect(flatten([1, [2, 3], [4, [5, 6]]])).toEqual([1, 2, 3, 4, 5, 6]);
        expect(flatten([[1, 2], [3, 4]])).toEqual([1, 2, 3, 4]);
      });

      it('should handle deeply nested arrays', () => {
        expect(flatten([1, [2, [3, [4]]]], 2)).toEqual([1, 2, 3, [4]]);
      });

      it('should handle empty arrays', () => {
        expect(flatten([])).toEqual([]);
        expect(flatten([[], []])).toEqual([]);
      });
    });

    describe('chunk', () => {
      it('should chunk arrays into specified sizes', () => {
        expect(chunk([1, 2, 3, 4, 5, 6], 2)).toEqual([[1, 2], [3, 4], [5, 6]]);
        expect(chunk([1, 2, 3, 4, 5], 2)).toEqual([[1, 2], [3, 4], [5]]);
      });

      it('should handle edge cases', () => {
        expect(chunk([], 2)).toEqual([]);
        expect(chunk([1, 2, 3], 5)).toEqual([[1, 2, 3]]);
        expect(chunk([1, 2, 3], 1)).toEqual([[1], [2], [3]]);
      });
    });

    describe('unique', () => {
      it('should remove duplicates from arrays', () => {
        expect(unique([1, 2, 2, 3, 3, 3])).toEqual([1, 2, 3]);
        expect(unique(['a', 'b', 'a', 'c'])).toEqual(['a', 'b', 'c']);
      });

      it('should handle objects by reference', () => {
        const obj1 = { id: 1 };
        const obj2 = { id: 2 };
        expect(unique([obj1, obj2, obj1])).toEqual([obj1, obj2]);
      });

      it('should handle empty arrays', () => {
        expect(unique([])).toEqual([]);
      });
    });

    describe('groupBy', () => {
      it('should group objects by property', () => {
        const data = [
          { category: 'A', value: 1 },
          { category: 'B', value: 2 },
          { category: 'A', value: 3 }
        ];
        
        const grouped = groupBy(data, 'category');
        expect(grouped.A).toHaveLength(2);
        expect(grouped.B).toHaveLength(1);
      });

      it('should group by function', () => {
        const data = [1, 2, 3, 4, 5, 6];
        const grouped = groupBy(data, (n: number) => n % 2 === 0 ? 'even' : 'odd');
        
        expect(grouped.odd).toEqual([1, 3, 5]);
        expect(grouped.even).toEqual([2, 4, 6]);
      });
    });

    describe('sortBy', () => {
      it('should sort by property', () => {
        const data = [
          { name: 'Charlie', age: 30 },
          { name: 'Alice', age: 25 },
          { name: 'Bob', age: 35 }
        ];
        
        const sorted = sortBy(data, 'name');
        expect(sorted[0].name).toBe('Alice');
        expect(sorted[2].name).toBe('Charlie');
      });

      it('should sort by function', () => {
        const data = [3, 1, 4, 1, 5, 9];
        const sorted = sortBy(data, (n: number) => -n);
        expect(sorted).toEqual([9, 5, 4, 3, 1, 1]);
      });
    });
  });

  // Function Utilities
  describe('Function Utilities', () => {
    beforeEach(() => {
      jest.useFakeTimers();
    });

    afterEach(() => {
      jest.useRealTimers();
    });

    describe('debounce', () => {
      it('should debounce function calls', () => {
        const mockFn = jest.fn();
        const debouncedFn = debounce(mockFn, 100);

        debouncedFn();
        debouncedFn();
        debouncedFn();

        expect(mockFn).not.toHaveBeenCalled();
        jest.advanceTimersByTime(100);
        expect(mockFn).toHaveBeenCalledTimes(1);
      });

      it('should pass arguments correctly', () => {
        const mockFn = jest.fn();
        const debouncedFn = debounce(mockFn, 100);

        debouncedFn('arg1', 'arg2');
        jest.advanceTimersByTime(100);

        expect(mockFn).toHaveBeenCalledWith('arg1', 'arg2');
      });

      it('should reset timer on subsequent calls', () => {
        const mockFn = jest.fn();
        const debouncedFn = debounce(mockFn, 100);

        debouncedFn();
        jest.advanceTimersByTime(50);
        debouncedFn();
        jest.advanceTimersByTime(50);

        expect(mockFn).not.toHaveBeenCalled();
        jest.advanceTimersByTime(50);
        expect(mockFn).toHaveBeenCalledTimes(1);
      });

      it('should handle immediate execution option', () => {
        const mockFn = jest.fn();
        const debouncedFn = debounce(mockFn, 100, true);

        debouncedFn();
        expect(mockFn).toHaveBeenCalledTimes(1);
        
        debouncedFn();
        expect(mockFn).toHaveBeenCalledTimes(1);
      });
    });

    describe('throttle', () => {
      it('should throttle function calls', () => {
        const mockFn = jest.fn();
        const throttledFn = throttle(mockFn, 100);

        throttledFn();
        throttledFn();
        throttledFn();

        expect(mockFn).toHaveBeenCalledTimes(1);
        jest.advanceTimersByTime(100);
        throttledFn();
        expect(mockFn).toHaveBeenCalledTimes(2);
      });

      it('should preserve function context', () => {
        const context = { value: 42 };
        const mockFn = jest.fn(function(this: any) {
          return this.value;
        });
        const throttledFn = throttle(mockFn, 100);

        throttledFn.call(context);
        expect(mockFn).toHaveBeenCalledWith();
      });

      it('should handle trailing calls', () => {
        const mockFn = jest.fn();
        const throttledFn = throttle(mockFn, 100);

        throttledFn();
        throttledFn();
        jest.advanceTimersByTime(50);
        throttledFn();

        expect(mockFn).toHaveBeenCalledTimes(1);
        jest.advanceTimersByTime(100);
        expect(mockFn).toHaveBeenCalledTimes(2);
      });
    });

    describe('memoize', () => {
      it('should cache function results', () => {
        const expensiveFn = jest.fn((x: number) => x * 2);
        const memoized = memoize(expensiveFn);

        expect(memoized(5)).toBe(10);
        expect(memoized(5)).toBe(10);
        expect(expensiveFn).toHaveBeenCalledTimes(1);
      });

      it('should handle different arguments', () => {
        const expensiveFn = jest.fn((x: number) => x * 2);
        const memoized = memoize(expensiveFn);

        expect(memoized(5)).toBe(10);
        expect(memoized(10)).toBe(20);
        expect(memoized(5)).toBe(10);
        expect(expensiveFn).toHaveBeenCalledTimes(2);
      });

      it('should handle multiple arguments', () => {
        const fn = jest.fn((a: number, b: number) => a + b);
        const memoized = memoize(fn);

        expect(memoized(1, 2)).toBe(3);
        expect(memoized(1, 2)).toBe(3);
        expect(memoized(2, 3)).toBe(5);
        expect(fn).toHaveBeenCalledTimes(2);
      });

      it('should handle custom key resolver', () => {
        const fn = jest.fn((obj: any) => obj.x + obj.y);
        const keyResolver = (obj: any) => `${obj.x}-${obj.y}`;
        const memoized = memoize(fn, keyResolver);

        expect(memoized({ x: 1, y: 2 })).toBe(3);
        expect(memoized({ x: 1, y: 2 })).toBe(3);
        expect(fn).toHaveBeenCalledTimes(1);
      });
    });

    describe('retry', () => {
      beforeEach(() => {
        jest.useRealTimers();
      });

      it('should succeed on first attempt', async () => {
        const mockFn = jest.fn().mockResolvedValue('success');
        const result = await retry(mockFn, 3);

        expect(result).toBe('success');
        expect(mockFn).toHaveBeenCalledTimes(1);
      });

      it('should retry on failure and eventually succeed', async () => {
        const mockFn = jest.fn()
          .mockRejectedValueOnce(new Error('fail1'))
          .mockRejectedValueOnce(new Error('fail2'))
          .mockResolvedValue('success');

        const result = await retry(mockFn, 3);

        expect(result).toBe('success');
        expect(mockFn).toHaveBeenCalledTimes(3);
      });

      it('should fail after max retries', async () => {
        const mockFn = jest.fn().mockRejectedValue(new Error('always fails'));

        await expect(retry(mockFn, 2)).rejects.toThrow('always fails');
        expect(mockFn).toHaveBeenCalledTimes(2);
      });

      it('should handle retry delay', async () => {
        const mockFn = jest.fn()
          .mockRejectedValueOnce(new Error('fail'))
          .mockResolvedValue('success');

        const startTime = Date.now();
        const result = await retry(mockFn, 3, 100);
        const endTime = Date.now();

        expect(result).toBe('success');
        expect(endTime - startTime).toBeGreaterThanOrEqual(100);
      });
    });
  });

  // Formatting and Number Utilities
  describe('Formatting and Number Utilities', () => {
    describe('formatCurrency', () => {
      it('should format currency with default locale (USD)', () => {
        expect(formatCurrency(1234.56)).toBe('$1,234.56');
        expect(formatCurrency(0)).toBe('$0.00');
        expect(formatCurrency(-100.50)).toBe('-$100.50');
      });

      it('should format currency with different locales', () => {
        expect(formatCurrency(1234.56, 'EUR', 'de-DE')).toContain('€');
        expect(formatCurrency(1234.56, 'GBP', 'en-GB')).toContain('£');
        expect(formatCurrency(1234.56, 'JPY', 'ja-JP')).toContain('¥');
      });

      it('should handle large numbers', () => {
        expect(formatCurrency(1000000)).toBe('$1,000,000.00');
        expect(formatCurrency(1234567.89)).toBe('$1,234,567.89');
      });

      it('should handle edge cases', () => {
        expect(formatCurrency(0.01)).toBe('$0.01');
        expect(formatCurrency(0.001)).toBe('$0.00');
        expect(() => formatCurrency(NaN)).toThrow();
        expect(() => formatCurrency(Infinity)).toThrow();
      });
    });

    describe('formatNumber', () => {
      it('should format numbers with thousand separators', () => {
        expect(formatNumber(1234)).toBe('1,234');
        expect(formatNumber(1234567)).toBe('1,234,567');
      });

      it('should handle decimal places', () => {
        expect(formatNumber(1234.5678, 2)).toBe('1,234.57');
        expect(formatNumber(1234, 2)).toBe('1,234.00');
      });

      it('should handle different locales', () => {
        expect(formatNumber(1234.56, 2, 'de-DE')).toBe('1.234,56');
        expect(formatNumber(1234.56, 2, 'fr-FR')).toContain('234');
      });
    });

    describe('formatFileSize', () => {
      it('should format bytes correctly', () => {
        expect(formatFileSize(1024)).toBe('1 KB');
        expect(formatFileSize(1048576)).toBe('1 MB');
        expect(formatFileSize(1073741824)).toBe('1 GB');
      });

      it('should handle decimal places', () => {
        expect(formatFileSize(1536)).toBe('1.5 KB');
        expect(formatFileSize(1572864)).toBe('1.5 MB');
      });

      it('should handle small sizes', () => {
        expect(formatFileSize(512)).toBe('512 B');
        expect(formatFileSize(0)).toBe('0 B');
      });
    });

    describe('clamp', () => {
      it('should clamp values within range', () => {
        expect(clamp(5, 0, 10)).toBe(5);
        expect(clamp(-5, 0, 10)).toBe(0);
        expect(clamp(15, 0, 10)).toBe(10);
      });

      it('should handle edge cases', () => {
        expect(clamp(5, 5, 5)).toBe(5);
        expect(clamp(5, 0, 0)).toBe(0);
      });
    });

    describe('lerp', () => {
      it('should interpolate between values', () => {
        expect(lerp(0, 10, 0.5)).toBe(5);
        expect(lerp(0, 10, 0)).toBe(0);
        expect(lerp(0, 10, 1)).toBe(10);
      });

      it('should handle negative values', () => {
        expect(lerp(-10, 10, 0.5)).toBe(0);
        expect(lerp(-5, -1, 0.5)).toBe(-3);
      });
    });

    describe('randomInt', () => {
      it('should generate random integers within range', () => {
        for (let i = 0; i < 100; i++) {
          const num = randomInt(1, 10);
          expect(num).toBeGreaterThanOrEqual(1);
          expect(num).toBeLessThanOrEqual(10);
          expect(Number.isInteger(num)).toBe(true);
        }
      });

      it('should handle single value range', () => {
        expect(randomInt(5, 5)).toBe(5);
      });
    });
  });

  // URL and Network Utilities
  describe('URL and Network Utilities', () => {
    describe('parseQuery', () => {
      it('should parse simple query strings', () => {
        expect(parseQuery('?name=John&age=30')).toEqual({ name: 'John', age: '30' });
        expect(parseQuery('name=John&age=30')).toEqual({ name: 'John', age: '30' });
      });

      it('should handle URL encoded values', () => {
        expect(parseQuery('?message=Hello%20World')).toEqual({ message: 'Hello World' });
        expect(parseQuery('?data=%7B%22key%22%3A%22value%22%7D')).toEqual({ 
          data: '{"key":"value"}' 
        });
      });

      it('should handle empty and malformed queries', () => {
        expect(parseQuery('')).toEqual({});
        expect(parseQuery('?')).toEqual({});
        expect(parseQuery('?=')).toEqual({ '': '' });
        expect(parseQuery('?key')).toEqual({ key: '' });
      });

      it('should handle duplicate parameters', () => {
        expect(parseQuery('?tag=red&tag=blue')).toEqual({ tag: ['red', 'blue'] });
        expect(parseQuery('?id=1&id=2&id=3')).toEqual({ id: ['1', '2', '3'] });
      });

      it('should handle complex scenarios', () => {
        const query = '?filters[category]=tech&filters[status]=active&sort=name';
        const result = parseQuery(query);
        expect(result).toHaveProperty('filters[category]', 'tech');
        expect(result).toHaveProperty('filters[status]', 'active');
        expect(result).toHaveProperty('sort', 'name');
      });
    });

    describe('buildUrl', () => {
      it('should build URLs with query parameters', () => {
        const url = buildUrl('https://api.example.com/users', { page: 1, limit: 10 });
        expect(url).toBe('https://api.example.com/users?page=1&limit=10');
      });

      it('should handle existing query parameters', () => {
        const url = buildUrl('https://api.example.com/users?sort=name', { page: 1 });
        expect(url).toBe('https://api.example.com/users?sort=name&page=1');
      });

      it('should handle empty and null parameters', () => {
        const url1 = buildUrl('https://api.example.com/users', {});
        expect(url1).toBe('https://api.example.com/users');

        const url2 = buildUrl('https://api.example.com/users', { page: 1, empty: null });
        expect(url2).toBe('https://api.example.com/users?page=1');
      });

      it('should handle array parameters', () => {
        const url = buildUrl('https://api.example.com/search', { 
          tags: ['javascript', 'typescript'], 
          category: 'tech' 
        });
        expect(url).toContain('tags=javascript');
        expect(url).toContain('tags=typescript');
        expect(url).toContain('category=tech');
      });

      it('should properly encode special characters', () => {
        const url = buildUrl('https://api.example.com/search', { 
          query: 'hello world',
          special: 'a&b=c' 
        });
        expect(url).toContain('hello%20world');
        expect(url).toContain('a%26b%3Dc');
      });
    });

    describe('extractDomain', () => {
      it('should extract domains from URLs', () => {
        expect(extractDomain('https://www.example.com/path')).toBe('www.example.com');
        expect(extractDomain('http://api.service.com:8080')).toBe('api.service.com');
        expect(extractDomain('https://localhost:3000')).toBe('localhost');
      });

      it('should handle edge cases', () => {
        expect(extractDomain('/relative/path')).toBe(null);
        expect(extractDomain('not-a-url')).toBe(null);
        expect(extractDomain('')).toBe(null);
      });
    });
  });

  // Security and Sanitization
  describe('Security and Sanitization Utilities', () => {
    describe('sanitizeInput', () => {
      it('should remove dangerous script tags', () => {
        const input = '<script>alert("xss")</script>Hello';
        const sanitized = sanitizeInput(input);
        expect(sanitized).not.toContain('<script>');
        expect(sanitized).toContain('Hello');
      });

      it('should preserve safe HTML', () => {
        const input = '<p>Hello <strong>world</strong></p>';
        const sanitized = sanitizeInput(input);
        expect(sanitized).toContain('<p>');
        expect(sanitized).toContain('<strong>');
      });

      it('should handle various XSS attempts', () => {
        const xssAttempts = [
          '<img src="x" onerror="alert(1)">',
          '<svg onload="alert(1)">',
          'javascript:alert(1)',
          '<iframe src="javascript:alert(1)"></iframe>'
        ];

        xssAttempts.forEach(attempt => {
          const sanitized = sanitizeInput(attempt);
          expect(sanitized).not.toContain('alert');
          expect(sanitized).not.toContain('javascript:');
        });
      });

      it('should handle empty and null inputs', () => {
        expect(sanitizeInput('')).toBe('');
        expect(sanitizeInput(null as any)).toBe('');
        expect(sanitizeInput(undefined as any)).toBe('');
      });
    });

    describe('hashString', () => {
      it('should generate consistent hashes', () => {
        const input = 'test string';
        const hash1 = hashString(input);
        const hash2 = hashString(input);
        expect(hash1).toBe(hash2);
        expect(typeof hash1).toBe('string');
        expect(hash1.length).toBeGreaterThan(0);
      });

      it('should generate different hashes for different inputs', () => {
        const hash1 = hashString('string1');
        const hash2 = hashString('string2');
        expect(hash1).not.toBe(hash2);
      });

      it('should handle edge cases', () => {
        expect(hashString('')).toBeDefined();
        expect(hashString('a')).toBeDefined();
        expect(() => hashString(null as any)).toThrow();
      });
    });
  });

  // JSON and Data Utilities
  describe('JSON and Data Utilities', () => {
    describe('parseJSON', () => {
      it('should parse valid JSON', () => {
        expect(parseJSON('{"key": "value"}')).toEqual({ key: 'value' });
        expect(parseJSON('[1, 2, 3]')).toEqual([1, 2, 3]);
        expect(parseJSON('true')).toBe(true);
        expect(parseJSON('null')).toBe(null);
      });

      it('should handle invalid JSON gracefully', () => {
        expect(parseJSON('invalid json')).toBe(null);
        expect(parseJSON('{key: value}')).toBe(null);
        expect(parseJSON('')).toBe(null);
      });

      it('should use fallback value', () => {
        expect(parseJSON('invalid', { default: true })).toEqual({ default: true });
        expect(parseJSON('{"valid": true}', { default: false })).toEqual({ valid: true });
      });
    });

    describe('stringifyJSON', () => {
      it('should stringify objects', () => {
        expect(stringifyJSON({ key: 'value' })).toBe('{"key":"value"}');
        expect(stringifyJSON([1, 2, 3])).toBe('[1,2,3]');
        expect(stringifyJSON(null)).toBe('null');
      });

      it('should handle circular references', () => {
        const obj: any = { name: 'test' };
        obj.self = obj;
        expect(() => stringifyJSON(obj)).not.toThrow();
      });

      it('should handle pretty printing', () => {
        const obj = { a: 1, b: 2 };
        const pretty = stringifyJSON(obj, 2);
        expect(pretty).toContain('\n');
        expect(pretty).toContain('  ');
      });
    });

    describe('compareVersions', () => {
      it('should compare semantic versions correctly', () => {
        expect(compareVersions('1.0.0', '1.0.1')).toBe(-1);
        expect(compareVersions('1.0.1', '1.0.0')).toBe(1);
        expect(compareVersions('1.0.0', '1.0.0')).toBe(0);
      });

      it('should handle different version formats', () => {
        expect(compareVersions('1.0', '1.0.0')).toBe(0);
        expect(compareVersions('1', '1.0.0')).toBe(0);
        expect(compareVersions('2.0', '1.9.9')).toBe(1);
      });

      it('should handle pre-release versions', () => {
        expect(compareVersions('1.0.0-alpha', '1.0.0')).toBe(-1);
        expect(compareVersions('1.0.0-alpha.1', '1.0.0-alpha.2')).toBe(-1);
      });
    });
  });

  // Utility Generation Functions
  describe('Generation Utilities', () => {
    describe('generateId', () => {
      it('should generate unique IDs', () => {
        const ids = new Set();
        for (let i = 0; i < 100; i++) {
          ids.add(generateId());
        }
        expect(ids.size).toBe(100);
      });

      it('should generate IDs with specified length', () => {
        expect(generateId(8).length).toBe(8);
        expect(generateId(16).length).toBe(16);
        expect(generateId(32).length).toBe(32);
      });

      it('should generate IDs with custom prefix', () => {
        const id = generateId(8, 'user_');
        expect(id).toMatch(/^user_[a-zA-Z0-9]{8}$/);
      });

      it('should handle edge cases', () => {
        expect(generateId(0)).toBe('');
        expect(generateId(1)).toHaveLength(1);
        expect(() => generateId(-1)).toThrow();
      });
    });
  });

  // Async Utilities
  describe('Async Utilities', () => {
    describe('sleep', () => {
      beforeEach(() => {
        jest.useRealTimers();
      });

      it('should delay execution', async () => {
        const start = Date.now();
        await sleep(100);
        const end = Date.now();
        expect(end - start).toBeGreaterThanOrEqual(90); // Allow for slight timing variance
      });

      it('should handle zero delay', async () => {
        const start = Date.now();
        await sleep(0);
        const end = Date.now();
        expect(end - start).toBeLessThan(50);
      });
    });
  });

  // Integration and Edge Case Tests
  describe('Integration and Edge Cases', () => {
    it('should handle complex data processing pipeline', () => {
      const rawData = [
        { name: '  JOHN DOE  ', email: 'john@EXAMPLE.com', age: '30', salary: '50000.50' },
        { name: 'jane smith', email: 'jane@example.com', age: '25', salary: '45000' },
        { name: 'Bob Johnson', email: 'invalid-email', age: '35', salary: '60000.75' }
      ];

      const processedData = rawData
        .filter(person => isValidEmail(person.email.toLowerCase()))
        .map(person => ({
          id: generateId(8),
          name: capitalize(person.name.trim()),
          email: person.email.toLowerCase(),
          age: parseInt(person.age),
          formattedSalary: formatCurrency(parseFloat(person.salary))
        }))
        .sort((a, b) => a.age - b.age);

      expect(processedData).toHaveLength(2);
      expect(processedData[0].name).toBe('Jane smith');
      expect(processedData[1].name).toBe('John doe');
      expect(processedData[0].formattedSalary).toContain('$45,000');
    });

    it('should handle error recovery in utility chains', () => {
      const problematicData = {
        date: 'invalid-date',
        email: 'not-an-email',
        amount: 'not-a-number',
        json: '{ invalid json }'
      };

      const results = {
        isValidDate: isValidDate(new Date(problematicData.date)),
        isValidEmail: isValidEmail(problematicData.email),
        parsedJSON: parseJSON(problematicData.json, { error: true }),
        sanitizedInput: sanitizeInput('<script>alert("xss")</script>Safe content')
      };

      expect(results.isValidDate).toBe(false);
      expect(results.isValidEmail).toBe(false);
      expect(results.parsedJSON).toEqual({ error: true });
      expect(results.sanitizedInput).toContain('Safe content');
      expect(results.sanitizedInput).not.toContain('<script>');
    });

    it('should handle performance with large datasets', () => {
      const largeDataset = Array.from({ length: 1000 }, (_, i) => ({
        id: i,
        value: `item-${i}`,
        category: i % 5,
        active: i % 2 === 0
      }));

      const startTime = performance.now();
      
      const processed = largeDataset
        .filter(item => item.active)
        .map(item => ({ ...item, slug: generateSlug(item.value) }))
        .reduce((groups, item) => {
          if (!groups[item.category]) groups[item.category] = [];
          groups[item.category].push(item);
          return groups;
        }, {} as any);

      const endTime = performance.now();

      expect(Object.keys(processed)).toHaveLength(5);
      expect(processed[0]).toBeDefined();
      expect(endTime - startTime).toBeLessThan(1000); // Should complete within 1 second
    });

    it('should maintain type safety and handle edge cases', () => {
      const edgeCases = {
        emptyString: '',
        nullValue: null,
        undefinedValue: undefined,
        zeroNumber: 0,
        emptyArray: [],
        emptyObject: {},
        infiniteNumber: Infinity,
        nanValue: NaN
      };

      // Test utilities handle edge cases gracefully
      expect(isValidEmail(edgeCases.emptyString)).toBe(false);
      expect(sanitizeInput(edgeCases.nullValue as any)).toBe('');
      expect(isEmptyObject(edgeCases.emptyObject)).toBe(true);
      expect(isEmptyObject(edgeCases.emptyArray)).toBe(true);
      expect(unique(edgeCases.emptyArray)).toEqual([]);
      expect(flatten(edgeCases.emptyArray)).toEqual([]);
      expect(deepClone(edgeCases.zeroNumber)).toBe(0);
      expect(() => formatCurrency(edgeCases.nanValue)).toThrow();
    });
  });

  // Performance and Memory Tests
  describe('Performance and Memory Management', () => {
    it('should handle memory efficiently with large cloning operations', () => {
      const createLargeObject = () => ({
        data: Array.from({ length: 1000 }, (_, i) => ({ id: i, value: `item-${i}` })),
        metadata: {
          created: new Date(),
          version: '1.0.0',
          tags: ['test', 'performance', 'memory']
        }
      });

      const original = createLargeObject();
      const cloned = deepClone(original);

      expect(cloned).toEqual(original);
      expect(cloned).not.toBe(original);
      expect(cloned.data).not.toBe(original.data);
      expect(cloned.metadata).not.toBe(original.metadata);
    });

    it('should optimize memoization for expensive operations', () => {
      let callCount = 0;
      const expensiveOperation = (n: number): number => {
        callCount++;
        // Simulate expensive computation
        let result = 0;
        for (let i = 0; i < n; i++) {
          result += Math.sqrt(i);
        }
        return result;
      };

      const memoizedOperation = memoize(expensiveOperation);

      // First calls should execute the function
      memoizedOperation(100);
      memoizedOperation(200);
      expect(callCount).toBe(2);

      // Repeated calls should use cache
      memoizedOperation(100);
      memoizedOperation(200);
      expect(callCount).toBe(2);

      // New input should execute function
      memoizedOperation(300);
      expect(callCount).toBe(3);
    });
  });
});