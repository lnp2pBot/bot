import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import {
  isValidEmail,
  formatCurrency,
  debounce,
  throttle,
  deepClone,
  generateId,
  capitalizeFirstLetter,
  camelToSnakeCase,
  snakeToCamelCase,
  truncateString,
  slugify,
  sanitizeString,
  chunk,
  unique,
  flatten,
  groupBy,
  sortBy,
  isEmptyObject,
  arrayToObject,
  isDefined,
  isUndefined,
  isNull,
  isEmpty,
  isString,
  isNumber,
  isBoolean,
  isArray,
  isObject,
  isFunction,
  parseQueryParams,
  formatDate,
  calculateAge,
  formatFileSize,
  getFileExtension,
  randomBetween,
  validateRequired,
  sleep,
  retry,
  memoize,
  compose,
  pipe,
  curry
} from './index';

describe('Utility Functions', () => {
  // Email validation tests
  describe('isValidEmail', () => {
    it('should return true for valid email addresses', () => {
      expect(isValidEmail('test@example.com')).toBe(true);
      expect(isValidEmail('user.name@domain.co.uk')).toBe(true);
      expect(isValidEmail('user+tag@example.org')).toBe(true);
      expect(isValidEmail('123@example.com')).toBe(true);
      expect(isValidEmail('user_name@example-domain.com')).toBe(true);
    });

    it('should return false for invalid email addresses', () => {
      expect(isValidEmail('invalid-email')).toBe(false);
      expect(isValidEmail('test@')).toBe(false);
      expect(isValidEmail('@example.com')).toBe(false);
      expect(isValidEmail('test..test@example.com')).toBe(false);
      expect(isValidEmail('')).toBe(false);
      expect(isValidEmail('test @example.com')).toBe(false);
      expect(isValidEmail('test@example')).toBe(false);
    });

    it('should handle edge cases and invalid inputs', () => {
      expect(isValidEmail(null as any)).toBe(false);
      expect(isValidEmail(undefined as any)).toBe(false);
      expect(isValidEmail(123 as any)).toBe(false);
      expect(isValidEmail({} as any)).toBe(false);
      expect(isValidEmail([] as any)).toBe(false);
    });
  });

  // Currency formatting tests
  describe('formatCurrency', () => {
    it('should format currency with default USD settings', () => {
      expect(formatCurrency(1234.56)).toBe('$1,234.56');
      expect(formatCurrency(0)).toBe('$0.00');
      expect(formatCurrency(1000000)).toBe('$1,000,000.00');
      expect(formatCurrency(0.99)).toBe('$0.99');
    });

    it('should format currency with different locales and currencies', () => {
      expect(formatCurrency(1234.56, 'EUR', 'de-DE')).toBe('1.234,56 €');
      expect(formatCurrency(1234.56, 'GBP', 'en-GB')).toBe('£1,234.56');
      expect(formatCurrency(1234.56, 'JPY', 'ja-JP')).toBe('¥1,235');
    });

    it('should handle negative amounts', () => {
      expect(formatCurrency(-1234.56)).toBe('-$1,234.56');
      expect(formatCurrency(-0.01)).toBe('-$0.01');
    });

    it('should handle edge cases and invalid numbers', () => {
      expect(formatCurrency(NaN)).toBe('$0.00');
      expect(formatCurrency(Infinity)).toBe('$0.00');
      expect(formatCurrency(-Infinity)).toBe('$0.00');
    });

    it('should handle very large and very small numbers', () => {
      expect(formatCurrency(999999999999.99)).toBe('$999,999,999,999.99');
      expect(formatCurrency(0.001)).toBe('$0.00');
    });
  });

  // Debounce tests
  describe('debounce', () => {
    beforeEach(() => {
      vi.useFakeTimers();
    });

    afterEach(() => {
      vi.runOnlyPendingTimers();
      vi.useRealTimers();
    });

    it('should debounce function calls', () => {
      const mockFn = vi.fn();
      const debouncedFn = debounce(mockFn, 100);

      debouncedFn();
      debouncedFn();
      debouncedFn();

      expect(mockFn).not.toHaveBeenCalled();

      vi.advanceTimersByTime(100);
      expect(mockFn).toHaveBeenCalledTimes(1);
    });

    it('should pass arguments to debounced function', () => {
      const mockFn = vi.fn();
      const debouncedFn = debounce(mockFn, 100);

      debouncedFn('arg1', 'arg2');
      vi.advanceTimersByTime(100);

      expect(mockFn).toHaveBeenCalledWith('arg1', 'arg2');
    });

    it('should handle immediate execution', () => {
      const mockFn = vi.fn();
      const debouncedFn = debounce(mockFn, 100, true);

      debouncedFn();
      expect(mockFn).toHaveBeenCalledTimes(1);

      debouncedFn();
      expect(mockFn).toHaveBeenCalledTimes(1);
    });

    it('should reset timer on subsequent calls', () => {
      const mockFn = vi.fn();
      const debouncedFn = debounce(mockFn, 100);

      debouncedFn();
      vi.advanceTimersByTime(50);
      debouncedFn();
      vi.advanceTimersByTime(50);
      expect(mockFn).not.toHaveBeenCalled();

      vi.advanceTimersByTime(50);
      expect(mockFn).toHaveBeenCalledTimes(1);
    });
  });

  // Throttle tests
  describe('throttle', () => {
    beforeEach(() => {
      vi.useFakeTimers();
    });

    afterEach(() => {
      vi.runOnlyPendingTimers();
      vi.useRealTimers();
    });

    it('should throttle function calls', () => {
      const mockFn = vi.fn();
      const throttledFn = throttle(mockFn, 100);

      throttledFn();
      throttledFn();
      throttledFn();

      expect(mockFn).toHaveBeenCalledTimes(1);

      vi.advanceTimersByTime(100);
      throttledFn();
      expect(mockFn).toHaveBeenCalledTimes(2);
    });

    it('should pass arguments to throttled function', () => {
      const mockFn = vi.fn();
      const throttledFn = throttle(mockFn, 100);

      throttledFn('arg1', 'arg2');
      expect(mockFn).toHaveBeenCalledWith('arg1', 'arg2');
    });

    it('should not call function again until throttle period expires', () => {
      const mockFn = vi.fn();
      const throttledFn = throttle(mockFn, 100);

      throttledFn();
      vi.advanceTimersByTime(50);
      throttledFn();
      expect(mockFn).toHaveBeenCalledTimes(1);

      vi.advanceTimersByTime(50);
      throttledFn();
      expect(mockFn).toHaveBeenCalledTimes(2);
    });
  });

  // Deep clone tests
  describe('deepClone', () => {
    it('should clone primitive values', () => {
      expect(deepClone(42)).toBe(42);
      expect(deepClone('hello')).toBe('hello');
      expect(deepClone(true)).toBe(true);
      expect(deepClone(null)).toBe(null);
      expect(deepClone(undefined)).toBe(undefined);
    });

    it('should clone arrays', () => {
      const original = [1, 2, [3, 4]];
      const cloned = deepClone(original);
      
      expect(cloned).toEqual(original);
      expect(cloned).not.toBe(original);
      expect(cloned[2]).not.toBe(original[2]);
    });

    it('should clone objects', () => {
      const original = { a: 1, b: { c: 2 } };
      const cloned = deepClone(original);
      
      expect(cloned).toEqual(original);
      expect(cloned).not.toBe(original);
      expect(cloned.b).not.toBe(original.b);
    });

    it('should clone dates', () => {
      const original = new Date('2023-01-01');
      const cloned = deepClone(original);
      
      expect(cloned).toEqual(original);
      expect(cloned).not.toBe(original);
      expect(cloned instanceof Date).toBe(true);
    });

    it('should handle complex nested structures', () => {
      const original = {
        arr: [1, { nested: true }],
        obj: { deep: { value: 'test' } },
        date: new Date('2023-01-01'),
        num: 42
      };
      
      const cloned = deepClone(original);
      
      expect(cloned).toEqual(original);
      expect(cloned.arr).not.toBe(original.arr);
      expect(cloned.obj.deep).not.toBe(original.obj.deep);
      expect(cloned.date).not.toBe(original.date);
    });

    it('should handle empty objects and arrays', () => {
      expect(deepClone({})).toEqual({});
      expect(deepClone([])).toEqual([]);
    });
  });

  // ID generation tests
  describe('generateId', () => {
    it('should generate unique IDs', () => {
      const id1 = generateId();
      const id2 = generateId();
      expect(id1).not.toBe(id2);
      expect(typeof id1).toBe('string');
      expect(id1.length).toBeGreaterThan(0);
    });

    it('should generate IDs with specified length', () => {
      expect(generateId(20).length).toBe(20);
      expect(generateId(1).length).toBe(1);
      expect(generateId(50).length).toBe(50);
    });

    it('should generate IDs with default length', () => {
      expect(generateId().length).toBe(8);
    });

    it('should generate alphanumeric IDs', () => {
      const id = generateId();
      expect(id).toMatch(/^[a-zA-Z0-9]+$/);
    });

    it('should handle edge cases', () => {
      expect(generateId(0).length).toBe(0);
      expect(generateId(-1).length).toBe(0);
    });
  });

  // String manipulation tests
  describe('String Utilities', () => {
    describe('capitalizeFirstLetter', () => {
      it('should capitalize first letter of lowercase strings', () => {
        expect(capitalizeFirstLetter('hello')).toBe('Hello');
        expect(capitalizeFirstLetter('world')).toBe('World');
        expect(capitalizeFirstLetter('a')).toBe('A');
      });

      it('should handle already capitalized strings', () => {
        expect(capitalizeFirstLetter('HELLO')).toBe('HELLO');
        expect(capitalizeFirstLetter('Hello')).toBe('Hello');
      });

      it('should handle edge cases', () => {
        expect(capitalizeFirstLetter('')).toBe('');
        expect(capitalizeFirstLetter(' hello')).toBe(' hello');
        expect(capitalizeFirstLetter('123')).toBe('123');
      });
    });

    describe('camelToSnakeCase', () => {
      it('should convert camelCase to snake_case', () => {
        expect(camelToSnakeCase('camelCase')).toBe('camel_case');
        expect(camelToSnakeCase('someVeryLongVariableName')).toBe('some_very_long_variable_name');
        expect(camelToSnakeCase('XMLHttpRequest')).toBe('_x_m_l_http_request');
      });

      it('should handle edge cases', () => {
        expect(camelToSnakeCase('simple')).toBe('simple');
        expect(camelToSnakeCase('')).toBe('');
        expect(camelToSnakeCase('A')).toBe('_a');
      });
    });

    describe('snakeToCamelCase', () => {
      it('should convert snake_case to camelCase', () => {
        expect(snakeToCamelCase('snake_case')).toBe('snakeCase');
        expect(snakeToCamelCase('some_very_long_variable_name')).toBe('someVeryLongVariableName');
        expect(snakeToCamelCase('api_response_data')).toBe('apiResponseData');
      });

      it('should handle edge cases', () => {
        expect(snakeToCamelCase('simple')).toBe('simple');
        expect(snakeToCamelCase('')).toBe('');
        expect(snakeToCamelCase('_leading')).toBe('Leading');
        expect(snakeToCamelCase('trailing_')).toBe('trailing');
      });
    });

    describe('truncateString', () => {
      it('should truncate long strings with default ellipsis', () => {
        expect(truncateString('This is a long string', 10)).toBe('This is a...');
        expect(truncateString('Hello world', 5)).toBe('He...');
      });

      it('should not truncate short strings', () => {
        expect(truncateString('Short', 10)).toBe('Short');
        expect(truncateString('Exact length', 12)).toBe('Exact length');
      });

      it('should handle custom ellipsis', () => {
        expect(truncateString('Long string', 5, '***')).toBe('Lo***');
        expect(truncateString('Test', 2, '...')).toBe('...');
      });

      it('should handle edge cases', () => {
        expect(truncateString('', 5)).toBe('');
        expect(truncateString('test', 0)).toBe('...');
        expect(truncateString('test', -1)).toBe('...');
      });
    });

    describe('slugify', () => {
      it('should create URL-friendly slugs', () => {
        expect(slugify('Hello World')).toBe('hello-world');
        expect(slugify('This is a Test!')).toBe('this-is-a-test');
        expect(slugify('Special @#$% Characters')).toBe('special-characters');
      });

      it('should handle multiple spaces and special characters', () => {
        expect(slugify('  Multiple   Spaces  ')).toBe('multiple-spaces');
        expect(slugify('Under_scores and-dashes')).toBe('under_scores-and-dashes');
        expect(slugify('Mixed___---___spaces')).toBe('mixed-spaces');
      });

      it('should handle edge cases', () => {
        expect(slugify('')).toBe('');
        expect(slugify('   ')).toBe('');
        expect(slugify('123')).toBe('123');
        expect(slugify('---')).toBe('');
      });
    });

    describe('sanitizeString', () => {
      it('should remove HTML tags', () => {
        expect(sanitizeString('<script>alert("xss")</script>')).toBe('alert("xss")');
        expect(sanitizeString('<p>Hello <strong>World</strong></p>')).toBe('Hello World');
        expect(sanitizeString('<div><span>Nested</span> tags</div>')).toBe('Nested tags');
      });

      it('should handle self-closing tags', () => {
        expect(sanitizeString('Text <br/> with <img src="test"/> tags')).toBe('Text  with  tags');
      });

      it('should handle strings without tags', () => {
        expect(sanitizeString('No tags here')).toBe('No tags here');
        expect(sanitizeString('')).toBe('');
      });

      it('should handle malformed tags', () => {
        expect(sanitizeString('Broken < tag > here')).toBe('Broken  here');
        expect(sanitizeString('<unclosed tag')).toBe('<unclosed tag');
      });
    });
  });

  // Array utilities tests
  describe('Array Utilities', () => {
    describe('chunk', () => {
      it('should split array into chunks of specified size', () => {
        expect(chunk([1, 2, 3, 4, 5], 2)).toEqual([[1, 2], [3, 4], [5]]);
        expect(chunk([1, 2, 3, 4], 2)).toEqual([[1, 2], [3, 4]]);
        expect(chunk([1, 2, 3, 4, 5, 6], 3)).toEqual([[1, 2, 3], [4, 5, 6]]);
      });

      it('should handle edge cases', () => {
        expect(chunk([], 2)).toEqual([]);
        expect(chunk([1, 2, 3], 5)).toEqual([[1, 2, 3]]);
        expect(chunk([1], 1)).toEqual([[1]]);
      });

      it('should handle invalid chunk sizes', () => {
        expect(chunk([1, 2, 3], 0)).toEqual([]);
        expect(chunk([1, 2, 3], -1)).toEqual([]);
      });
    });

    describe('unique', () => {
      it('should return unique values from number arrays', () => {
        expect(unique([1, 2, 2, 3, 3, 3])).toEqual([1, 2, 3]);
        expect(unique([1, 1, 1])).toEqual([1]);
      });

      it('should return unique values from string arrays', () => {
        expect(unique(['a', 'b', 'a', 'c'])).toEqual(['a', 'b', 'c']);
        expect(unique(['hello', 'world', 'hello'])).toEqual(['hello', 'world']);
      });

      it('should handle mixed type arrays', () => {
        expect(unique([1, '1', 2, '2', 1])).toEqual([1, '1', 2, '2']);
      });

      it('should handle edge cases', () => {
        expect(unique([])).toEqual([]);
        expect(unique([null, undefined, null])).toEqual([null, undefined]);
      });
    });

    describe('flatten', () => {
      it('should flatten nested arrays', () => {
        expect(flatten([1, [2, 3], [4, [5, 6]]])).toEqual([1, 2, 3, 4, 5, 6]);
        expect(flatten([[1, 2], [3, 4]])).toEqual([1, 2, 3, 4]);
      });

      it('should handle deeply nested arrays', () => {
        expect(flatten([1, [2, [3, [4, [5]]]]])).toEqual([1, 2, 3, 4, 5]);
      });

      it('should handle edge cases', () => {
        expect(flatten([])).toEqual([]);
        expect(flatten([1, 2, 3])).toEqual([1, 2, 3]);
        expect(flatten([[]])).toEqual([]);
      });
    });

    describe('groupBy', () => {
      it('should group array items by key', () => {
        const items = [
          { type: 'fruit', name: 'apple' },
          { type: 'fruit', name: 'banana' },
          { type: 'vegetable', name: 'carrot' }
        ];
        
        const grouped = groupBy(items, 'type');
        expect(grouped.fruit).toHaveLength(2);
        expect(grouped.vegetable).toHaveLength(1);
        expect(grouped.fruit[0].name).toBe('apple');
      });

      it('should handle numeric grouping keys', () => {
        const items = [
          { category: 1, value: 'a' },
          { category: 2, value: 'b' },
          { category: 1, value: 'c' }
        ];
        
        const grouped = groupBy(items, 'category');
        expect(grouped['1']).toHaveLength(2);
        expect(grouped['2']).toHaveLength(1);
      });

      it('should handle empty arrays', () => {
        expect(groupBy([], 'key')).toEqual({});
      });
    });

    describe('sortBy', () => {
      it('should sort array by property', () => {
        const items = [
          { name: 'Charlie', age: 30 },
          { name: 'Alice', age: 25 },
          { name: 'Bob', age: 35 }
        ];
        
        const sorted = sortBy(items, 'age');
        expect(sorted[0].name).toBe('Alice');
        expect(sorted[1].name).toBe('Charlie');
        expect(sorted[2].name).toBe('Bob');
      });

      it('should sort by string properties', () => {
        const items = [
          { name: 'Charlie' },
          { name: 'Alice' },
          { name: 'Bob' }
        ];
        
        const sorted = sortBy(items, 'name');
        expect(sorted[0].name).toBe('Alice');
        expect(sorted[1].name).toBe('Bob');
        expect(sorted[2].name).toBe('Charlie');
      });

      it('should not mutate original array', () => {
        const original = [{ value: 3 }, { value: 1 }, { value: 2 }];
        const sorted = sortBy(original, 'value');
        
        expect(original[0].value).toBe(3);
        expect(sorted[0].value).toBe(1);
      });

      it('should handle empty arrays', () => {
        expect(sortBy([], 'key')).toEqual([]);
      });
    });
  });

  // Object utilities tests
  describe('Object Utilities', () => {
    describe('isEmptyObject', () => {
      it('should detect empty objects', () => {
        expect(isEmptyObject({})).toBe(true);
        expect(isEmptyObject(Object.create(null))).toBe(true);
      });

      it('should detect non-empty objects', () => {
        expect(isEmptyObject({ a: 1 })).toBe(false);
        expect(isEmptyObject({ prop: undefined })).toBe(false);
      });

      it('should handle null and undefined', () => {
        expect(isEmptyObject(null)).toBe(true);
        expect(isEmptyObject(undefined)).toBe(true);
      });

      it('should handle arrays and other types', () => {
        expect(isEmptyObject([])).toBe(true);
        expect(isEmptyObject([1, 2, 3])).toBe(false);
        expect(isEmptyObject('')).toBe(true);
        expect(isEmptyObject(0)).toBe(true);
      });
    });

    describe('arrayToObject', () => {
      it('should convert array to object using key', () => {
        const items = [
          { id: 1, name: 'Alice' },
          { id: 2, name: 'Bob' }
        ];
        
        const obj = arrayToObject(items, 'id');
        expect(obj['1'].name).toBe('Alice');
        expect(obj['2'].name).toBe('Bob');
      });

      it('should handle string keys', () => {
        const items = [
          { code: 'US', country: 'United States' },
          { code: 'CA', country: 'Canada' }
        ];
        
        const obj = arrayToObject(items, 'code');
        expect(obj.US.country).toBe('United States');
        expect(obj.CA.country).toBe('Canada');
      });

      it('should handle empty arrays', () => {
        expect(arrayToObject([], 'key')).toEqual({});
      });

      it('should handle duplicate keys (last one wins)', () => {
        const items = [
          { id: 1, name: 'First' },
          { id: 1, name: 'Second' }
        ];
        
        const obj = arrayToObject(items, 'id');
        expect(obj['1'].name).toBe('Second');
      });
    });
  });

  // Type checking tests
  describe('Type Checking Utilities', () => {
    describe('isDefined', () => {
      it('should return true for defined values', () => {
        expect(isDefined(0)).toBe(true);
        expect(isDefined('')).toBe(true);
        expect(isDefined(false)).toBe(true);
        expect(isDefined(null)).toBe(true);
        expect(isDefined({})).toBe(true);
        expect(isDefined([])).toBe(true);
      });

      it('should return false for undefined', () => {
        expect(isDefined(undefined)).toBe(false);
      });
    });

    describe('isUndefined', () => {
      it('should return true only for undefined', () => {
        expect(isUndefined(undefined)).toBe(true);
      });

      it('should return false for defined values', () => {
        expect(isUndefined(null)).toBe(false);
        expect(isUndefined(0)).toBe(false);
        expect(isUndefined('')).toBe(false);
        expect(isUndefined(false)).toBe(false);
      });
    });

    describe('isNull', () => {
      it('should return true only for null', () => {
        expect(isNull(null)).toBe(true);
      });

      it('should return false for other values', () => {
        expect(isNull(undefined)).toBe(false);
        expect(isNull(0)).toBe(false);
        expect(isNull('')).toBe(false);
        expect(isNull(false)).toBe(false);
      });
    });

    describe('isEmpty', () => {
      it('should return true for empty values', () => {
        expect(isEmpty(null)).toBe(true);
        expect(isEmpty(undefined)).toBe(true);
        expect(isEmpty('')).toBe(true);
      });

      it('should return false for non-empty values', () => {
        expect(isEmpty(0)).toBe(false);
        expect(isEmpty(false)).toBe(false);
        expect(isEmpty('test')).toBe(false);
        expect(isEmpty([])).toBe(false);
        expect(isEmpty({})).toBe(false);
      });
    });

    describe('isString', () => {
      it('should return true for strings', () => {
        expect(isString('hello')).toBe(true);
        expect(isString('')).toBe(true);
        expect(isString(String(123))).toBe(true);
      });

      it('should return false for non-strings', () => {
        expect(isString(123)).toBe(false);
        expect(isString(null)).toBe(false);
        expect(isString(undefined)).toBe(false);
        expect(isString({})).toBe(false);
        expect(isString([])).toBe(false);
      });
    });

    describe('isNumber', () => {
      it('should return true for valid numbers', () => {
        expect(isNumber(123)).toBe(true);
        expect(isNumber(0)).toBe(true);
        expect(isNumber(-42)).toBe(true);
        expect(isNumber(3.14)).toBe(true);
      });

      it('should return false for invalid numbers and non-numbers', () => {
        expect(isNumber(NaN)).toBe(false);
        expect(isNumber('123')).toBe(false);
        expect(isNumber(null)).toBe(false);
        expect(isNumber(undefined)).toBe(false);
        expect(isNumber(Infinity)).toBe(false);
        expect(isNumber(-Infinity)).toBe(false);
      });
    });

    describe('isBoolean', () => {
      it('should return true for booleans', () => {
        expect(isBoolean(true)).toBe(true);
        expect(isBoolean(false)).toBe(true);
      });

      it('should return false for non-booleans', () => {
        expect(isBoolean(1)).toBe(false);
        expect(isBoolean(0)).toBe(false);
        expect(isBoolean('true')).toBe(false);
        expect(isBoolean(null)).toBe(false);
        expect(isBoolean(undefined)).toBe(false);
      });
    });

    describe('isArray', () => {
      it('should return true for arrays', () => {
        expect(isArray([])).toBe(true);
        expect(isArray([1, 2, 3])).toBe(true);
        expect(isArray(new Array())).toBe(true);
      });

      it('should return false for non-arrays', () => {
        expect(isArray({})).toBe(false);
        expect(isArray('array')).toBe(false);
        expect(isArray(null)).toBe(false);
        expect(isArray(undefined)).toBe(false);
      });
    });

    describe('isObject', () => {
      it('should return true for objects', () => {
        expect(isObject({})).toBe(true);
        expect(isObject({ key: 'value' })).toBe(true);
        expect(isObject(new Date())).toBe(true);
      });

      it('should return false for non-objects', () => {
        expect(isObject(null)).toBe(false);
        expect(isObject([])).toBe(false);
        expect(isObject('string')).toBe(false);
        expect(isObject(123)).toBe(false);
        expect(isObject(undefined)).toBe(false);
      });
    });

    describe('isFunction', () => {
      it('should return true for functions', () => {
        expect(isFunction(() => {})).toBe(true);
        expect(isFunction(function() {})).toBe(true);
        expect(isFunction(Date)).toBe(true);
        expect(isFunction(Array.isArray)).toBe(true);
      });

      it('should return false for non-functions', () => {
        expect(isFunction({})).toBe(false);
        expect(isFunction([])).toBe(false);
        expect(isFunction('function')).toBe(false);
        expect(isFunction(null)).toBe(false);
        expect(isFunction(undefined)).toBe(false);
      });
    });
  });

  // URL utilities tests
  describe('URL Utilities', () => {
    describe('parseQueryParams', () => {
      it('should parse query parameters correctly', () => {
        const params = parseQueryParams('?name=John&age=30&city=NYC');
        expect(params.name).toBe('John');
        expect(params.age).toBe('30');
        expect(params.city).toBe('NYC');
      });

      it('should handle query strings without leading question mark', () => {
        const params = parseQueryParams('name=John&age=30');
        expect(params.name).toBe('John');
        expect(params.age).toBe('30');
      });

      it('should handle empty values', () => {
        const params = parseQueryParams('name=&age=30&empty');
        expect(params.name).toBe('');
        expect(params.age).toBe('30');
        expect(params.empty).toBe('');
      });

      it('should handle URL-encoded values', () => {
        const params = parseQueryParams('name=John%20Doe&message=Hello%20World');
        expect(params.name).toBe('John Doe');
        expect(params.message).toBe('Hello World');
      });

      it('should handle edge cases', () => {
        expect(parseQueryParams('')).toEqual({});
        expect(parseQueryParams('?')).toEqual({});
        expect(parseQueryParams('=')).toEqual({ '': '' });
      });

      it('should handle duplicate parameters (last one wins)', () => {
        const params = parseQueryParams('name=John&name=Jane');
        expect(params.name).toBe('Jane');
      });
    });
  });

  // Date utilities tests
  describe('Date Utilities', () => {
    describe('formatDate', () => {
      it('should format dates with YYYY-MM-DD pattern', () => {
        const date = new Date('2023-01-15T10:30:00Z');
        expect(formatDate(date, 'YYYY-MM-DD')).toBe('2023-01-15');
      });

      it('should format dates with MM/DD/YYYY pattern', () => {
        const date = new Date('2023-01-15T10:30:00Z');
        expect(formatDate(date, 'MM/DD/YYYY')).toBe('01/15/2023');
      });

      it('should handle different date formats', () => {
        const date = new Date('2023-12-25T10:30:00Z');
        expect(formatDate(date, 'DD-MM-YYYY')).toBe('25-12-2023');
        expect(formatDate(date, 'YYYY/MM/DD')).toBe('2023/12/25');
      });

      it('should pad single digits with zeros', () => {
        const date = new Date('2023-01-05T10:30:00Z');
        expect(formatDate(date, 'MM/DD/YYYY')).toBe('01/05/2023');
      });
    });

    describe('calculateAge', () => {
      it('should calculate age correctly', () => {
        const birthDate = new Date('1990-01-01');
        const currentDate = new Date('2023-01-01');
        expect(calculateAge(birthDate, currentDate)).toBe(33);
      });

      it('should handle birthday not yet occurred this year', () => {
        const birthDate = new Date('1990-06-15');
        const currentDate = new Date('2023-03-01');
        expect(calculateAge(birthDate, currentDate)).toBe(32);
      });

      it('should handle birthday already occurred this year', () => {
        const birthDate = new Date('1990-06-15');
        const currentDate = new Date('2023-12-01');
        expect(calculateAge(birthDate, currentDate)).toBe(33);
      });

      it('should handle same birth date and current date', () => {
        const date = new Date('1990-01-01');
        expect(calculateAge(date, date)).toBe(0);
      });

      it('should use current date when not provided', () => {
        const birthDate = new Date(Date.now() - 365 * 24 * 60 * 60 * 1000); // 1 year ago
        const age = calculateAge(birthDate);
        expect(age).toBeGreaterThanOrEqual(0);
        expect(age).toBeLessThanOrEqual(1);
      });
    });
  });

  // File utilities tests
  describe('File Utilities', () => {
    describe('formatFileSize', () => {
      it('should format bytes correctly', () => {
        expect(formatFileSize(0)).toBe('0 B');
        expect(formatFileSize(512)).toBe('512 B');
        expect(formatFileSize(1023)).toBe('1023 B');
      });

      it('should format kilobytes correctly', () => {
        expect(formatFileSize(1024)).toBe('1.0 KB');
        expect(formatFileSize(1536)).toBe('1.5 KB');
        expect(formatFileSize(2048)).toBe('2.0 KB');
      });

      it('should format megabytes correctly', () => {
        expect(formatFileSize(1048576)).toBe('1.0 MB');
        expect(formatFileSize(1572864)).toBe('1.5 MB');
      });

      it('should format gigabytes correctly', () => {
        expect(formatFileSize(1073741824)).toBe('1.0 GB');
        expect(formatFileSize(2147483648)).toBe('2.0 GB');
      });

      it('should format terabytes correctly', () => {
        expect(formatFileSize(1099511627776)).toBe('1.0 TB');
      });

      it('should handle very large numbers', () => {
        const result = formatFileSize(1125899906842624); // 1 PB
        expect(result).toMatch(/^\d+(\.\d+)? TB$/);
      });
    });

    describe('getFileExtension', () => {
      it('should extract common file extensions', () => {
        expect(getFileExtension('file.txt')).toBe('txt');
        expect(getFileExtension('image.png')).toBe('png');
        expect(getFileExtension('document.pdf')).toBe('pdf');
        expect(getFileExtension('script.js')).toBe('js');
      });

      it('should handle files with multiple dots', () => {
        expect(getFileExtension('file.min.js')).toBe('js');
        expect(getFileExtension('backup.tar.gz')).toBe('gz');
        expect(getFileExtension('config.json.bak')).toBe('bak');
      });

      it('should handle edge cases', () => {
        expect(getFileExtension('file')).toBe('');
        expect(getFileExtension('file.')).toBe('');
        expect(getFileExtension('.hidden')).toBe('hidden');
        expect(getFileExtension('.hidden.')).toBe('');
        expect(getFileExtension('')).toBe('');
      });

      it('should handle paths', () => {
        expect(getFileExtension('/path/to/file.txt')).toBe('txt');
        expect(getFileExtension('C:\\Users\\file.doc')).toBe('doc');
      });
    });
  });

  // Math utilities tests
  describe('Math Utilities', () => {
    describe('randomBetween', () => {
      it('should generate numbers within specified range', () => {
        for (let i = 0; i < 100; i++) {
          const random = randomBetween(1, 10);
          expect(random).toBeGreaterThanOrEqual(1);
          expect(random).toBeLessThanOrEqual(10);
          expect(Number.isInteger(random)).toBe(true);
        }
      });

      it('should handle single value range', () => {
        expect(randomBetween(5, 5)).toBe(5);
      });

      it('should handle negative ranges', () => {
        for (let i = 0; i < 10; i++) {
          const random = randomBetween(-10, -1);
          expect(random).toBeGreaterThanOrEqual(-10);
          expect(random).toBeLessThanOrEqual(-1);
        }
      });

      it('should handle zero in range', () => {
        for (let i = 0; i < 10; i++) {
          const random = randomBetween(-2, 2);
          expect(random).toBeGreaterThanOrEqual(-2);
          expect(random).toBeLessThanOrEqual(2);
        }
      });
    });
  });

  // Validation tests
  describe('Validation Utilities', () => {
    describe('validateRequired', () => {
      it('should return true when all required fields are present', () => {
        const data = { name: 'John', email: 'john@example.com', age: 30 };
        expect(validateRequired(data, ['name', 'email'])).toBe(true);
        expect(validateRequired(data, ['name', 'email', 'age'])).toBe(true);
      });

      it('should return false when required fields are missing', () => {
        const data = { name: 'John', email: 'john@example.com' };
        expect(validateRequired(data, ['name', 'phone'])).toBe(false);
        expect(validateRequired(data, ['address'])).toBe(false);
      });

      it('should return false for null or empty string values', () => {
        const data = { name: '', email: null, age: 0 };
        expect(validateRequired(data, ['name'])).toBe(false);
        expect(validateRequired(data, ['email'])).toBe(false);
        expect(validateRequired(data, ['age'])).toBe(true); // 0 is valid
      });

      it('should return false for undefined values', () => {
        const data = { name: 'John', email: undefined };
        expect(validateRequired(data, ['email'])).toBe(false);
      });

      it('should handle empty required fields array', () => {
        const data = { name: 'John' };
        expect(validateRequired(data, [])).toBe(true);
      });

      it('should handle valid falsy values', () => {
        const data = { count: 0, active: false };
        expect(validateRequired(data, ['count', 'active'])).toBe(true);
      });
    });
  });

  // Async utilities tests
  describe('Async Utilities', () => {
    describe('sleep', () => {
      it('should delay execution for specified milliseconds', async () => {
        const start = Date.now();
        await sleep(50);
        const end = Date.now();
        expect(end - start).toBeGreaterThanOrEqual(45); // Allow some variance
      });

      it('should handle zero delay', async () => {
        const start = Date.now();
        await sleep(0);
        const end = Date.now();
        expect(end - start).toBeLessThan(10);
      });
    });

    describe('retry', () => {
      it('should succeed on first attempt', async () => {
        const successFunction = vi.fn().mockResolvedValue('success');
        const result = await retry(successFunction, 3);
        
        expect(result).toBe('success');
        expect(successFunction).toHaveBeenCalledTimes(1);
      });

      it('should retry failed operations', async () => {
        let attempts = 0;
        const failingFunction = vi.fn().mockImplementation(async () => {
          attempts++;
          if (attempts < 3) {
            throw new Error('Failed');
          }
          return 'success';
        });

        const result = await retry(failingFunction, 3, 1);
        expect(result).toBe('success');
        expect(failingFunction).toHaveBeenCalledTimes(3);
      });

      it('should throw after max retries exceeded', async () => {
        const alwaysFailingFunction = vi.fn().mockRejectedValue(new Error('Always fails'));

        await expect(retry(alwaysFailingFunction, 2, 1)).rejects.toThrow('Always fails');
        expect(alwaysFailingFunction).toHaveBeenCalledTimes(2);
      });

      it('should handle different error types', async () => {
        const failingFunction = vi.fn().mockRejectedValue('String error');

        await expect(retry(failingFunction, 1, 1)).rejects.toBe('String error');
      });
    });
  });

  // Functional programming tests
  describe('Functional Programming Utilities', () => {
    describe('memoize', () => {
      it('should cache function results', () => {
        const expensiveFunction = vi.fn((x: number) => x * 2);
        const memoized = memoize(expensiveFunction);
        
        expect(memoized(5)).toBe(10);
        expect(memoized(5)).toBe(10);
        expect(expensiveFunction).toHaveBeenCalledTimes(1);
      });

      it('should handle different arguments', () => {
        const addFunction = vi.fn((a: number, b: number) => a + b);
        const memoized = memoize(addFunction);
        
        expect(memoized(1, 2)).toBe(3);
        expect(memoized(2, 3)).toBe(5);
        expect(memoized(1, 2)).toBe(3); // Should use cache
        
        expect(addFunction).toHaveBeenCalledTimes(2);
      });

      it('should handle complex arguments', () => {
        const objFunction = vi.fn((obj: { a: number }) => obj.a * 2);
        const memoized = memoize(objFunction);
        
        expect(memoized({ a: 5 })).toBe(10);
        expect(memoized({ a: 5 })).toBe(10); // Should use cache
        expect(objFunction).toHaveBeenCalledTimes(1);
      });
    });

    describe('compose', () => {
      it('should compose functions right to left', () => {
        const add1 = (x: number) => x + 1;
        const multiply2 = (x: number) => x * 2;
        const composed = compose(add1, multiply2);
        
        expect(composed(3)).toBe(7); // (3 * 2) + 1
      });

      it('should handle single function', () => {
        const add1 = (x: number) => x + 1;
        const composed = compose(add1);
        
        expect(composed(5)).toBe(6);
      });

      it('should handle multiple functions', () => {
        const add1 = (x: number) => x + 1;
        const multiply2 = (x: number) => x * 2;
        const subtract3 = (x: number) => x - 3;
        const composed = compose(add1, multiply2, subtract3);
        
        expect(composed(10)).toBe(15); // ((10 - 3) * 2) + 1 = 15
      });
    });

    describe('pipe', () => {
      it('should pipe functions left to right', () => {
        const add1 = (x: number) => x + 1;
        const multiply2 = (x: number) => x * 2;
        const piped = pipe(add1, multiply2);
        
        expect(piped(3)).toBe(8); // (3 + 1) * 2
      });

      it('should handle single function', () => {
        const add1 = (x: number) => x + 1;
        const piped = pipe(add1);
        
        expect(piped(5)).toBe(6);
      });

      it('should handle multiple functions', () => {
        const add1 = (x: number) => x + 1;
        const multiply2 = (x: number) => x * 2;
        const subtract3 = (x: number) => x - 3;
        const piped = pipe(add1, multiply2, subtract3);
        
        expect(piped(10)).toBe(19); // ((10 + 1) * 2) - 3 = 19
      });
    });

    describe('curry', () => {
      it('should curry functions with multiple arguments', () => {
        const add = (a: number, b: number, c: number) => a + b + c;
        const curriedAdd = curry(add);
        
        expect(curriedAdd(1)(2)(3)).toBe(6);
        expect(curriedAdd(1, 2)(3)).toBe(6);
        expect(curriedAdd(1)(2, 3)).toBe(6);
        expect(curriedAdd(1, 2, 3)).toBe(6);
      });

      it('should handle single argument functions', () => {
        const double = (x: number) => x * 2;
        const curriedDouble = curry(double);
        
        expect(curriedDouble(5)).toBe(10);
      });

      it('should handle two argument functions', () => {
        const multiply = (a: number, b: number) => a * b;
        const curriedMultiply = curry(multiply);
        
        expect(curriedMultiply(3)(4)).toBe(12);
        expect(curriedMultiply(3, 4)).toBe(12);
      });

      it('should maintain partial application', () => {
        const add3 = (a: number, b: number, c: number) => a + b + c;
        const curriedAdd3 = curry(add3);
        const add5 = curriedAdd3(2)(3);
        
        expect(add5(1)).toBe(6);
        expect(add5(5)).toBe(10);
      });
    });
  });
});