// @ts-ignore
import { checkSolvers, validateSolverResponse, loadSolverConfig, SolverConfig, SolverResult } from './check_solvers';

jest.mock('axios');
jest.mock('fs/promises');

let mockAxios: jest.Mocked<typeof import('axios')>;
let mockFs: jest.Mocked<typeof import('fs/promises')>;

describe('checkSolvers', () => {
  beforeEach(() => {
    mockAxios = require('axios');
    mockFs = require('fs/promises');
    jest.clearAllMocks();
    jest.spyOn(Date, 'now').mockReturnValue(1000000);
  });

  afterEach(() => {
    jest.restoreAllMocks();
  });

  describe('Happy Path Scenarios', () => {
    it('should successfully check all solvers when all are healthy', async () => {
      const mockSolvers: SolverConfig[] = [
        { name: 'solver1', url: 'http://solver1.com', timeout: 5000 },
        { name: 'solver2', url: 'http://solver2.com', timeout: 3000 }
      ];

      mockAxios.get
        .mockResolvedValueOnce({ 
          status: 200, 
          data: { status: 'healthy', version: '1.0.0' } 
        })
        .mockResolvedValueOnce({ 
          status: 200, 
          data: { status: 'healthy', version: '2.0.0' } 
        });

      const result = await checkSolvers(mockSolvers);

      expect(result).toHaveLength(2);
      expect(result[0]).toEqual({
        name: 'solver1',
        status: 'healthy',
        responseTime: 0,
        version: '1.0.0'
      });
      expect(result[1]).toEqual({
        name: 'solver2',
        status: 'healthy',
        responseTime: 0,
        version: '2.0.0'
      });
    });

    it('should handle solvers with no version in response', async () => {
      const mockSolvers: SolverConfig[] = [
        { name: 'no-version-solver', url: 'http://example.com', timeout: 5000 }
      ];

      mockAxios.get.mockResolvedValueOnce({ 
        status: 200, 
        data: { status: 'healthy' } 
      });

      const result = await checkSolvers(mockSolvers);

      expect(result[0]).toEqual({
        name: 'no-version-solver',
        status: 'healthy',
        responseTime: 0,
        version: undefined
      });
    });

    it('should use default timeout when not specified', async () => {
      const mockSolvers: SolverConfig[] = [
        { name: 'default-timeout', url: 'http://example.com' }
      ];

      mockAxios.get.mockResolvedValueOnce({ 
        status: 200, 
        data: { status: 'healthy' } 
      });

      await checkSolvers(mockSolvers);

      expect(mockAxios.get).toHaveBeenCalledWith('http://example.com/health', { timeout: 5000 });
    });

    it('should respect custom timeout configurations', async () => {
      const mockSolvers: SolverConfig[] = [
        { name: 'custom-timeout', url: 'http://example.com', timeout: 10000 }
      ];

      mockAxios.get.mockResolvedValueOnce({ 
        status: 200, 
        data: { status: 'healthy' } 
      });

      await checkSolvers(mockSolvers);

      expect(mockAxios.get).toHaveBeenCalledWith('http://example.com/health', { timeout: 10000 });
    });
  });

  describe('Edge Cases', () => {
    it('should handle empty solver list', async () => {
      const result = await checkSolvers([]);
      expect(result).toEqual([]);
    });

    it('should handle mixed solver statuses correctly', async () => {
      const mockSolvers: SolverConfig[] = [
        { name: 'healthy-solver', url: 'http://healthy.com', timeout: 5000 },
        { name: 'unhealthy-solver', url: 'http://unhealthy.com', timeout: 5000 }
      ];

      mockAxios.get
        .mockResolvedValueOnce({ 
          status: 200, 
          data: { status: 'healthy', version: '1.0.0' } 
        })
        .mockRejectedValueOnce(new Error('Connection failed'));

      const result = await checkSolvers(mockSolvers);

      expect(result).toHaveLength(2);
      expect(result[0]).toEqual({
        name: 'healthy-solver',
        status: 'healthy',
        responseTime: 0,
        version: '1.0.0'
      });
      expect(result[1]).toEqual({
        name: 'unhealthy-solver',
        status: 'unhealthy',
        responseTime: 0,
        error: 'Connection failed'
      });
    });

    it('should handle solvers with zero timeout', async () => {
      const mockSolvers: SolverConfig[] = [
        { name: 'zero-timeout', url: 'http://example.com', timeout: 0 }
      ];

      mockAxios.get.mockResolvedValueOnce({ 
        status: 200, 
        data: { status: 'healthy' } 
      });

      await checkSolvers(mockSolvers);

      expect(mockAxios.get).toHaveBeenCalledWith('http://example.com/health', { timeout: 0 });
    });

    it('should handle very large solver lists', async () => {
      const mockSolvers: SolverConfig[] = Array.from({ length: 50 }, (_, i) => ({
        name: `solver-${i}`,
        url: `http://solver${i}.com`,
        timeout: 1000
      }));

      mockAxios.get.mockResolvedValue({ 
        status: 200, 
        data: { status: 'healthy' } 
      });

      const result = await checkSolvers(mockSolvers);

      expect(result).toHaveLength(50);
      expect(mockAxios.get).toHaveBeenCalledTimes(50);
      expect(result.every((r: SolverResult) => r.status === 'healthy')).toBe(true);
    });

    it('should handle solvers with special characters in names', async () => {
      const mockSolvers: SolverConfig[] = [
        { name: 'solver-with-special!@#$%^&*()chars', url: 'http://example.com', timeout: 5000 }
      ];

      mockAxios.get.mockResolvedValueOnce({ 
        status: 200, 
        data: { status: 'healthy' } 
      });

      const result = await checkSolvers(mockSolvers);

      expect(result[0].name).toBe('solver-with-special!@#$%^&*()chars');
      expect(result[0].status).toBe('healthy');
    });
  });

  describe('Failure Conditions', () => {
    it('should handle network timeout errors', async () => {
      const mockSolvers: SolverConfig[] = [
        { name: 'timeout-solver', url: 'http://timeout.com', timeout: 1000 }
      ];

      const timeoutError = new Error('timeout of 1000ms exceeded');
      timeoutError.name = 'ECONNABORTED';
      mockAxios.get.mockRejectedValueOnce(timeoutError);

      const result = await checkSolvers(mockSolvers);

      expect(result[0]).toEqual({
        name: 'timeout-solver',
        status: 'unhealthy',
        responseTime: 0,
        error: 'timeout of 1000ms exceeded'
      });
    });

    it('should handle HTTP 404 errors', async () => {
      const mockSolvers: SolverConfig[] = [
        { name: 'not-found-solver', url: 'http://example.com', timeout: 5000 }
      ];

      const notFoundError = {
        response: { 
          status: 404, 
          statusText: 'Not Found',
          data: 'Page not found' 
        },
        message: 'Request failed with status code 404'
      };
      mockAxios.get.mockRejectedValueOnce(notFoundError);

      const result = await checkSolvers(mockSolvers);

      expect(result[0].status).toBe('unhealthy');
      expect(result[0].error).toBe('Request failed with status code 404');
    });

    it('should handle HTTP 500 errors', async () => {
      const mockSolvers: SolverConfig[] = [
        { name: 'server-error', url: 'http://error.com', timeout: 5000 }
      ];

      const serverError = {
        response: { 
          status: 500, 
          statusText: 'Internal Server Error' 
        },
        message: 'Request failed with status code 500'
      };
      mockAxios.get.mockRejectedValueOnce(serverError);

      const result = await checkSolvers(mockSolvers);

      expect(result[0].status).toBe('unhealthy');
      expect(result[0].error).toBe('Request failed with status code 500');
    });

    it('should handle DNS resolution failures', async () => {
      const mockSolvers: SolverConfig[] = [
        { name: 'dns-fail', url: 'http://nonexistent.domain', timeout: 5000 }
      ];

      const dnsError = new Error('getaddrinfo ENOTFOUND nonexistent.domain');
      dnsError.name = 'ENOTFOUND';
      mockAxios.get.mockRejectedValueOnce(dnsError);

      const result = await checkSolvers(mockSolvers);

      expect(result[0].status).toBe('unhealthy');
      expect(result[0].error).toBe('getaddrinfo ENOTFOUND nonexistent.domain');
    });

    it('should handle connection refused errors', async () => {
      const mockSolvers: SolverConfig[] = [
        { name: 'refused-solver', url: 'http://localhost:9999', timeout: 5000 }
      ];

      const connError = new Error('connect ECONNREFUSED 127.0.0.1:9999');
      connError.name = 'ECONNREFUSED';
      mockAxios.get.mockRejectedValueOnce(connError);

      const result = await checkSolvers(mockSolvers);

      expect(result[0].status).toBe('unhealthy');
      expect(result[0].error).toBe('connect ECONNREFUSED 127.0.0.1:9999');
    });

    it('should handle non-Error exceptions', async () => {
      const mockSolvers: SolverConfig[] = [
        { name: 'weird-error', url: 'http://example.com', timeout: 5000 }
      ];

      mockAxios.get.mockRejectedValueOnce('String error');

      const result = await checkSolvers(mockSolvers);

      expect(result[0].status).toBe('unhealthy');
      expect(result[0].error).toBe('Unknown error');
    });

    it('should handle null response data', async () => {
      const mockSolvers: SolverConfig[] = [
        { name: 'null-data', url: 'http://example.com', timeout: 5000 }
      ];

      mockAxios.get.mockResolvedValueOnce({ 
        status: 200, 
        data: null 
      });

      const result = await checkSolvers(mockSolvers);

      expect(result[0].status).toBe('healthy');
      expect(result[0].version).toBeUndefined();
    });
  });

  describe('Response Time Tracking', () => {
    it('should accurately track response times', async () => {
      const mockSolvers: SolverConfig[] = [
        { name: 'timed-solver', url: 'http://example.com', timeout: 5000 }
      ];

      let callCount = 0;
      jest.spyOn(Date, 'now').mockImplementation(() => {
        callCount++;
        return callCount === 1 ? 1000 : 1250;
      });

      mockAxios.get.mockResolvedValueOnce({ 
        status: 200, 
        data: { status: 'healthy' } 
      });

      const result = await checkSolvers(mockSolvers);

      expect(result[0].responseTime).toBe(250);
    });

    it('should track response time even for failed requests', async () => {
      const mockSolvers: SolverConfig[] = [
        { name: 'failed-solver', url: 'http://example.com', timeout: 5000 }
      ];

      let callCount = 0;
      jest.spyOn(Date, 'now').mockImplementation(() => {
        callCount++;
        return callCount === 1 ? 1000 : 1500;
      });

      mockAxios.get.mockRejectedValueOnce(new Error('Request failed'));

      const result = await checkSolvers(mockSolvers);

      expect(result[0].responseTime).toBe(500);
      expect(result[0].status).toBe('unhealthy');
    });
  });

  describe('Concurrent Execution', () => {
    it('should handle concurrent solver checks', async () => {
      const mockSolvers: SolverConfig[] = [
        { name: 'solver1', url: 'http://solver1.com', timeout: 5000 },
        { name: 'solver2', url: 'http://solver2.com', timeout: 5000 },
        { name: 'solver3', url: 'http://solver3.com', timeout: 5000 }
      ];

      let resolve1: (value: any) => void;
      let resolve2: (value: any) => void;
      let reject3: (error: any) => void;

      const promise1 = new Promise(resolve => { resolve1 = resolve; });
      const promise2 = new Promise(resolve => { resolve2 = resolve; });
      const promise3 = new Promise((_, reject) => { reject3 = reject; });

      mockAxios.get
        .mockReturnValueOnce(promise1 as any)
        .mockReturnValueOnce(promise2 as any)
        .mockReturnValueOnce(promise3 as any);

      const resultPromise = checkSolvers(mockSolvers);

      reject3!(new Error('Solver 3 failed'));
      resolve2!({ status: 200, data: { status: 'healthy' } });
      resolve1!({ status: 200, data: { status: 'healthy' } });

      const result = await resultPromise;

      expect(result).toHaveLength(3);
      expect(result[0].status).toBe('healthy');
      expect(result[1].status).toBe('healthy');
      expect(result[2].status).toBe('unhealthy');
      expect(result[2].error).toBe('Solver 3 failed');
    });
  });
});

describe('validateSolverResponse', () => {
  describe('Valid Responses', () => {
    it('should validate healthy response with all optional fields', () => {
      const response = {
        status: 'healthy',
        version: '1.0.0',
        uptime: 3600,
        memory: { used: 100, total: 1000 }
      };

      expect(() => validateSolverResponse(response)).not.toThrow();
    });

    it('should validate minimal healthy response', () => {
      const response = { status: 'healthy' };

      expect(() => validateSolverResponse(response)).not.toThrow();
    });

    it('should validate unhealthy response', () => {
      const response = { status: 'unhealthy' };

      expect(() => validateSolverResponse(response)).not.toThrow();
    });

    it('should validate response with extra fields', () => {
      const response = {
        status: 'healthy',
        customField: 'custom value',
        anotherField: 123
      };

      expect(() => validateSolverResponse(response)).not.toThrow();
    });
  });

  describe('Invalid Responses', () => {
    it('should reject null response', () => {
      expect(() => validateSolverResponse(null)).toThrow('Response must be an object');
    });

    it('should reject undefined response', () => {
      expect(() => validateSolverResponse(undefined)).toThrow('Response must be an object');
    });

    it('should reject string response', () => {
      expect(() => validateSolverResponse('healthy')).toThrow('Response must be an object');
    });

    it('should reject number response', () => {
      expect(() => validateSolverResponse(123)).toThrow('Response must be an object');
    });

    it('should reject array response', () => {
      expect(() => validateSolverResponse(['healthy'])).toThrow('Response must be an object');
    });

    it('should reject response without status field', () => {
      const response = { version: '1.0.0' };

      expect(() => validateSolverResponse(response)).toThrow('Missing required status field');
    });

    it('should reject response with null status', () => {
      const response = { status: null };

      expect(() => validateSolverResponse(response)).toThrow('Missing required status field');
    });

    it('should reject response with undefined status', () => {
      const response = { status: undefined };

      expect(() => validateSolverResponse(response)).toThrow('Missing required status field');
    });

    it('should reject response with empty string status', () => {
      const response = { status: '' };

      expect(() => validateSolverResponse(response)).toThrow('Missing required status field');
    });

    it('should reject response with invalid status value', () => {
      const response = { status: 'unknown' };

      expect(() => validateSolverResponse(response)).toThrow('Invalid status value');
    });

    it('should reject response with numeric status', () => {
      const response = { status: 1 };

      expect(() => validateSolverResponse(response)).toThrow('Invalid status value');
    });

    it('should reject response with boolean status', () => {
      const response = { status: true };

      expect(() => validateSolverResponse(response)).toThrow('Invalid status value');
    });
  });
});

describe('loadSolverConfig', () => {
  beforeEach(() => {
    mockFs = require('fs/promises');
    jest.clearAllMocks();
  });

  describe('Valid Config Loading', () => {
    it('should load valid solver configuration from file', async () => {
      const mockConfig = [
        { name: 'solver1', url: 'http://solver1.com', timeout: 5000 },
        { name: 'solver2', url: 'http://solver2.com' }
      ];
      const mockConfigJson = JSON.stringify(mockConfig);

      mockFs.readFile.mockResolvedValueOnce(mockConfigJson);

      const result = await loadSolverConfig('config/solvers.json');

      expect(mockFs.readFile).toHaveBeenCalledWith('config/solvers.json', 'utf8');
      expect(result).toEqual(mockConfig);
    });

    it('should load empty configuration array', async () => {
      const mockConfigJson = JSON.stringify([]);

      mockFs.readFile.mockResolvedValueOnce(mockConfigJson);

      const result = await loadSolverConfig('empty-config.json');

      expect(result).toEqual([]);
    });

    it('should handle config with minimal solver entries', async () => {
      const mockConfig = [
        { name: 'minimal-solver', url: 'http://minimal.com' }
      ];
      const mockConfigJson = JSON.stringify(mockConfig);

      mockFs.readFile.mockResolvedValueOnce(mockConfigJson);

      const result = await loadSolverConfig('minimal-config.json');

      expect(result).toEqual(mockConfig);
    });
  });

  describe('Error Handling', () => {
    it('should handle file not found error', async () => {
      const fileError = new Error('ENOENT: no such file or directory');
      fileError.name = 'ENOENT';
      mockFs.readFile.mockRejectedValueOnce(fileError);

      await expect(loadSolverConfig('nonexistent.json'))
        .rejects
        .toThrow('Failed to load solver config: ENOENT: no such file or directory');
    });

    it('should handle permission denied error', async () => {
      const permError = new Error('EACCES: permission denied');
      permError.name = 'EACCES';
      mockFs.readFile.mockRejectedValueOnce(permError);

      await expect(loadSolverConfig('restricted.json'))
        .rejects
        .toThrow('Failed to load solver config: EACCES: permission denied');
    });

    it('should handle invalid JSON format', async () => {
      mockFs.readFile.mockResolvedValueOnce('{ invalid json }');

      await expect(loadSolverConfig('invalid.json'))
        .rejects
        .toThrow('Failed to load solver config:');
    });

    it('should handle empty file', async () => {
      mockFs.readFile.mockResolvedValueOnce('');

      await expect(loadSolverConfig('empty.json'))
        .rejects
        .toThrow('Failed to load solver config:');
    });

    it('should handle non-string error objects', async () => {
      mockFs.readFile.mockRejectedValueOnce({ code: 'UNKNOWN_ERROR' });

      await expect(loadSolverConfig('error.json'))
        .rejects
        .toThrow('Failed to load solver config: Unknown error');
    });

    it('should handle files with BOM (Byte Order Mark)', async () => {
      const mockConfig = [{ name: 'bom-solver', url: 'http://example.com' }];
      const bomJson = '\uFEFF' + JSON.stringify(mockConfig);

      mockFs.readFile.mockResolvedValueOnce(bomJson);

      const result = await loadSolverConfig('bom-config.json');

      expect(result).toEqual(mockConfig);
    });
  });

  describe('Edge Cases', () => {
    it('should handle config with extra whitespace', async () => {
      const mockConfig = [{ name: 'solver', url: 'http://example.com' }];
      const whitespaceJson = `
        
        ${JSON.stringify(mockConfig)}
        
      `;

      mockFs.readFile.mockResolvedValueOnce(whitespaceJson);

      const result = await loadSolverConfig('whitespace-config.json');

      expect(result).toEqual(mockConfig);
    });

    it('should handle different file paths and extensions', async () => {
      const mockConfig = [{ name: 'solver', url: 'http://example.com' }];
      const mockConfigJson = JSON.stringify(mockConfig);

      mockFs.readFile.mockResolvedValue(mockConfigJson);

      await expect(loadSolverConfig('config.json')).resolves.toEqual(mockConfig);
      await expect(loadSolverConfig('./config/solvers.json')).resolves.toEqual(mockConfig);
      await expect(loadSolverConfig('/absolute/path/config.json')).resolves.toEqual(mockConfig);
      await expect(loadSolverConfig('config-with-dashes.json')).resolves.toEqual(mockConfig);
    });
  });
});

describe('Integration Tests', () => {
  beforeEach(() => {
    mockAxios = require('axios');
    mockFs = require('fs/promises');
    jest.clearAllMocks();
  });

  it('should handle complete workflow: load config and check solvers', async () => {
    const mockConfig = [
      { name: 'primary-solver', url: 'http://primary.com', timeout: 5000 },
      { name: 'backup-solver', url: 'http://backup.com', timeout: 3000 }
    ];
    const mockConfigJson = JSON.stringify(mockConfig);

    mockFs.readFile.mockResolvedValueOnce(mockConfigJson);
    mockAxios.get
      .mockResolvedValueOnce({ 
        status: 200, 
        data: { status: 'healthy', version: '2.1.0' } 
      })
      .mockRejectedValueOnce(new Error('Service unavailable'));

    const solvers = await loadSolverConfig('config.json');
    const results = await checkSolvers(solvers);

    expect(results).toHaveLength(2);
    expect(results[0].status).toBe('healthy');
    expect(results[0].version).toBe('2.1.0');
    expect(results[1].status).toBe('unhealthy');
    expect(results[1].error).toBe('Service unavailable');
  });

  it('should handle realistic production scenario', async () => {
    const mockConfig = [
      { name: 'solver-us-east', url: 'https://solver.us-east.company.com', timeout: 8000 },
      { name: 'solver-eu-west', url: 'https://solver.eu-west.company.com', timeout: 12000 },
      { name: 'solver-asia', url: 'https://solver.asia.company.com', timeout: 15000 }
    ];

    mockAxios.get
      .mockResolvedValueOnce({ 
        status: 200, 
        data: { 
          status: 'healthy', 
          version: '3.2.1',
          uptime: 86400,
          region: 'us-east-1'
        } 
      })
      .mockResolvedValueOnce({ 
        status: 200, 
        data: { 
          status: 'healthy', 
          version: '3.2.0',
          uptime: 172800,
          region: 'eu-west-1'
        } 
      })
      .mockRejectedValueOnce({
        response: { status: 503, statusText: 'Service Unavailable' },
        message: 'Request failed with status code 503'
      });

    const results = await checkSolvers(mockConfig);

    expect(results).toHaveLength(3);
    
    expect(results[0].name).toBe('solver-us-east');
    expect(results[0].status).toBe('healthy');
    expect(results[0].version).toBe('3.2.1');
    
    expect(results[1].name).toBe('solver-eu-west');
    expect(results[1].status).toBe('healthy');
    expect(results[1].version).toBe('3.2.0');
    
    expect(results[2].name).toBe('solver-asia');
    expect(results[2].status).toBe('unhealthy');
    expect(results[2].error).toBe('Request failed with status code 503');
  });
});

describe('Type Safety and Interface Compliance', () => {
  describe('SolverConfig Interface', () => {
    it('should accept valid solver configurations', () => {
      const validConfigs: SolverConfig[] = [
        { name: 'solver1', url: 'http://example.com' },
        { name: 'solver2', url: 'https://secure.com', timeout: 10000 },
        { name: 'solver3', url: 'http://localhost:8080', timeout: 1000 }
      ];

      validConfigs.forEach(config => {
        expect(config.name).toBeDefined();
        expect(config.url).toBeDefined();
        expect(typeof config.name).toBe('string');
        expect(typeof config.url).toBe('string');
        if (config.timeout !== undefined) {
          expect(typeof config.timeout).toBe('number');
        }
      });
    });
  });

  describe('SolverResult Interface', () => {
    it('should validate healthy solver result structure', () => {
      const healthyResult: SolverResult = {
        name: 'test-solver',
        status: 'healthy',
        responseTime: 150,
        version: '1.0.0'
      };

      expect(healthyResult.name).toBeDefined();
      expect(['healthy', 'unhealthy']).toContain(healthyResult.status);
      expect(typeof healthyResult.responseTime).toBe('number');
      expect(healthyResult.responseTime).toBeGreaterThanOrEqual(0);
    });

    it('should validate unhealthy solver result structure', () => {
      const unhealthyResult: SolverResult = {
        name: 'test-solver',
        status: 'unhealthy',
        responseTime: 5000,
        error: 'Connection timeout'
      };

      expect(unhealthyResult.name).toBeDefined();
      expect(unhealthyResult.status).toBe('unhealthy');
      expect(unhealthyResult.error).toBeDefined();
      expect(typeof unhealthyResult.error).toBe('string');
    });
  });
});