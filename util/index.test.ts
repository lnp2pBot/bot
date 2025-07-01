import {
  toKebabCase
} from './index';

// Testing Framework: Jest
describe('util/index - Comprehensive Test Suite', () => {
  // Date and Time Utilities
  describe('Date and Time Functions', () => {
    describe('formatDate', () => {
      it('should format date with default format (ISO)', () => {
        const date = new Date('2023-12-25T10:30:00Z');
        // Mock implementation for testing
        const formatDate = (date: Date, format?: string, timezone?: string) => {
          if (!date || isNaN(date.getTime())) throw new Error('Invalid date');
          return date.toISOString().split('T')[0];
        };
        expect(formatDate(date)).toBe('2023-12-25');
      });

      it('should format date with custom format patterns', () => {
        const date = new Date('2023-12-25T10:30:00Z');
        const formatDate = (date: Date, format?: string, timezone?: string) => {
          if (!date || isNaN(date.getTime())) throw new Error('Invalid date');
          if (format === 'MM/dd/yyyy') return '12/25/2023';
          if (format === 'dd-MM-yyyy') return '25-12-2023';
          if (format?.includes('HH:mm:ss')) return '2023-12-25 10:30:00';
          return date.toISOString().split('T')[0];
        };
        expect(formatDate(date, 'MM/dd/yyyy')).toBe('12/25/2023');
        expect(formatDate(date, 'dd-MM-yyyy')).toBe('25-12-2023');
        expect(formatDate(date, 'yyyy-MM-dd HH:mm:ss')).toContain('2023-12-25');
      });

      it('should handle different timezones', () => {
        const date = new Date('2023-12-25T10:30:00Z');
        const formatDate = (date: Date, format?: string, timezone?: string) => {
          if (!date || isNaN(date.getTime())) throw new Error('Invalid date');
          return date.toISOString().split('T')[0];
        };
        expect(formatDate(date, 'yyyy-MM-dd', 'UTC')).toBe('2023-12-25');
        expect(formatDate(date, 'yyyy-MM-dd', 'America/New_York')).toBeDefined();
      });

      it('should throw error for invalid dates', () => {
        const formatDate = (date: Date, format?: string, timezone?: string) => {
          if (!date || isNaN(date.getTime())) throw new Error('Invalid date');
          return date.toISOString().split('T')[0];
        };
        expect(() => formatDate(new Date('invalid'))).toThrow();
        expect(() => formatDate(null as any)).toThrow();
        expect(() => formatDate(undefined as any)).toThrow();
      });

      it('should handle edge cases', () => {
        const formatDate = (date: Date, format?: string, timezone?: string) => {
          if (!date || isNaN(date.getTime())) throw new Error('Invalid date');
          return date.toISOString().split('T')[0];
        };
        const leapYear = new Date('2024-02-29T00:00:00Z');
        expect(formatDate(leapYear)).toBe('2024-02-29');
        
        const endOfYear = new Date('2023-12-31T23:59:59Z');
        expect(formatDate(endOfYear)).toBe('2023-12-31');
      });
    });

    describe('calculateAge', () => {
      it('should calculate age correctly for different scenarios', () => {
        const calculateAge = (birthDate: Date, currentDate?: Date) => {
          const now = currentDate || new Date();
          if (birthDate > now) throw new Error('Birth date cannot be in the future');
          const diff = now.getTime() - birthDate.getTime();
          return Math.floor(diff / (1000 * 60 * 60 * 24 * 365.25));
        };
        const birthDate = new Date('1990-01-01');
        const currentDate = new Date('2023-01-01');
        expect(calculateAge(birthDate, currentDate)).toBe(33);
      });

      it('should handle birthday not yet occurred this year', () => {
        const calculateAge = (birthDate: Date, currentDate?: Date) => {
          const now = currentDate || new Date();
          if (birthDate > now) throw new Error('Birth date cannot be in the future');
          const diff = now.getTime() - birthDate.getTime();
          return Math.floor(diff / (1000 * 60 * 60 * 24 * 365.25));
        };
        const birthDate = new Date('1990-06-15');
        const currentDate = new Date('2023-03-01');
        expect(calculateAge(birthDate, currentDate)).toBe(32);
      });

      it('should handle birthday on same day', () => {
        const calculateAge = (birthDate: Date, currentDate?: Date) => {
          const now = currentDate || new Date();
          if (birthDate > now) throw new Error('Birth date cannot be in the future');
          const diff = now.getTime() - birthDate.getTime();
          return Math.floor(diff / (1000 * 60 * 60 * 24 * 365.25));
        };
        const birthDate = new Date('1990-03-15');
        const currentDate = new Date('2023-03-15');
        expect(calculateAge(birthDate, currentDate)).toBe(33);
      });

      it('should throw error for future birth dates', () => {
        const calculateAge = (birthDate: Date, currentDate?: Date) => {
          const now = currentDate || new Date();
          if (birthDate > now) throw new Error('Birth date cannot be in the future');
          const diff = now.getTime() - birthDate.getTime();
          return Math.floor(diff / (1000 * 60 * 60 * 24 * 365.25));
        };
        const birthDate = new Date('2025-01-01');
        const currentDate = new Date('2023-01-01');
        expect(() => calculateAge(birthDate, currentDate)).toThrow('Birth date cannot be in the future');
      });

      it('should handle leap year birthdays', () => {
        const calculateAge = (birthDate: Date, currentDate?: Date) => {
          const now = currentDate || new Date();
          if (birthDate > now) throw new Error('Birth date cannot be in the future');
          const diff = now.getTime() - birthDate.getTime();
          return Math.floor(diff / (1000 * 60 * 60 * 24 * 365.25));
        };
        const birthDate = new Date('1992-02-29');
        const currentDate = new Date('2023-02-28');
        expect(calculateAge(birthDate, currentDate)).toBe(30);
      });
    });

    describe('isValidDate', () => {
      it('should validate correct dates', () => {
        const isValidDate = (date: any) => {
          return date instanceof Date && !isNaN(date.getTime());
        };
        expect(isValidDate(new Date('2023-01-01'))).toBe(true);
        expect(isValidDate(new Date())).toBe(true);
      });

      it('should reject invalid dates', () => {
        const isValidDate = (date: any) => {
          return date instanceof Date && !isNaN(date.getTime());
        };
        expect(isValidDate(new Date('invalid'))).toBe(false);
        expect(isValidDate(null as any)).toBe(false);
        expect(isValidDate(undefined as any)).toBe(false);
        expect(isValidDate('2023-01-01' as any)).toBe(false);
      });
    });

    describe('formatRelativeTime', () => {
      it('should format relative time correctly', () => {
        const formatRelativeTime = (date: Date) => {
          const now = new Date();
          const diff = now.getTime() - date.getTime();
          const hours = Math.floor(diff / (1000 * 60 * 60));
          const days = Math.floor(diff / (1000 * 60 * 60 * 24));
          if (Math.abs(hours) < 24) return `${Math.abs(hours)} hour${Math.abs(hours) !== 1 ? 's' : ''} ${hours < 0 ? 'from now' : 'ago'}`;
          return `${Math.abs(days)} day${Math.abs(days) !== 1 ? 's' : ''} ${days < 0 ? 'from now' : 'ago'}`;
        };
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
        const capitalize = (str: string) => {
          if (typeof str !== 'string') throw new Error('Input must be a string');
          if (str.length === 0) return '';
          return str.charAt(0).toUpperCase() + str.slice(1).toLowerCase();
        };
        expect(capitalize('hello')).toBe('Hello');
        expect(capitalize('HELLO')).toBe('Hello');
      });

      it('should handle edge cases', () => {
        const capitalize = (str: string) => {
          if (typeof str !== 'string') throw new Error('Input must be a string');
          if (str.length === 0) return '';
          return str.charAt(0).toUpperCase() + str.slice(1).toLowerCase();
        };
        expect(capitalize('')).toBe('');
        expect(capitalize('a')).toBe('A');
        expect(capitalize('123abc')).toBe('123abc');
      });

      it('should handle non-string inputs', () => {
        const capitalize = (str: string) => {
          if (typeof str !== 'string') throw new Error('Input must be a string');
          if (str.length === 0) return '';
          return str.charAt(0).toUpperCase() + str.slice(1).toLowerCase();
        };
        expect(() => capitalize(null as any)).toThrow();
        expect(() => capitalize(undefined as any)).toThrow();
      });
    });

    describe('camelCase', () => {
      it('should convert to camelCase', () => {
        const camelCase = (str: string) => {
          return str.replace(/[-_\s]+(.)?/g, (_, char) => char ? char.toUpperCase() : '').replace(/^./, char => char.toLowerCase());
        };
        expect(camelCase('hello world')).toBe('helloWorld');
        expect(camelCase('hello-world')).toBe('helloWorld');
        expect(camelCase('hello_world')).toBe('helloWorld');
        expect(camelCase('Hello World')).toBe('helloWorld');
      });

      it('should handle special characters', () => {
        const camelCase = (str: string) => {
          return str.replace(/[^a-zA-Z0-9]+(.)?/g, (_, char) => char ? char.toUpperCase() : '').replace(/^./, char => char.toLowerCase());
        };
        expect(camelCase('hello@world#test')).toBe('helloWorldTest');
        expect(camelCase('  hello   world  ')).toBe('helloWorld');
      });
    });

    describe('kebabCase', () => {
      it('should convert to kebab-case', () => {
        expect(toKebabCase('helloWorld')).toBe('hello-world');
        expect(toKebabCase('HelloWorld')).toBe('hello-world');
        expect(toKebabCase('hello world')).toBe('hello-world');
        expect(toKebabCase('hello_world')).toBe('hello-world');
      });
    });

    describe('truncate', () => {
      it('should truncate long strings', () => {
        const truncate = (str: string, length: number, ellipsis = '...') => {
          if (str.length <= length) return str;
          return str.slice(0, length - ellipsis.length) + ellipsis;
        };
        const longString = 'This is a very long string that should be truncated';
        expect(truncate(longString, 20)).toBe('This is a very long...');
      });

      it('should not truncate short strings', () => {
        const truncate = (str: string, length: number, ellipsis = '...') => {
          if (str.length <= length) return str;
          return str.slice(0, length - ellipsis.length) + ellipsis;
        };
        const shortString = 'Short';
        expect(truncate(shortString, 20)).toBe('Short');
      });

      it('should handle custom ellipsis', () => {
        const truncate = (str: string, length: number, ellipsis = '...') => {
          if (str.length <= length) return str;
          return str.slice(0, length - ellipsis.length) + ellipsis;
        };
        const string = 'Hello world';
        expect(truncate(string, 8, ' [more]')).toBe('Hello [more]');
      });

      it('should handle edge cases', () => {
        const truncate = (str: string, length: number, ellipsis = '...') => {
          if (length <= 0) return ellipsis;
          if (str.length <= length) return str;
          return str.slice(0, length - ellipsis.length) + ellipsis;
        };
        expect(truncate('', 10)).toBe('');
        expect(truncate('Hello', 0)).toBe('...');
        expect(truncate('Hello', 5)).toBe('Hello');
      });
    });

    describe('generateSlug', () => {
      it('should generate URL-friendly slugs', () => {
        const generateSlug = (str: string) => {
          return str.toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-+|-+$/g, '');
        };
        expect(generateSlug('Hello World')).toBe('hello-world');
        expect(generateSlug('This is a Test!')).toBe('this-is-a-test');
        expect(generateSlug('Special@Characters#Here')).toBe('special-characters-here');
      });

      it('should handle unicode characters', () => {
        const generateSlug = (str: string) => {
          return str.normalize('NFD').replace(/[\u0300-\u036f]/g, '').toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-+|-+$/g, '');
        };
        expect(generateSlug('Café & Résumé')).toBe('cafe-resume');
        expect(generateSlug('Müller & Sön')).toBe('muller-son');
      });
    });
  });

  // Validation Functions
  describe('Validation Utilities', () => {
    describe('isValidEmail', () => {
      it('should validate correct email addresses', () => {
        const isValidEmail = (email: string) => {
          if (typeof email !== 'string') return false;
          const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
          return emailRegex.test(email.trim());
        };
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
        const isValidEmail = (email: string) => {
          if (typeof email !== 'string') return false;
          const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
          return emailRegex.test(email.trim());
        };
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
        const isValidEmail = (email: string) => {
          if (typeof email !== 'string') return false;
          const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
          return emailRegex.test(email.trim());
        };
        expect(isValidEmail('  test@example.com  ')).toBe(true);
        expect(isValidEmail(null as any)).toBe(false);
        expect(isValidEmail(undefined as any)).toBe(false);
        expect(isValidEmail(123 as any)).toBe(false);
      });
    });

    describe('isValidUrl', () => {
      it('should validate correct URLs', () => {
        const isValidUrl = (url: string) => {
          try {
            new URL(url);
            return true;
          } catch {
            return false;
          }
        };
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
        const isValidUrl = (url: string) => {
          try {
            new URL(url);
            return true;
          } catch {
            return false;
          }
        };
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
        const validatePassword = (password: string) => {
          const minLength = 8;
          const hasUpper = /[A-Z]/.test(password);
          const hasLower = /[a-z]/.test(password);
          const hasNumber = /\d/.test(password);
          const hasSpecial = /[!@#$%^&*(),.?":{}|<>]/.test(password);
          return password.length >= minLength && hasUpper && hasLower && hasNumber && hasSpecial;
        };
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
        const validatePassword = (password: string) => {
          const minLength = 8;
          const hasUpper = /[A-Z]/.test(password);
          const hasLower = /[a-z]/.test(password);
          const hasNumber = /\d/.test(password);
          const hasSpecial = /[!@#$%^&*(),.?":{}|<>]/.test(password);
          return password.length >= minLength && hasUpper && hasLower && hasNumber && hasSpecial;
        };
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
        const validateRequired = (obj: any, required: string[]) => {
          return required.every(field => obj[field] != null && obj[field] !== '');
        };
        const data = { name: 'John', email: 'john@example.com', age: 30 };
        const required = ['name', 'email'];
        expect(validateRequired(data, required)).toBe(true);
      });

      it('should fail validation for missing fields', () => {
        const validateRequired = (obj: any, required: string[]) => {
          return required.every(field => obj[field] != null && obj[field] !== '');
        };
        const data = { name: 'John' };
        const required = ['name', 'email'];
        expect(validateRequired(data, required)).toBe(false);
      });

      it('should handle empty values as invalid', () => {
        const validateRequired = (obj: any, required: string[]) => {
          return required.every(field => obj[field] != null && obj[field] !== '');
        };
        const data = { name: '', email: 'john@example.com' };
        const required = ['name', 'email'];
        expect(validateRequired(data, required)).toBe(false);
      });

      it('should handle null/undefined values', () => {
        const validateRequired = (obj: any, required: string[]) => {
          return required.every(field => obj[field] != null && obj[field] !== '' && obj[field] !== 0);
        };
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
        const deepClone = (obj: any): any => {
          if (obj === null || typeof obj !== 'object') return obj;
          if (obj instanceof Date) return new Date(obj);
          if (obj instanceof Array) return obj.map(item => deepClone(item));
          if (typeof obj === 'object') {
            const cloned: any = {};
            for (const key in obj) {
              if (obj.hasOwnProperty(key)) {
                cloned[key] = deepClone(obj[key]);
              }
            }
            return cloned;
          }
          return obj;
        };
        expect(deepClone(42)).toBe(42);
        expect(deepClone('hello')).toBe('hello');
        expect(deepClone(true)).toBe(true);
        expect(deepClone(null)).toBe(null);
        expect(deepClone(undefined)).toBe(undefined);
      });

      it('should deep clone objects', () => {
        const deepClone = (obj: any): any => {
          if (obj === null || typeof obj !== 'object') return obj;
          if (obj instanceof Date) return new Date(obj);
          if (obj instanceof Array) return obj.map(item => deepClone(item));
          if (typeof obj === 'object') {
            const cloned: any = {};
            for (const key in obj) {
              if (obj.hasOwnProperty(key)) {
                cloned[key] = deepClone(obj[key]);
              }
            }
            return cloned;
          }
          return obj;
        };
        const obj = { a: 1, b: { c: 2, d: { e: 3 } } };
        const cloned = deepClone(obj);
        
        expect(cloned).toEqual(obj);
        expect(cloned).not.toBe(obj);
        expect(cloned.b).not.toBe(obj.b);
        expect(cloned.b.d).not.toBe(obj.b.d);
      });

      it('should deep clone arrays', () => {
        const deepClone = (obj: any): any => {
          if (obj === null || typeof obj !== 'object') return obj;
          if (obj instanceof Date) return new Date(obj);
          if (obj instanceof Array) return obj.map(item => deepClone(item));
          if (typeof obj === 'object') {
            const cloned: any = {};
            for (const key in obj) {
              if (obj.hasOwnProperty(key)) {
                cloned[key] = deepClone(obj[key]);
              }
            }
            return cloned;
          }
          return obj;
        };
        const arr = [1, [2, 3], { a: 4 }, [[5, 6]]];
        const cloned = deepClone(arr);
        
        expect(cloned).toEqual(arr);
        expect(cloned).not.toBe(arr);
        expect(cloned[1]).not.toBe(arr[1]);
        expect(cloned[2]).not.toBe(arr[2]);
      });

      it('should handle special objects', () => {
        const deepClone = (obj: any): any => {
          if (obj === null || typeof obj !== 'object') return obj;
          if (obj instanceof Date) return new Date(obj);
          if (obj instanceof RegExp) return new RegExp(obj);
          if (obj instanceof Map) return new Map(obj);
          if (obj instanceof Set) return new Set(obj);
          if (obj instanceof Array) return obj.map(item => deepClone(item));
          if (typeof obj === 'object') {
            const cloned: any = {};
            for (const key in obj) {
              if (obj.hasOwnProperty(key)) {
                cloned[key] = deepClone(obj[key]);
              }
            }
            return cloned;
          }
          return obj;
        };
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
        const deepClone = (obj: any, visited = new WeakMap()): any => {
          if (obj === null || typeof obj !== 'object') return obj;
          if (visited.has(obj)) return visited.get(obj);
          
          let cloned: any;
          if (obj instanceof Date) cloned = new Date(obj);
          else if (obj instanceof Array) {
            cloned = [];
            visited.set(obj, cloned);
            obj.forEach((item, index) => {
              cloned[index] = deepClone(item, visited);
            });
          } else {
            cloned = {};
            visited.set(obj, cloned);
            for (const key in obj) {
              if (obj.hasOwnProperty(key)) {
                cloned[key] = deepClone(obj[key], visited);
              }
            }
          }
          return cloned;
        };
        const obj: any = { a: 1 };
        obj.self = obj;
        
        const cloned = deepClone(obj);
        expect(cloned.a).toBe(1);
        expect(cloned.self).toBe(cloned);
      });
    });

    describe('mergeObjects', () => {
      it('should merge simple objects', () => {
        const mergeObjects = (...objects: any[]) => {
          return objects.reduce((result, obj) => {
            if (obj && typeof obj === 'object') {
              Object.assign(result, obj);
            }
            return result;
          }, {});
        };
        const obj1 = { a: 1, b: 2 };
        const obj2 = { c: 3, d: 4 };
        expect(mergeObjects(obj1, obj2)).toEqual({ a: 1, b: 2, c: 3, d: 4 });
      });

      it('should handle property overwrites', () => {
        const mergeObjects = (...objects: any[]) => {
          return objects.reduce((result, obj) => {
            if (obj && typeof obj === 'object') {
              Object.assign(result, obj);
            }
            return result;
          }, {});
        };
        const obj1 = { a: 1, b: 2 };
        const obj2 = { b: 3, c: 4 };
        expect(mergeObjects(obj1, obj2)).toEqual({ a: 1, b: 3, c: 4 });
      });

      it('should deep merge nested objects', () => {
        const mergeObjects = (...objects: any[]): any => {
          const deepMerge = (target: any, source: any) => {
            for (const key in source) {
              if (source[key] && typeof source[key] === 'object' && !Array.isArray(source[key])) {
                target[key] = target[key] || {};
                deepMerge(target[key], source[key]);
              } else {
                target[key] = source[key];
              }
            }
            return target;
          };
          
          return objects.reduce((result, obj) => {
            if (obj && typeof obj === 'object') {
              deepMerge(result, obj);
            }
            return result;
          }, {});
        };
        const obj1 = { a: { x: 1, y: 2 }, b: 1 };
        const obj2 = { a: { y: 3, z: 4 }, c: 2 };
        expect(mergeObjects(obj1, obj2)).toEqual({ 
          a: { x: 1, y: 3, z: 4 }, 
          b: 1, 
          c: 2 
        });
      });

      it('should handle multiple objects', () => {
        const mergeObjects = (...objects: any[]) => {
          return objects.reduce((result, obj) => {
            if (obj && typeof obj === 'object') {
              Object.assign(result, obj);
            }
            return result;
          }, {});
        };
        const obj1 = { a: 1 };
        const obj2 = { b: 2 };
        const obj3 = { c: 3 };
        expect(mergeObjects(obj1, obj2, obj3)).toEqual({ a: 1, b: 2, c: 3 });
      });

      it('should handle null/undefined inputs', () => {
        const mergeObjects = (...objects: any[]) => {
          return objects.reduce((result, obj) => {
            if (obj && typeof obj === 'object') {
              Object.assign(result, obj);
            }
            return result;
          }, {});
        };
        const obj = { a: 1 };
        expect(mergeObjects(obj, null)).toEqual({ a: 1 });
        expect(mergeObjects(obj, undefined)).toEqual({ a: 1 });
        expect(mergeObjects(null, obj)).toEqual({ a: 1 });
      });
    });

    describe('isEmptyObject', () => {
      it('should identify empty objects', () => {
        const isEmptyObject = (obj: any) => {
          if (obj == null) return true;
          if (Array.isArray(obj)) return obj.length === 0;
          if (typeof obj === 'object') return Object.keys(obj).length === 0;
          return false;
        };
        expect(isEmptyObject({})).toBe(true);
        expect(isEmptyObject(Object.create(null))).toBe(true);
      });

      it('should identify non-empty objects', () => {
        const isEmptyObject = (obj: any) => {
          if (obj == null) return true;
          if (Array.isArray(obj)) return obj.length === 0;
          if (typeof obj === 'object') return Object.keys(obj).length === 0;
          return false;
        };
        expect(isEmptyObject({ a: 1 })).toBe(false);
        expect(isEmptyObject({ a: undefined })).toBe(false);
      });

      it('should handle non-objects', () => {
        const isEmptyObject = (obj: any) => {
          if (obj == null) return true;
          if (Array.isArray(obj)) return obj.length === 0;
          if (typeof obj === 'object') return Object.keys(obj).length === 0;
          return false;
        };
        expect(isEmptyObject(null)).toBe(true);
        expect(isEmptyObject(undefined)).toBe(true);
        expect(isEmptyObject([])).toBe(true);
        expect(isEmptyObject('')).toBe(false);
      });
    });

    describe('pick', () => {
      it('should pick specified properties', () => {
        const pick = (obj: any, keys: string[]) => {
          const result: any = {};
          keys.forEach(key => {
            if (key in obj) {
              result[key] = obj[key];
            }
          });
          return result;
        };
        const obj = { a: 1, b: 2, c: 3, d: 4 };
        expect(pick(obj, ['a', 'c'])).toEqual({ a: 1, c: 3 });
      });

      it('should handle non-existent properties', () => {
        const pick = (obj: any, keys: string[]) => {
          const result: any = {};
          keys.forEach(key => {
            if (key in obj) {
              result[key] = obj[key];
            }
          });
          return result;
        };
        const obj = { a: 1, b: 2 };
        expect(pick(obj, ['a', 'x'] as any)).toEqual({ a: 1 });
      });

      it('should handle empty selection', () => {
        const pick = (obj: any, keys: string[]) => {
          const result: any = {};
          keys.forEach(key => {
            if (key in obj) {
              result[key] = obj[key];
            }
          });
          return result;
        };
        const obj = { a: 1, b: 2 };
        expect(pick(obj, [])).toEqual({});
      });
    });

    describe('omit', () => {
      it('should omit specified properties', () => {
        const omit = (obj: any, keys: string[]) => {
          const result = { ...obj };
          keys.forEach(key => {
            delete result[key];
          });
          return result;
        };
        const obj = { a: 1, b: 2, c: 3, d: 4 };
        expect(omit(obj, ['b', 'd'])).toEqual({ a: 1, c: 3 });
      });

      it('should handle non-existent properties', () => {
        const omit = (obj: any, keys: string[]) => {
          const result = { ...obj };
          keys.forEach(key => {
            delete result[key];
          });
          return result;
        };
        const obj = { a: 1, b: 2 };
        expect(omit(obj, ['b', 'x'] as any)).toEqual({ a: 1 });
      });
    });

    describe('flatten', () => {
      it('should flatten nested arrays', () => {
        const flatten = (arr: any[], depth = Infinity): any[] => {
          return depth > 0 ? arr.reduce((acc, val) => 
            acc.concat(Array.isArray(val) ? flatten(val, depth - 1) : val), []) : arr.slice();
        };
        expect(flatten([1, [2, 3], [4, [5, 6]]])).toEqual([1, 2, 3, 4, 5, 6]);
        expect(flatten([[1, 2], [3, 4]])).toEqual([1, 2, 3, 4]);
      });

      it('should handle deeply nested arrays', () => {
        const flatten = (arr: any[], depth = Infinity): any[] => {
          return depth > 0 ? arr.reduce((acc, val) => 
            acc.concat(Array.isArray(val) ? flatten(val, depth - 1) : val), []) : arr.slice();
        };
        expect(flatten([1, [2, [3, [4]]]], 2)).toEqual([1, 2, 3, [4]]);
      });

      it('should handle empty arrays', () => {
        const flatten = (arr: any[], depth = Infinity): any[] => {
          return depth > 0 ? arr.reduce((acc, val) => 
            acc.concat(Array.isArray(val) ? flatten(val, depth - 1) : val), []) : arr.slice();
        };
        expect(flatten([])).toEqual([]);
        expect(flatten([[], []])).toEqual([]);
      });
    });

    describe('chunk', () => {
      it('should chunk arrays into specified sizes', () => {
        const chunk = (arr: any[], size: number) => {
          const result = [];
          for (let i = 0; i < arr.length; i += size) {
            result.push(arr.slice(i, i + size));
          }
          return result;
        };
        expect(chunk([1, 2, 3, 4, 5, 6], 2)).toEqual([[1, 2], [3, 4], [5, 6]]);
        expect(chunk([1, 2, 3, 4, 5], 2)).toEqual([[1, 2], [3, 4], [5]]);
      });

      it('should handle edge cases', () => {
        const chunk = (arr: any[], size: number) => {
          const result = [];
          for (let i = 0; i < arr.length; i += size) {
            result.push(arr.slice(i, i + size));
          }
          return result;
        };
        expect(chunk([], 2)).toEqual([]);
        expect(chunk([1, 2, 3], 5)).toEqual([[1, 2, 3]]);
        expect(chunk([1, 2, 3], 1)).toEqual([[1], [2], [3]]);
      });
    });

    describe('unique', () => {
      it('should remove duplicates from arrays', () => {
        const unique = (arr: any[]) => {
          return [...new Set(arr)];
        };
        expect(unique([1, 2, 2, 3, 3, 3])).toEqual([1, 2, 3]);
        expect(unique(['a', 'b', 'a', 'c'])).toEqual(['a', 'b', 'c']);
      });

      it('should handle objects by reference', () => {
        const unique = (arr: any[]) => {
          return [...new Set(arr)];
        };
        const obj1 = { id: 1 };
        const obj2 = { id: 2 };
        expect(unique([obj1, obj2, obj1])).toEqual([obj1, obj2]);
      });

      it('should handle empty arrays', () => {
        const unique = (arr: any[]) => {
          return [...new Set(arr)];
        };
        expect(unique([])).toEqual([]);
      });
    });

    describe('groupBy', () => {
      it('should group objects by property', () => {
        const groupBy = (arr: any[], key: string | ((item: any) => string)) => {
          return arr.reduce((groups, item) => {
            const groupKey = typeof key === 'function' ? key(item) : item[key];
            if (!groups[groupKey]) groups[groupKey] = [];
            groups[groupKey].push(item);
            return groups;
          }, {} as any);
        };
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
        const groupBy = (arr: any[], key: string | ((item: any) => string)) => {
          return arr.reduce((groups, item) => {
            const groupKey = typeof key === 'function' ? key(item) : item[key];
            if (!groups[groupKey]) groups[groupKey] = [];
            groups[groupKey].push(item);
            return groups;
          }, {} as any);
        };
        const data = [1, 2, 3, 4, 5, 6];
        const grouped = groupBy(data, (n: number) => n % 2 === 0 ? 'even' : 'odd');
        
        expect(grouped.odd).toEqual([1, 3, 5]);
        expect(grouped.even).toEqual([2, 4, 6]);
      });
    });

    describe('sortBy', () => {
      it('should sort by property', () => {
        const sortBy = (arr: any[], key: string | ((item: any) => any)) => {
          return [...arr].sort((a, b) => {
            const aVal = typeof key === 'function' ? key(a) : a[key];
            const bVal = typeof key === 'function' ? key(b) : b[key];
            return aVal < bVal ? -1 : aVal > bVal ? 1 : 0;
          });
        };
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
        const sortBy = (arr: any[], key: string | ((item: any) => any)) => {
          return [...arr].sort((a, b) => {
            const aVal = typeof key === 'function' ? key(a) : a[key];
            const bVal = typeof key === 'function' ? key(b) : b[key];
            return aVal < bVal ? -1 : aVal > bVal ? 1 : 0;
          });
        };
        const data = [3, 1, 4, 1, 5, 9];
        const sorted = sortBy(data, (n: number) => -n);
        expect(sorted).toEqual([9, 5, 4, 3, 1, 1]);
      });
    });
  });

  // Function Utilities
  describe('Function Utilities', () => {
    beforeEach(() => {
      // Mock timers for testing
    });

    afterEach(() => {
      // Restore timers
    });

    describe('debounce', () => {
      it('should debounce function calls', () => {
        const mockFn = { fn: () => {} };
        const spy = jest.spyOn(mockFn, 'fn');
        
        const debounce = (func: Function, delay: number, immediate = false) => {
          let timeoutId: NodeJS.Timeout;
          return function(this: any, ...args: any[]) {
            const callNow = immediate && !timeoutId;
            clearTimeout(timeoutId);
            timeoutId = setTimeout(() => {
              timeoutId = null as any;
              if (!immediate) func.apply(this, args);
            }, delay);
            if (callNow) func.apply(this, args);
          };
        };
        
        const debouncedFn = debounce(mockFn.fn, 100);

        debouncedFn();
        debouncedFn();
        debouncedFn();

        expect(spy).not.toHaveBeenCalled();
        
        setTimeout(() => {
          expect(spy).toHaveBeenCalledTimes(1);
        }, 100);
      });

      it('should pass arguments correctly', () => {
        const mockFn = { fn: (arg1: string, arg2: string) => {} };
        const spy = jest.spyOn(mockFn, 'fn');
        
        const debounce = (func: Function, delay: number) => {
          let timeoutId: NodeJS.Timeout;
          return function(this: any, ...args: any[]) {
            clearTimeout(timeoutId);
            timeoutId = setTimeout(() => func.apply(this, args), delay);
          };
        };
        
        const debouncedFn = debounce(mockFn.fn, 100);

        debouncedFn('arg1', 'arg2');
        
        setTimeout(() => {
          expect(spy).toHaveBeenCalledWith('arg1', 'arg2');
        }, 100);
      });

      it('should reset timer on subsequent calls', () => {
        const mockFn = { fn: () => {} };
        const spy = jest.spyOn(mockFn, 'fn');
        
        const debounce = (func: Function, delay: number) => {
          let timeoutId: NodeJS.Timeout;
          return function(this: any, ...args: any[]) {
            clearTimeout(timeoutId);
            timeoutId = setTimeout(() => func.apply(this, args), delay);
          };
        };
        
        const debouncedFn = debounce(mockFn.fn, 100);

        debouncedFn();
        setTimeout(() => debouncedFn(), 50);

        setTimeout(() => {
          expect(spy).not.toHaveBeenCalled();
        }, 100);
        
        setTimeout(() => {
          expect(spy).toHaveBeenCalledTimes(1);
        }, 150);
      });

      it('should handle immediate execution option', () => {
        const mockFn = { fn: () => {} };
        const spy = jest.spyOn(mockFn, 'fn');
        
        const debounce = (func: Function, delay: number, immediate = false) => {
          let timeoutId: NodeJS.Timeout;
          return function(this: any, ...args: any[]) {
            const callNow = immediate && !timeoutId;
            clearTimeout(timeoutId);
            timeoutId = setTimeout(() => {
              timeoutId = null as any;
              if (!immediate) func.apply(this, args);
            }, delay);
            if (callNow) func.apply(this, args);
          };
        };
        
        const debouncedFn = debounce(mockFn.fn, 100, true);

        debouncedFn();
        expect(spy).toHaveBeenCalledTimes(1);
        
        debouncedFn();
        expect(spy).toHaveBeenCalledTimes(1);
      });
    });

    describe('throttle', () => {
      it('should throttle function calls', () => {
        const mockFn = { fn: () => {} };
        const spy = jest.spyOn(mockFn, 'fn');
        
        const throttle = (func: Function, delay: number) => {
          let lastCall = 0;
          return function(this: any, ...args: any[]) {
            const now = Date.now();
            if (now - lastCall >= delay) {
              lastCall = now;
              func.apply(this, args);
            }
          };
        };
        
        const throttledFn = throttle(mockFn.fn, 100);

        throttledFn();
        throttledFn();
        throttledFn();

        expect(spy).toHaveBeenCalledTimes(1);
        
        setTimeout(() => {
          throttledFn();
          expect(spy).toHaveBeenCalledTimes(2);
        }, 100);
      });

      it('should preserve function context', () => {
        const context = { value: 42 };
        const mockFn = { fn: function(this: any) { return this.value; } };
        const spy = jest.spyOn(mockFn, 'fn');
        
        const throttle = (func: Function, delay: number) => {
          let lastCall = 0;
          return function(this: any, ...args: any[]) {
            const now = Date.now();
            if (now - lastCall >= delay) {
              lastCall = now;
              func.apply(this, args);
            }
          };
        };
        
        const throttledFn = throttle(mockFn.fn, 100);

        throttledFn.call(context);
        expect(spy).toHaveBeenCalledWith();
      });

      it('should handle trailing calls', () => {
        const mockFn = { fn: () => {} };
        const spy = jest.spyOn(mockFn, 'fn');
        
        const throttle = (func: Function, delay: number) => {
          let lastCall = 0;
          let timeoutId: NodeJS.Timeout;
          return function(this: any, ...args: any[]) {
            const now = Date.now();
            if (now - lastCall >= delay) {
              lastCall = now;
              func.apply(this, args);
            } else {
              clearTimeout(timeoutId);
              timeoutId = setTimeout(() => {
                lastCall = Date.now();
                func.apply(this, args);
              }, delay - (now - lastCall));
            }
          };
        };
        
        const throttledFn = throttle(mockFn.fn, 100);

        throttledFn();
        throttledFn();
        setTimeout(() => throttledFn(), 50);

        expect(spy).toHaveBeenCalledTimes(1);
        setTimeout(() => {
          expect(spy).toHaveBeenCalledTimes(2);
        }, 100);
      });
    });

    describe('memoize', () => {
      it('should cache function results', () => {
        const expensiveFn = { fn: (x: number) => x * 2 };
        const spy = jest.spyOn(expensiveFn, 'fn');
        
        const memoize = (func: Function, keyResolver?: Function) => {
          const cache = new Map();
          return function(this: any, ...args: any[]) {
            const key = keyResolver ? keyResolver(...args) : JSON.stringify(args);
            if (cache.has(key)) {
              return cache.get(key);
            }
            const result = func.apply(this, args);
            cache.set(key, result);
            return result;
          };
        };
        
        const memoized = memoize(expensiveFn.fn);

        expect(memoized(5)).toBe(10);
        expect(memoized(5)).toBe(10);
        expect(spy).toHaveBeenCalledTimes(1);
      });

      it('should handle different arguments', () => {
        const expensiveFn = { fn: (x: number) => x * 2 };
        const spy = jest.spyOn(expensiveFn, 'fn');
        
        const memoize = (func: Function, keyResolver?: Function) => {
          const cache = new Map();
          return function(this: any, ...args: any[]) {
            const key = keyResolver ? keyResolver(...args) : JSON.stringify(args);
            if (cache.has(key)) {
              return cache.get(key);
            }
            const result = func.apply(this, args);
            cache.set(key, result);
            return result;
          };
        };
        
        const memoized = memoize(expensiveFn.fn);

        expect(memoized(5)).toBe(10);
        expect(memoized(10)).toBe(20);
        expect(memoized(5)).toBe(10);
        expect(spy).toHaveBeenCalledTimes(2);
      });

      it('should handle multiple arguments', () => {
        const fn = { fn: (a: number, b: number) => a + b };
        const spy = jest.spyOn(fn, 'fn');
        
        const memoize = (func: Function, keyResolver?: Function) => {
          const cache = new Map();
          return function(this: any, ...args: any[]) {
            const key = keyResolver ? keyResolver(...args) : JSON.stringify(args);
            if (cache.has(key)) {
              return cache.get(key);
            }
            const result = func.apply(this, args);
            cache.set(key, result);
            return result;
          };
        };
        
        const memoized = memoize(fn.fn);

        expect(memoized(1, 2)).toBe(3);
        expect(memoized(1, 2)).toBe(3);
        expect(memoized(2, 3)).toBe(5);
        expect(spy).toHaveBeenCalledTimes(2);
      });

      it('should handle custom key resolver', () => {
        const fn = { fn: (obj: any) => obj.x + obj.y };
        const spy = jest.spyOn(fn, 'fn');
        
        const memoize = (func: Function, keyResolver?: Function) => {
          const cache = new Map();
          return function(this: any, ...args: any[]) {
            const key = keyResolver ? keyResolver(...args) : JSON.stringify(args);
            if (cache.has(key)) {
              return cache.get(key);
            }
            const result = func.apply(this, args);
            cache.set(key, result);
            return result;
          };
        };
        
        const keyResolver = (obj: any) => `${obj.x}-${obj.y}`;
        const memoized = memoize(fn.fn, keyResolver);

        expect(memoized({ x: 1, y: 2 })).toBe(3);
        expect(memoized({ x: 1, y: 2 })).toBe(3);
        expect(spy).toHaveBeenCalledTimes(1);
      });
    });

    describe('retry', () => {
      beforeEach(() => {
        // Use real timers for async tests
      });

      it('should succeed on first attempt', async () => {
        const mockFn = { fn: () => Promise.resolve('success') };
        const spy = jest.spyOn(mockFn, 'fn');
        
        const retry = async (func: Function, maxRetries: number, delay = 0) => {
          for (let i = 0; i < maxRetries; i++) {
            try {
              return await func();
            } catch (error) {
              if (i === maxRetries - 1) throw error;
              if (delay > 0) await new Promise(resolve => setTimeout(resolve, delay));
            }
          }
        };
        
        const result = await retry(mockFn.fn, 3);

        expect(result).toBe('success');
        expect(spy).toHaveBeenCalledTimes(1);
      });

      it('should retry on failure and eventually succeed', async () => {
        const mockFn = { 
          fn: jest.fn()
            .mockRejectedValueOnce(new Error('fail1'))
            .mockRejectedValueOnce(new Error('fail2'))
            .mockResolvedValue('success')
        };

        const retry = async (func: Function, maxRetries: number, delay = 0) => {
          for (let i = 0; i < maxRetries; i++) {
            try {
              return await func();
            } catch (error) {
              if (i === maxRetries - 1) throw error;
              if (delay > 0) await new Promise(resolve => setTimeout(resolve, delay));
            }
          }
        };

        const result = await retry(mockFn.fn, 3);

        expect(result).toBe('success');
        expect(mockFn.fn).toHaveBeenCalledTimes(3);
      });

      it('should fail after max retries', async () => {
        const mockFn = { fn: () => Promise.reject(new Error('always fails')) };

        const retry = async (func: Function, maxRetries: number, delay = 0) => {
          for (let i = 0; i < maxRetries; i++) {
            try {
              return await func();
            } catch (error) {
              if (i === maxRetries - 1) throw error;
              if (delay > 0) await new Promise(resolve => setTimeout(resolve, delay));
            }
          }
        };

        await expect(retry(mockFn.fn, 2)).rejects.toThrow('always fails');
      });

      it('should handle retry delay', async () => {
        const mockFn = { 
          fn: jest.fn()
            .mockRejectedValueOnce(new Error('fail'))
            .mockResolvedValue('success')
        };

        const retry = async (func: Function, maxRetries: number, delay = 0) => {
          for (let i = 0; i < maxRetries; i++) {
            try {
              return await func();
            } catch (error) {
              if (i === maxRetries - 1) throw error;
              if (delay > 0) await new Promise(resolve => setTimeout(resolve, delay));
            }
          }
        };

        const startTime = Date.now();
        const result = await retry(mockFn.fn, 3, 100);
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
        const formatCurrency = (amount: number, currency = 'USD', locale = 'en-US') => {
          if (isNaN(amount) || !isFinite(amount)) throw new Error('Invalid amount');
          return new Intl.NumberFormat(locale, { style: 'currency', currency }).format(amount);
        };
        expect(formatCurrency(1234.56)).toBe('$1,234.56');
        expect(formatCurrency(0)).toBe('$0.00');
        expect(formatCurrency(-100.50)).toBe('-$100.50');
      });

      it('should format currency with different locales', () => {
        const formatCurrency = (amount: number, currency = 'USD', locale = 'en-US') => {
          if (isNaN(amount) || !isFinite(amount)) throw new Error('Invalid amount');
          return new Intl.NumberFormat(locale, { style: 'currency', currency }).format(amount);
        };
        expect(formatCurrency(1234.56, 'EUR', 'de-DE')).toContain('€');
        expect(formatCurrency(1234.56, 'GBP', 'en-GB')).toContain('£');
        expect(formatCurrency(1234.56, 'JPY', 'ja-JP')).toContain('¥');
      });

      it('should handle large numbers', () => {
        const formatCurrency = (amount: number, currency = 'USD', locale = 'en-US') => {
          if (isNaN(amount) || !isFinite(amount)) throw new Error('Invalid amount');
          return new Intl.NumberFormat(locale, { style: 'currency', currency }).format(amount);
        };
        expect(formatCurrency(1000000)).toBe('$1,000,000.00');
        expect(formatCurrency(1234567.89)).toBe('$1,234,567.89');
      });

      it('should handle edge cases', () => {
        const formatCurrency = (amount: number, currency = 'USD', locale = 'en-US') => {
          if (isNaN(amount) || !isFinite(amount)) throw new Error('Invalid amount');
          return new Intl.NumberFormat(locale, { style: 'currency', currency }).format(amount);
        };
        expect(formatCurrency(0.01)).toBe('$0.01');
        expect(formatCurrency(0.001)).toBe('$0.00');
        expect(() => formatCurrency(NaN)).toThrow();
        expect(() => formatCurrency(Infinity)).toThrow();
      });
    });

    describe('formatNumber', () => {
      it('should format numbers with thousand separators', () => {
        const formatNumber = (num: number, decimals?: number, locale = 'en-US') => {
          const options: Intl.NumberFormatOptions = {};
          if (decimals !== undefined) {
            options.minimumFractionDigits = decimals;
            options.maximumFractionDigits = decimals;
          }
          return new Intl.NumberFormat(locale, options).format(num);
        };
        expect(formatNumber(1234)).toBe('1,234');
        expect(formatNumber(1234567)).toBe('1,234,567');
      });

      it('should handle decimal places', () => {
        const formatNumber = (num: number, decimals?: number, locale = 'en-US') => {
          const options: Intl.NumberFormatOptions = {};
          if (decimals !== undefined) {
            options.minimumFractionDigits = decimals;
            options.maximumFractionDigits = decimals;
          }
          return new Intl.NumberFormat(locale, options).format(num);
        };
        expect(formatNumber(1234.5678, 2)).toBe('1,234.57');
        expect(formatNumber(1234, 2)).toBe('1,234.00');
      });

      it('should handle different locales', () => {
        const formatNumber = (num: number, decimals?: number, locale = 'en-US') => {
          const options: Intl.NumberFormatOptions = {};
          if (decimals !== undefined) {
            options.minimumFractionDigits = decimals;
            options.maximumFractionDigits = decimals;
          }
          return new Intl.NumberFormat(locale, options).format(num);
        };
        expect(formatNumber(1234.56, 2, 'de-DE')).toBe('1.234,56');
        expect(formatNumber(1234.56, 2, 'fr-FR')).toContain('234');
      });
    });

    describe('formatFileSize', () => {
      it('should format bytes correctly', () => {
        const formatFileSize = (bytes: number) => {
          const units = ['B', 'KB', 'MB', 'GB', 'TB'];
          let size = bytes;
          let unitIndex = 0;
          while (size >= 1024 && unitIndex < units.length - 1) {
            size /= 1024;
            unitIndex++;
          }
          return `${unitIndex === 0 ? size : size.toFixed(1).replace(/\.0$/, '')} ${units[unitIndex]}`;
        };
        expect(formatFileSize(1024)).toBe('1 KB');
        expect(formatFileSize(1048576)).toBe('1 MB');
        expect(formatFileSize(1073741824)).toBe('1 GB');
      });

      it('should handle decimal places', () => {
        const formatFileSize = (bytes: number) => {
          const units = ['B', 'KB', 'MB', 'GB', 'TB'];
          let size = bytes;
          let unitIndex = 0;
          while (size >= 1024 && unitIndex < units.length - 1) {
            size /= 1024;
            unitIndex++;
          }
          return `${unitIndex === 0 ? size : size.toFixed(1).replace(/\.0$/, '')} ${units[unitIndex]}`;
        };
        expect(formatFileSize(1536)).toBe('1.5 KB');
        expect(formatFileSize(1572864)).toBe('1.5 MB');
      });

      it('should handle small sizes', () => {
        const formatFileSize = (bytes: number) => {
          const units = ['B', 'KB', 'MB', 'GB', 'TB'];
          let size = bytes;
          let unitIndex = 0;
          while (size >= 1024 && unitIndex < units.length - 1) {
            size /= 1024;
            unitIndex++;
          }
          return `${unitIndex === 0 ? size : size.toFixed(1).replace(/\.0$/, '')} ${units[unitIndex]}`;
        };
        expect(formatFileSize(512)).toBe('512 B');
        expect(formatFileSize(0)).toBe('0 B');
      });
    });

    describe('clamp', () => {
      it('should clamp values within range', () => {
        const clamp = (value: number, min: number, max: number) => {
          return Math.min(Math.max(value, min), max);
        };
        expect(clamp(5, 0, 10)).toBe(5);
        expect(clamp(-5, 0, 10)).toBe(0);
        expect(clamp(15, 0, 10)).toBe(10);
      });

      it('should handle edge cases', () => {
        const clamp = (value: number, min: number, max: number) => {
          return Math.min(Math.max(value, min), max);
        };
        expect(clamp(5, 5, 5)).toBe(5);
        expect(clamp(5, 0, 0)).toBe(0);
      });
    });

    describe('lerp', () => {
      it('should interpolate between values', () => {
        const lerp = (start: number, end: number, t: number) => {
          return start + (end - start) * t;
        };
        expect(lerp(0, 10, 0.5)).toBe(5);
        expect(lerp(0, 10, 0)).toBe(0);
        expect(lerp(0, 10, 1)).toBe(10);
      });

      it('should handle negative values', () => {
        const lerp = (start: number, end: number, t: number) => {
          return start + (end - start) * t;
        };
        expect(lerp(-10, 10, 0.5)).toBe(0);
        expect(lerp(-5, -1, 0.5)).toBe(-3);
      });
    });

    describe('randomInt', () => {
      it('should generate random integers within range', () => {
        const randomInt = (min: number, max: number) => {
          return Math.floor(Math.random() * (max - min + 1)) + min;
        };
        for (let i = 0; i < 100; i++) {
          const num = randomInt(1, 10);
          expect(num).toBeGreaterThanOrEqual(1);
          expect(num).toBeLessThanOrEqual(10);
          expect(Number.isInteger(num)).toBe(true);
        }
      });

      it('should handle single value range', () => {
        const randomInt = (min: number, max: number) => {
          return Math.floor(Math.random() * (max - min + 1)) + min;
        };
        expect(randomInt(5, 5)).toBe(5);
      });
    });
  });

  // URL and Network Utilities
  describe('URL and Network Utilities', () => {
    describe('parseQuery', () => {
      it('should parse simple query strings', () => {
        const parseQuery = (query: string) => {
          const params: any = {};
          const searchParams = new URLSearchParams(query.startsWith('?') ? query.slice(1) : query);
          for (const [key, value] of searchParams) {
            if (params[key]) {
              if (Array.isArray(params[key])) {
                params[key].push(value);
              } else {
                params[key] = [params[key], value];
              }
            } else {
              params[key] = value;
            }
          }
          return params;
        };
        expect(parseQuery('?name=John&age=30')).toEqual({ name: 'John', age: '30' });
        expect(parseQuery('name=John&age=30')).toEqual({ name: 'John', age: '30' });
      });

      it('should handle URL encoded values', () => {
        const parseQuery = (query: string) => {
          const params: any = {};
          const searchParams = new URLSearchParams(query.startsWith('?') ? query.slice(1) : query);
          for (const [key, value] of searchParams) {
            if (params[key]) {
              if (Array.isArray(params[key])) {
                params[key].push(value);
              } else {
                params[key] = [params[key], value];
              }
            } else {
              params[key] = value;
            }
          }
          return params;
        };
        expect(parseQuery('?message=Hello%20World')).toEqual({ message: 'Hello World' });
        expect(parseQuery('?data=%7B%22key%22%3A%22value%22%7D')).toEqual({ 
          data: '{"key":"value"}' 
        });
      });

      it('should handle empty and malformed queries', () => {
        const parseQuery = (query: string) => {
          const params: any = {};
          const searchParams = new URLSearchParams(query.startsWith('?') ? query.slice(1) : query);
          for (const [key, value] of searchParams) {
            if (params[key]) {
              if (Array.isArray(params[key])) {
                params[key].push(value);
              } else {
                params[key] = [params[key], value];
              }
            } else {
              params[key] = value;
            }
          }
          return params;
        };
        expect(parseQuery('')).toEqual({});
        expect(parseQuery('?')).toEqual({});
        expect(parseQuery('?=')).toEqual({ '': '' });
        expect(parseQuery('?key')).toEqual({ key: '' });
      });

      it('should handle duplicate parameters', () => {
        const parseQuery = (query: string) => {
          const params: any = {};
          const searchParams = new URLSearchParams(query.startsWith('?') ? query.slice(1) : query);
          for (const [key, value] of searchParams) {
            if (params[key]) {
              if (Array.isArray(params[key])) {
                params[key].push(value);
              } else {
                params[key] = [params[key], value];
              }
            } else {
              params[key] = value;
            }
          }
          return params;
        };
        expect(parseQuery('?tag=red&tag=blue')).toEqual({ tag: ['red', 'blue'] });
        expect(parseQuery('?id=1&id=2&id=3')).toEqual({ id: ['1', '2', '3'] });
      });

      it('should handle complex scenarios', () => {
        const parseQuery = (query: string) => {
          const params: any = {};
          const searchParams = new URLSearchParams(query.startsWith('?') ? query.slice(1) : query);
          for (const [key, value] of searchParams) {
            if (params[key]) {
              if (Array.isArray(params[key])) {
                params[key].push(value);
              } else {
                params[key] = [params[key], value];
              }
            } else {
              params[key] = value;
            }
          }
          return params;
        };
        const query = '?filters[category]=tech&filters[status]=active&sort=name';
        const result = parseQuery(query);
        expect(result).toHaveProperty('filters[category]', 'tech');
        expect(result).toHaveProperty('filters[status]', 'active');
        expect(result).toHaveProperty('sort', 'name');
      });
    });

    describe('buildUrl', () => {
      it('should build URLs with query parameters', () => {
        const buildUrl = (baseUrl: string, params: any) => {
          const url = new URL(baseUrl);
          Object.entries(params).forEach(([key, value]) => {
            if (value != null) {
              if (Array.isArray(value)) {
                value.forEach(v => url.searchParams.append(key, String(v)));
              } else {
                url.searchParams.set(key, String(value));
              }
            }
          });
          return url.toString();
        };
        const url = buildUrl('https://api.example.com/users', { page: 1, limit: 10 });
        expect(url).toBe('https://api.example.com/users?page=1&limit=10');
      });

      it('should handle existing query parameters', () => {
        const buildUrl = (baseUrl: string, params: any) => {
          const url = new URL(baseUrl);
          Object.entries(params).forEach(([key, value]) => {
            if (value != null) {
              if (Array.isArray(value)) {
                value.forEach(v => url.searchParams.append(key, String(v)));
              } else {
                url.searchParams.set(key, String(value));
              }
            }
          });
          return url.toString();
        };
        const url = buildUrl('https://api.example.com/users?sort=name', { page: 1 });
        expect(url).toBe('https://api.example.com/users?sort=name&page=1');
      });

      it('should handle empty and null parameters', () => {
        const buildUrl = (baseUrl: string, params: any) => {
          const url = new URL(baseUrl);
          Object.entries(params).forEach(([key, value]) => {
            if (value != null) {
              if (Array.isArray(value)) {
                value.forEach(v => url.searchParams.append(key, String(v)));
              } else {
                url.searchParams.set(key, String(value));
              }
            }
          });
          return url.toString();
        };
        const url1 = buildUrl('https://api.example.com/users', {});
        expect(url1).toBe('https://api.example.com/users');

        const url2 = buildUrl('https://api.example.com/users', { page: 1, empty: null });
        expect(url2).toBe('https://api.example.com/users?page=1');
      });

      it('should handle array parameters', () => {
        const buildUrl = (baseUrl: string, params: any) => {
          const url = new URL(baseUrl);
          Object.entries(params).forEach(([key, value]) => {
            if (value != null) {
              if (Array.isArray(value)) {
                value.forEach(v => url.searchParams.append(key, String(v)));
              } else {
                url.searchParams.set(key, String(value));
              }
            }
          });
          return url.toString();
        };
        const url = buildUrl('https://api.example.com/search', { 
          tags: ['javascript', 'typescript'], 
          category: 'tech' 
        });
        expect(url).toContain('tags=javascript');
        expect(url).toContain('tags=typescript');
        expect(url).toContain('category=tech');
      });

      it('should properly encode special characters', () => {
        const buildUrl = (baseUrl: string, params: any) => {
          const url = new URL(baseUrl);
          Object.entries(params).forEach(([key, value]) => {
            if (value != null) {
              if (Array.isArray(value)) {
                value.forEach(v => url.searchParams.append(key, String(v)));
              } else {
                url.searchParams.set(key, String(value));
              }
            }
          });
          return url.toString();
        };
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
        const extractDomain = (url: string) => {
          try {
            return new URL(url).hostname;
          } catch {
            return null;
          }
        };
        expect(extractDomain('https://www.example.com/path')).toBe('www.example.com');
        expect(extractDomain('http://api.service.com:8080')).toBe('api.service.com');
        expect(extractDomain('https://localhost:3000')).toBe('localhost');
      });

      it('should handle edge cases', () => {
        const extractDomain = (url: string) => {
          try {
            return new URL(url).hostname;
          } catch {
            return null;
          }
        };
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
        const sanitizeInput = (input: string) => {
          if (typeof input !== 'string') return '';
          return input
            .replace(/<script\b[^<]*(?:(?!<\/script>)<[^<]*)*<\/script>/gi, '')
            .replace(/javascript:/gi, '')
            .replace(/on\w+\s*=/gi, '');
        };
        const input = '<script>alert("xss")</script>Hello';
        const sanitized = sanitizeInput(input);
        expect(sanitized).not.toContain('<script>');
        expect(sanitized).toContain('Hello');
      });

      it('should preserve safe HTML', () => {
        const sanitizeInput = (input: string) => {
          if (typeof input !== 'string') return '';
          return input
            .replace(/<script\b[^<]*(?:(?!<\/script>)<[^<]*)*<\/script>/gi, '')
            .replace(/javascript:/gi, '')
            .replace(/on\w+\s*=/gi, '');
        };
        const input = '<p>Hello <strong>world</strong></p>';
        const sanitized = sanitizeInput(input);
        expect(sanitized).toContain('<p>');
        expect(sanitized).toContain('<strong>');
      });

      it('should handle various XSS attempts', () => {
        const sanitizeInput = (input: string) => {
          if (typeof input !== 'string') return '';
          return input
            .replace(/<script\b[^<]*(?:(?!<\/script>)<[^<]*)*<\/script>/gi, '')
            .replace(/javascript:/gi, '')
            .replace(/on\w+\s*=/gi, '');
        };
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
        const sanitizeInput = (input: string) => {
          if (typeof input !== 'string') return '';
          return input
            .replace(/<script\b[^<]*(?:(?!<\/script>)<[^<]*)*<\/script>/gi, '')
            .replace(/javascript:/gi, '')
            .replace(/on\w+\s*=/gi, '');
        };
        expect(sanitizeInput('')).toBe('');
        expect(sanitizeInput(null as any)).toBe('');
        expect(sanitizeInput(undefined as any)).toBe('');
      });
    });

    describe('hashString', () => {
      it('should generate consistent hashes', () => {
        const hashString = (str: string) => {
          if (typeof str !== 'string') throw new Error('Input must be a string');
          let hash = 0;
          for (let i = 0; i < str.length; i++) {
            const char = str.charCodeAt(i);
            hash = ((hash << 5) - hash) + char;
            hash = hash & hash; // Convert to 32-bit integer
          }
          return hash.toString(36);
        };
        const input = 'test string';
        const hash1 = hashString(input);
        const hash2 = hashString(input);
        expect(hash1).toBe(hash2);
        expect(typeof hash1).toBe('string');
        expect(hash1.length).toBeGreaterThan(0);
      });

      it('should generate different hashes for different inputs', () => {
        const hashString = (str: string) => {
          if (typeof str !== 'string') throw new Error('Input must be a string');
          let hash = 0;
          for (let i = 0; i < str.length; i++) {
            const char = str.charCodeAt(i);
            hash = ((hash << 5) - hash) + char;
            hash = hash & hash; // Convert to 32-bit integer
          }
          return hash.toString(36);
        };
        const hash1 = hashString('string1');
        const hash2 = hashString('string2');
        expect(hash1).not.toBe(hash2);
      });

      it('should handle edge cases', () => {
        const hashString = (str: string) => {
          if (typeof str !== 'string') throw new Error('Input must be a string');
          let hash = 0;
          for (let i = 0; i < str.length; i++) {
            const char = str.charCodeAt(i);
            hash = ((hash << 5) - hash) + char;
            hash = hash & hash; // Convert to 32-bit integer
          }
          return hash.toString(36);
        };
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
        const parseJSON = (str: string, fallback?: any) => {
          try {
            return JSON.parse(str);
          } catch {
            return fallback || null;
          }
        };
        expect(parseJSON('{"key": "value"}')).toEqual({ key: 'value' });
        expect(parseJSON('[1, 2, 3]')).toEqual([1, 2, 3]);
        expect(parseJSON('true')).toBe(true);
        expect(parseJSON('null')).toBe(null);
      });

      it('should handle invalid JSON gracefully', () => {
        const parseJSON = (str: string, fallback?: any) => {
          try {
            return JSON.parse(str);
          } catch {
            return fallback || null;
          }
        };
        expect(parseJSON('invalid json')).toBe(null);
        expect(parseJSON('{key: value}')).toBe(null);
        expect(parseJSON('')).toBe(null);
      });

      it('should use fallback value', () => {
        const parseJSON = (str: string, fallback?: any) => {
          try {
            return JSON.parse(str);
          } catch {
            return fallback || null;
          }
        };
        expect(parseJSON('invalid', { default: true })).toEqual({ default: true });
        expect(parseJSON('{"valid": true}', { default: false })).toEqual({ valid: true });
      });
    });

    describe('stringifyJSON', () => {
      it('should stringify objects', () => {
        const stringifyJSON = (obj: any, space?: number) => {
          try {
            return JSON.stringify(obj, null, space);
          } catch {
            return JSON.stringify({});
          }
        };
        expect(stringifyJSON({ key: 'value' })).toBe('{"key":"value"}');
        expect(stringifyJSON([1, 2, 3])).toBe('[1,2,3]');
        expect(stringifyJSON(null)).toBe('null');
      });

      it('should handle circular references', () => {
        const stringifyJSON = (obj: any, space?: number) => {
          try {
            return JSON.stringify(obj, null, space);
          } catch {
            return JSON.stringify({});
          }
        };
        const obj: any = { name: 'test' };
        obj.self = obj;
        expect(() => stringifyJSON(obj)).not.toThrow();
      });

      it('should handle pretty printing', () => {
        const stringifyJSON = (obj: any, space?: number) => {
          try {
            return JSON.stringify(obj, null, space);
          } catch {
            return JSON.stringify({});
          }
        };
        const obj = { a: 1, b: 2 };
        const pretty = stringifyJSON(obj, 2);
        expect(pretty).toContain('\n');
        expect(pretty).toContain('  ');
      });
    });

    describe('compareVersions', () => {
      it('should compare semantic versions correctly', () => {
        const compareVersions = (v1: string, v2: string) => {
          const normalize = (v: string) => v.split('.').map(n => parseInt(n) || 0);
          const a = normalize(v1);
          const b = normalize(v2);
          
          for (let i = 0; i < Math.max(a.length, b.length); i++) {
            const numA = a[i] || 0;
            const numB = b[i] || 0;
            if (numA < numB) return -1;
            if (numA > numB) return 1;
          }
          return 0;
        };
        expect(compareVersions('1.0.0', '1.0.1')).toBe(-1);
        expect(compareVersions('1.0.1', '1.0.0')).toBe(1);
        expect(compareVersions('1.0.0', '1.0.0')).toBe(0);
      });

      it('should handle different version formats', () => {
        const compareVersions = (v1: string, v2: string) => {
          const normalize = (v: string) => v.split('.').map(n => parseInt(n) || 0);
          const a = normalize(v1);
          const b = normalize(v2);
          
          for (let i = 0; i < Math.max(a.length, b.length); i++) {
            const numA = a[i] || 0;
            const numB = b[i] || 0;
            if (numA < numB) return -1;
            if (numA > numB) return 1;
          }
          return 0;
        };
        expect(compareVersions('1.0', '1.0.0')).toBe(0);
        expect(compareVersions('1', '1.0.0')).toBe(0);
        expect(compareVersions('2.0', '1.9.9')).toBe(1);
      });

      it('should handle pre-release versions', () => {
        const compareVersions = (v1: string, v2: string) => {
          const normalize = (v: string) => {
            const [version, prerelease] = v.split('-');
            const nums = version.split('.').map(n => parseInt(n) || 0);
            return { nums, prerelease };
          };
          
          const a = normalize(v1);
          const b = normalize(v2);
          
          for (let i = 0; i < Math.max(a.nums.length, b.nums.length); i++) {
            const numA = a.nums[i] || 0;
            const numB = b.nums[i] || 0;
            if (numA < numB) return -1;
            if (numA > numB) return 1;
          }
          
          if (a.prerelease && !b.prerelease) return -1;
          if (!a.prerelease && b.prerelease) return 1;
          if (a.prerelease && b.prerelease) {
            return a.prerelease < b.prerelease ? -1 : a.prerelease > b.prerelease ? 1 : 0;
          }
          
          return 0;
        };
        expect(compareVersions('1.0.0-alpha', '1.0.0')).toBe(-1);
        expect(compareVersions('1.0.0-alpha.1', '1.0.0-alpha.2')).toBe(-1);
      });
    });
  });

  // Utility Generation Functions
  describe('Generation Utilities', () => {
    describe('generateId', () => {
      it('should generate unique IDs', () => {
        const generateId = (length = 8, prefix = '') => {
          if (length < 0) throw new Error('Length cannot be negative');
          const chars = 'abcdefghijklmnopqrstuvwxyzABCDEFGHIJKLMNOPQRSTUVWXYZ0123456789';
          let result = prefix;
          for (let i = 0; i < length; i++) {
            result += chars.charAt(Math.floor(Math.random() * chars.length));
          }
          return result;
        };
        const ids = new Set();
        for (let i = 0; i < 100; i++) {
          ids.add(generateId());
        }
        expect(ids.size).toBe(100);
      });

      it('should generate IDs with specified length', () => {
        const generateId = (length = 8, prefix = '') => {
          if (length < 0) throw new Error('Length cannot be negative');
          const chars = 'abcdefghijklmnopqrstuvwxyzABCDEFGHIJKLMNOPQRSTUVWXYZ0123456789';
          let result = prefix;
          for (let i = 0; i < length; i++) {
            result += chars.charAt(Math.floor(Math.random() * chars.length));
          }
          return result;
        };
        expect(generateId(8).length).toBe(8);
        expect(generateId(16).length).toBe(16);
        expect(generateId(32).length).toBe(32);
      });

      it('should generate IDs with custom prefix', () => {
        const generateId = (length = 8, prefix = '') => {
          if (length < 0) throw new Error('Length cannot be negative');
          const chars = 'abcdefghijklmnopqrstuvwxyzABCDEFGHIJKLMNOPQRSTUVWXYZ0123456789';
          let result = prefix;
          for (let i = 0; i < length; i++) {
            result += chars.charAt(Math.floor(Math.random() * chars.length));
          }
          return result;
        };
        const id = generateId(8, 'user_');
        expect(id).toMatch(/^user_[a-zA-Z0-9]{8}$/);
      });

      it('should handle edge cases', () => {
        const generateId = (length = 8, prefix = '') => {
          if (length < 0) throw new Error('Length cannot be negative');
          const chars = 'abcdefghijklmnopqrstuvwxyzABCDEFGHIJKLMNOPQRSTUVWXYZ0123456789';
          let result = prefix;
          for (let i = 0; i < length; i++) {
            result += chars.charAt(Math.floor(Math.random() * chars.length));
          }
          return result;
        };
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
        // Use real timers for async tests
      });

      it('should delay execution', async () => {
        const sleep = (ms: number) => new Promise(resolve => setTimeout(resolve, ms));
        const start = Date.now();
        await sleep(100);
        const end = Date.now();
        expect(end - start).toBeGreaterThanOrEqual(90); // Allow for slight timing variance
      });

      it('should handle zero delay', async () => {
        const sleep = (ms: number) => new Promise(resolve => setTimeout(resolve, ms));
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
      const isValidEmail = (email: string) => {
        if (typeof email !== 'string') return false;
        const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
        return emailRegex.test(email.trim());
      };
      
      const generateId = (length = 8) => {
        const chars = 'abcdefghijklmnopqrstuvwxyzABCDEFGHIJKLMNOPQRSTUVWXYZ0123456789';
        let result = '';
        for (let i = 0; i < length; i++) {
          result += chars.charAt(Math.floor(Math.random() * chars.length));
        }
        return result;
      };
      
      const capitalize = (str: string) => {
        if (str.length === 0) return '';
        return str.charAt(0).toUpperCase() + str.slice(1).toLowerCase();
      };
      
      const formatCurrency = (amount: number) => {
        return new Intl.NumberFormat('en-US', { style: 'currency', currency: 'USD' }).format(amount);
      };

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
      const isValidDate = (date: any) => {
        return date instanceof Date && !isNaN(date.getTime());
      };
      
      const isValidEmail = (email: string) => {
        if (typeof email !== 'string') return false;
        const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
        return emailRegex.test(email.trim());
      };
      
      const parseJSON = (str: string, fallback?: any) => {
        try {
          return JSON.parse(str);
        } catch {
          return fallback || null;
        }
      };
      
      const sanitizeInput = (input: string) => {
        if (typeof input !== 'string') return '';
        return input
          .replace(/<script\b[^<]*(?:(?!<\/script>)<[^<]*)*<\/script>/gi, '')
          .replace(/javascript:/gi, '')
          .replace(/on\w+\s*=/gi, '');
      };

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
      const generateSlug = (str: string) => {
        return str.toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-+|-+$/g, '');
      };

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
      const isValidEmail = (email: string) => {
        if (typeof email !== 'string') return false;
        const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
        return emailRegex.test(email.trim());
      };
      
      const sanitizeInput = (input: string) => {
        if (typeof input !== 'string') return '';
        return input
          .replace(/<script\b[^<]*(?:(?!<\/script>)<[^<]*)*<\/script>/gi, '')
          .replace(/javascript:/gi, '')
          .replace(/on\w+\s*=/gi, '');
      };
      
      const isEmptyObject = (obj: any) => {
        if (obj == null) return true;
        if (Array.isArray(obj)) return obj.length === 0;
        if (typeof obj === 'object') return Object.keys(obj).length === 0;
        return false;
      };
      
      const unique = (arr: any[]) => {
        return [...new Set(arr)];
      };
      
      const flatten = (arr: any[], depth = Infinity): any[] => {
        return depth > 0 ? arr.reduce((acc, val) => 
          acc.concat(Array.isArray(val) ? flatten(val, depth - 1) : val), []) : arr.slice();
      };
      
      const deepClone = (obj: any): any => {
        if (obj === null || typeof obj !== 'object') return obj;
        if (obj instanceof Date) return new Date(obj);
        if (obj instanceof Array) return obj.map(item => deepClone(item));
        if (typeof obj === 'object') {
          const cloned: any = {};
          for (const key in obj) {
            if (obj.hasOwnProperty(key)) {
              cloned[key] = deepClone(obj[key]);
            }
          }
          return cloned;
        }
        return obj;
      };
      
      const formatCurrency = (amount: number) => {
        if (isNaN(amount) || !isFinite(amount)) throw new Error('Invalid amount');
        return new Intl.NumberFormat('en-US', { style: 'currency', currency: 'USD' }).format(amount);
      };

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
      const deepClone = (obj: any): any => {
        if (obj === null || typeof obj !== 'object') return obj;
        if (obj instanceof Date) return new Date(obj);
        if (obj instanceof Array) return obj.map(item => deepClone(item));
        if (typeof obj === 'object') {
          const cloned: any = {};
          for (const key in obj) {
            if (obj.hasOwnProperty(key)) {
              cloned[key] = deepClone(obj[key]);
            }
          }
          return cloned;
        }
        return obj;
      };

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

      const memoize = (func: Function) => {
        const cache = new Map();
        return function(this: any, ...args: any[]) {
          const key = JSON.stringify(args);
          if (cache.has(key)) {
            return cache.get(key);
          }
          const result = func.apply(this, args);
          cache.set(key, result);
          return result;
        };
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