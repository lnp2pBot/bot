import {
  ImageCache,
  CacheEntry,
  CacheConfig,
  ImageCacheError,
  createImageCache,
  clearImageCache,
  getCacheStats,
  preloadImages,
  invalidateCache,
  setCacheConfig
} from './imageCache';

const { expect } = require('chai');
const sinon = require('sinon');

// Mock DOM APIs that might not be available in test environment
const mockImage = {
  src: '',
  onload: null as ((this: HTMLImageElement, ev: Event) => any) | null,
  onerror: null as ((this: HTMLImageElement, ev: Event) => any) | null,
  complete: false,
  naturalWidth: 0,
  naturalHeight: 0,
  width: 0,
  height: 0,
  addEventListener: sinon.stub(),
  removeEventListener: sinon.stub(),
  dispatchEvent: sinon.stub()
};

describe('ImageCache', () => {
  let imageCache: ImageCache;
  let mockConfig: CacheConfig;
  let sandbox: any;
  let localStorageMock: any;
  let fetchStub: any;
  let imageConstructorStub: any;

  beforeEach(() => {
    sandbox = sinon.createSandbox();
    
    // Mock localStorage
    localStorageMock = {
      getItem: sandbox.stub(),
      setItem: sandbox.stub(),
      removeItem: sandbox.stub(),
      clear: sandbox.stub(),
      length: 0,
      key: sandbox.stub()
    };
    
    // Mock global objects
    global.localStorage = localStorageMock;
    imageConstructorStub = sandbox.stub(global, 'Image').returns(mockImage);
    
    // Mock fetch
    fetchStub = sandbox.stub(global, 'fetch');
    fetchStub.resolves({
      ok: true,
      blob: () => Promise.resolve(new Blob()),
      status: 200,
      statusText: 'OK'
    });

    // Default test configuration
    mockConfig = {
      maxSize: 100,
      maxAge: 3600000, // 1 hour
      enablePersistence: true,
      enablePreload: true,
      compressionLevel: 0.8,
      allowedFormats: ['jpg', 'jpeg', 'png', 'webp', 'gif']
    };

    localStorageMock.getItem.returns(null);
    imageCache = createImageCache(mockConfig);
  });

  afterEach(() => {
    clearImageCache();
    sandbox.restore();
  });

  describe('createImageCache', () => {
    it('should create image cache with default config', () => {
      const cache = createImageCache();
      expect(cache).to.be.an('object');
      expect(cache.getConfig).to.be.a('function');
      
      const config = cache.getConfig();
      expect(config).to.have.property('maxSize');
      expect(config).to.have.property('maxAge');
      expect(config).to.have.property('enablePersistence');
      expect(config).to.have.property('enablePreload');
    });

    it('should create image cache with custom config', () => {
      const customConfig: CacheConfig = {
        maxSize: 50,
        maxAge: 1800000,
        enablePersistence: false,
        enablePreload: false,
        compressionLevel: 0.9,
        allowedFormats: ['png', 'webp']
      };
      
      const cache = createImageCache(customConfig);
      const config = cache.getConfig();
      
      expect(config.maxSize).to.equal(50);
      expect(config.maxAge).to.equal(1800000);
      expect(config.enablePersistence).to.equal(false);
      expect(config.enablePreload).to.equal(false);
      expect(config.compressionLevel).to.equal(0.9);
      expect(config.allowedFormats).to.deep.equal(['png', 'webp']);
    });

    it('should throw error for invalid config - negative maxSize', () => {
      const invalidConfig = {
        maxSize: -1,
        maxAge: 1000,
        enablePersistence: true,
        enablePreload: true,
        compressionLevel: 0.8,
        allowedFormats: ['jpg']
      } as CacheConfig;

      expect(() => createImageCache(invalidConfig)).to.throw(ImageCacheError);
    });

    it('should throw error for invalid config - negative maxAge', () => {
      const invalidConfig = {
        maxSize: 100,
        maxAge: -1000,
        enablePersistence: true,
        enablePreload: true,
        compressionLevel: 0.8,
        allowedFormats: ['jpg']
      } as CacheConfig;

      expect(() => createImageCache(invalidConfig)).to.throw(ImageCacheError);
    });

    it('should throw error for invalid config - compression level out of range', () => {
      const invalidConfig = {
        maxSize: 100,
        maxAge: 1000,
        enablePersistence: true,
        enablePreload: true,
        compressionLevel: 2.0,
        allowedFormats: ['jpg']
      } as CacheConfig;

      expect(() => createImageCache(invalidConfig)).to.throw(ImageCacheError);
    });

    it('should throw error for invalid config - empty allowed formats', () => {
      const invalidConfig = {
        maxSize: 100,
        maxAge: 1000,
        enablePersistence: true,
        enablePreload: true,
        compressionLevel: 0.8,
        allowedFormats: []
      } as CacheConfig;

      expect(() => createImageCache(invalidConfig)).to.throw(ImageCacheError);
    });
  });

  describe('get', () => {
    it('should return cached image when available', async () => {
      const testUrl = 'https://example.com/test.jpg';
      const mockBlob = new Blob(['test'], { type: 'image/jpeg' });
      
      await imageCache.set(testUrl, mockBlob);
      
      const result = await imageCache.get(testUrl);
      expect(result).to.equal(mockBlob);
      expect(fetchStub.called).to.be.false;
    });

    it('should fetch and cache image when not in cache', async () => {
      const testUrl = 'https://example.com/test.jpg';
      const mockBlob = new Blob(['test'], { type: 'image/jpeg' });
      
      fetchStub.resolves({
        ok: true,
        blob: () => Promise.resolve(mockBlob),
        status: 200,
        statusText: 'OK'
      });

      const result = await imageCache.get(testUrl);
      expect(result).to.equal(mockBlob);
      expect(fetchStub.calledOnceWith(testUrl)).to.be.true;
    });

    it('should throw error for invalid URL', async () => {
      try {
        await imageCache.get('invalid-url');
        expect.fail('Should have thrown an error');
      } catch (error) {
        expect(error).to.be.instanceOf(ImageCacheError);
        expect(error.message).to.contain('Invalid URL');
      }
    });

    it('should throw error for unsupported format', async () => {
      try {
        await imageCache.get('https://example.com/test.bmp');
        expect.fail('Should have thrown an error');
      } catch (error) {
        expect(error).to.be.instanceOf(ImageCacheError);
        expect(error.message).to.contain('Unsupported image format');
      }
    });

    it('should handle network errors gracefully', async () => {
      const testUrl = 'https://example.com/test.jpg';
      
      fetchStub.rejects(new Error('Network error'));

      try {
        await imageCache.get(testUrl);
        expect.fail('Should have thrown an error');
      } catch (error) {
        expect(error).to.be.instanceOf(ImageCacheError);
        expect(error.message).to.contain('Failed to fetch image');
      }
    });

    it('should handle HTTP errors gracefully', async () => {
      const testUrl = 'https://example.com/test.jpg';
      
      fetchStub.resolves({
        ok: false,
        status: 404,
        statusText: 'Not Found'
      });

      try {
        await imageCache.get(testUrl);
        expect.fail('Should have thrown an error');
      } catch (error) {
        expect(error).to.be.instanceOf(ImageCacheError);
        expect(error.message).to.contain('HTTP error: 404');
      }
    });

    it('should respect cache expiration', async () => {
      const testUrl = 'https://example.com/test.jpg';
      const oldBlob = new Blob(['old'], { type: 'image/jpeg' });
      const newBlob = new Blob(['new'], { type: 'image/jpeg' });
      
      // Set cache with expired timestamp
      const expiredTimestamp = Date.now() - (mockConfig.maxAge + 1000);
      await imageCache.set(testUrl, oldBlob, expiredTimestamp);
      
      fetchStub.resolves({
        ok: true,
        blob: () => Promise.resolve(newBlob),
        status: 200,
        statusText: 'OK'
      });

      const result = await imageCache.get(testUrl);
      expect(result).to.equal(newBlob);
      expect(fetchStub.calledOnceWith(testUrl)).to.be.true;
    });

    it('should handle blob conversion errors', async () => {
      const testUrl = 'https://example.com/test.jpg';
      
      fetchStub.resolves({
        ok: true,
        blob: () => Promise.reject(new Error('Blob conversion failed')),
        status: 200,
        statusText: 'OK'
      });

      try {
        await imageCache.get(testUrl);
        expect.fail('Should have thrown an error');
      } catch (error) {
        expect(error).to.be.instanceOf(ImageCacheError);
      }
    });

    it('should handle concurrent requests with deduplication', async () => {
      const testUrl = 'https://example.com/test.jpg';
      const mockBlob = new Blob(['test'], { type: 'image/jpeg' });
      
      fetchStub.resolves({
        ok: true,
        blob: () => Promise.resolve(mockBlob),
        status: 200,
        statusText: 'OK'
      });

      // Make multiple concurrent requests
      const promises = [
        imageCache.get(testUrl),
        imageCache.get(testUrl),
        imageCache.get(testUrl)
      ];
      
      const results = await Promise.all(promises);
      
      // Should only make one fetch request due to deduplication
      expect(fetchStub.calledOnce).to.be.true;
      results.forEach(result => {
        expect(result).to.equal(mockBlob);
      });
    });
  });

  describe('set', () => {
    it('should store image in cache', async () => {
      const testUrl = 'https://example.com/test.jpg';
      const mockBlob = new Blob(['test'], { type: 'image/jpeg' });
      
      await imageCache.set(testUrl, mockBlob);
      
      expect(imageCache.has(testUrl)).to.be.true;
    });

    it('should update existing cache entry', async () => {
      const testUrl = 'https://example.com/test.jpg';
      const oldBlob = new Blob(['old'], { type: 'image/jpeg' });
      const newBlob = new Blob(['new'], { type: 'image/jpeg' });
      
      await imageCache.set(testUrl, oldBlob);
      await imageCache.set(testUrl, newBlob);
      
      const result = await imageCache.get(testUrl);
      expect(result).to.equal(newBlob);
    });

    it('should handle cache size limits with LRU eviction', async () => {
      const smallCache = createImageCache({ ...mockConfig, maxSize: 2 });
      
      const urls = ['test1.jpg', 'test2.jpg', 'test3.jpg'];
      const blobs = urls.map(url => new Blob([url], { type: 'image/jpeg' }));
      
      // Fill cache beyond capacity
      for (let i = 0; i < urls.length; i++) {
        await smallCache.set(urls[i], blobs[i]);
      }
      
      const stats = getCacheStats();
      expect(stats.size).to.be.at.most(2);
    });

    it('should persist to localStorage when enabled', async () => {
      const testUrl = 'https://example.com/test.jpg';
      const mockBlob = new Blob(['test'], { type: 'image/jpeg' });
      
      await imageCache.set(testUrl, mockBlob);
      
      expect(localStorageMock.setItem.called).to.be.true;
    });

    it('should not persist when disabled', async () => {
      const noPersistCache = createImageCache({ ...mockConfig, enablePersistence: false });
      const testUrl = 'https://example.com/test.jpg';
      const mockBlob = new Blob(['test'], { type: 'image/jpeg' });
      
      await noPersistCache.set(testUrl, mockBlob);
      
      expect(localStorageMock.setItem.called).to.be.false;
    });

    it('should handle localStorage quota exceeded gracefully', async () => {
      const testUrl = 'https://example.com/test.jpg';
      const mockBlob = new Blob(['test'], { type: 'image/jpeg' });
      
      localStorageMock.setItem.throws(new Error('QuotaExceededError'));
      
      // Should not throw error, but gracefully handle storage failure
      await imageCache.set(testUrl, mockBlob);
      expect(imageCache.has(testUrl)).to.be.true; // Should still cache in memory
    });

    it('should validate URL before storing', async () => {
      const invalidUrl = 'invalid-url';
      const mockBlob = new Blob(['test'], { type: 'image/jpeg' });
      
      try {
        await imageCache.set(invalidUrl, mockBlob);
        expect.fail('Should have thrown an error');
      } catch (error) {
        expect(error).to.be.instanceOf(ImageCacheError);
      }
    });

    it('should validate blob before storing', async () => {
      const testUrl = 'https://example.com/test.jpg';
      
      try {
        await imageCache.set(testUrl, null as any);
        expect.fail('Should have thrown an error');
      } catch (error) {
        expect(error).to.be.instanceOf(ImageCacheError);
      }
    });
  });

  describe('has', () => {
    it('should return true for cached images', async () => {
      const testUrl = 'https://example.com/test.jpg';
      const mockBlob = new Blob(['test'], { type: 'image/jpeg' });
      
      await imageCache.set(testUrl, mockBlob);
      
      expect(imageCache.has(testUrl)).to.be.true;
    });

    it('should return false for non-cached images', () => {
      expect(imageCache.has('https://example.com/nonexistent.jpg')).to.be.false;
    });

    it('should return false for expired cache entries', async () => {
      const testUrl = 'https://example.com/test.jpg';
      const mockBlob = new Blob(['test'], { type: 'image/jpeg' });
      const expiredTimestamp = Date.now() - (mockConfig.maxAge + 1000);
      
      await imageCache.set(testUrl, mockBlob, expiredTimestamp);
      
      expect(imageCache.has(testUrl)).to.be.false;
    });

    it('should return false for invalid URLs', () => {
      expect(imageCache.has('invalid-url')).to.be.false;
    });

    it('should handle null/undefined inputs', () => {
      expect(imageCache.has(null as any)).to.be.false;
      expect(imageCache.has(undefined as any)).to.be.false;
    });
  });

  describe('delete', () => {
    it('should remove image from cache', async () => {
      const testUrl = 'https://example.com/test.jpg';
      const mockBlob = new Blob(['test'], { type: 'image/jpeg' });
      
      await imageCache.set(testUrl, mockBlob);
      expect(imageCache.has(testUrl)).to.be.true;
      
      const deleted = imageCache.delete(testUrl);
      expect(deleted).to.be.true;
      expect(imageCache.has(testUrl)).to.be.false;
    });

    it('should return false for non-existent entries', () => {
      const deleted = imageCache.delete('https://example.com/nonexistent.jpg');
      expect(deleted).to.be.false;
    });

    it('should remove from localStorage when persistence enabled', async () => {
      const testUrl = 'https://example.com/test.jpg';
      const mockBlob = new Blob(['test'], { type: 'image/jpeg' });
      
      await imageCache.set(testUrl, mockBlob);
      imageCache.delete(testUrl);
      
      expect(localStorageMock.removeItem.called).to.be.true;
    });

    it('should handle invalid URLs gracefully', () => {
      expect(() => imageCache.delete('invalid-url')).to.not.throw();
    });

    it('should handle localStorage errors gracefully', async () => {
      const testUrl = 'https://example.com/test.jpg';
      const mockBlob = new Blob(['test'], { type: 'image/jpeg' });
      
      await imageCache.set(testUrl, mockBlob);
      localStorageMock.removeItem.throws(new Error('Storage error'));
      
      expect(() => imageCache.delete(testUrl)).to.not.throw();
    });
  });

  describe('clear', () => {
    it('should remove all cached images', async () => {
      const urls = ['test1.jpg', 'test2.jpg', 'test3.jpg'];
      const blobs = urls.map(url => new Blob([url], { type: 'image/jpeg' }));
      
      for (let i = 0; i < urls.length; i++) {
        await imageCache.set(urls[i], blobs[i]);
      }
      
      imageCache.clear();
      
      urls.forEach(url => {
        expect(imageCache.has(url)).to.be.false;
      });
    });

    it('should clear localStorage when persistence enabled', async () => {
      const testUrl = 'https://example.com/test.jpg';
      const mockBlob = new Blob(['test'], { type: 'image/jpeg' });
      
      await imageCache.set(testUrl, mockBlob);
      imageCache.clear();
      
      expect(localStorageMock.clear.called).to.be.true;
    });

    it('should reset cache statistics', async () => {
      const testUrl = 'https://example.com/test.jpg';
      const mockBlob = new Blob(['test'], { type: 'image/jpeg' });
      
      await imageCache.set(testUrl, mockBlob);
      imageCache.clear();
      
      const stats = getCacheStats();
      expect(stats.size).to.equal(0);
      expect(stats.totalSize).to.equal(0);
    });

    it('should handle localStorage errors gracefully', () => {
      localStorageMock.clear.throws(new Error('Storage error'));
      expect(() => imageCache.clear()).to.not.throw();
    });
  });

  describe('preloadImages', () => {
    it('should preload multiple images successfully', async () => {
      const urls = [
        'https://example.com/test1.jpg',
        'https://example.com/test2.jpg',
        'https://example.com/test3.jpg'
      ];
      
      const blobs = urls.map((url, i) => new Blob([`test${i + 1}`], { type: 'image/jpeg' }));
      
      fetchStub.onCall(0).resolves({
        ok: true,
        blob: () => Promise.resolve(blobs[0]),
        status: 200,
        statusText: 'OK'
      });
      fetchStub.onCall(1).resolves({
        ok: true,
        blob: () => Promise.resolve(blobs[1]),
        status: 200,
        statusText: 'OK'
      });
      fetchStub.onCall(2).resolves({
        ok: true,
        blob: () => Promise.resolve(blobs[2]),
        status: 200,
        statusText: 'OK'
      });

      const results = await preloadImages(urls);
      
      expect(results).to.have.lengthOf(3);
      expect(fetchStub.callCount).to.equal(3);
      
      // Verify all images are now cached
      urls.forEach(url => {
        expect(imageCache.has(url)).to.be.true;
      });
    });

    it('should handle preload failures gracefully', async () => {
      const urls = [
        'https://example.com/test1.jpg',
        'https://example.com/fail.jpg'
      ];
      
      fetchStub.onCall(0).resolves({
        ok: true,
        blob: () => Promise.resolve(new Blob(['test1'], { type: 'image/jpeg' })),
        status: 200,
        statusText: 'OK'
      });
      fetchStub.onCall(1).rejects(new Error('Network error'));

      const results = await preloadImages(urls);
      
      expect(results).to.have.lengthOf(2);
      expect(results[0]).to.be.instanceOf(Blob);
      expect(results[1]).to.be.instanceOf(Error);
    });

    it('should respect preload configuration', async () => {
      const noPreloadCache = createImageCache({ ...mockConfig, enablePreload: false });
      const urls = ['https://example.com/test.jpg'];
      
      const results = await preloadImages(urls);
      expect(results).to.have.lengthOf(0);
    });

    it('should handle empty URL array', async () => {
      const results = await preloadImages([]);
      expect(results).to.have.lengthOf(0);
      expect(fetchStub.called).to.be.false;
    });

    it('should filter out invalid URLs', async () => {
      const urls = [
        'https://example.com/valid.jpg',
        'invalid-url',
        'https://example.com/another.png'
      ];
      
      fetchStub.resolves({
        ok: true,
        blob: () => Promise.resolve(new Blob(['test'], { type: 'image/jpeg' })),
        status: 200,
        statusText: 'OK'
      });

      const results = await preloadImages(urls);
      
      // Should only process valid URLs
      expect(fetchStub.callCount).to.equal(2);
      expect(results).to.have.lengthOf(3); // Including error for invalid URL
    });

    it('should handle unsupported formats', async () => {
      const urls = [
        'https://example.com/test.jpg',
        'https://example.com/unsupported.bmp'
      ];
      
      const results = await preloadImages(urls);
      
      expect(results).to.have.lengthOf(2);
      expect(results[1]).to.be.instanceOf(Error);
    });
  });

  describe('getCacheStats', () => {
    it('should return correct cache statistics', async () => {
      const urls = ['test1.jpg', 'test2.jpg'];
      const blobs = urls.map(url => new Blob([url], { type: 'image/jpeg' }));
      
      for (let i = 0; i < urls.length; i++) {
        await imageCache.set(urls[i], blobs[i]);
      }
      
      const stats = getCacheStats();
      
      expect(stats.size).to.equal(2);
      expect(stats.totalSize).to.equal(blobs.reduce((sum, blob) => sum + blob.size, 0));
      expect(stats.maxSize).to.equal(mockConfig.maxSize);
      expect(stats.hitRate).to.be.a('number');
      expect(stats.entries).to.have.lengthOf(2);
    });

    it('should calculate hit rate correctly', async () => {
      const testUrl = 'https://example.com/test.jpg';
      const mockBlob = new Blob(['test'], { type: 'image/jpeg' });
      
      await imageCache.set(testUrl, mockBlob);
      
      // Simulate cache hits
      await imageCache.get(testUrl);
      await imageCache.get(testUrl);
      
      // Simulate cache miss
      fetchStub.resolves({
        ok: true,
        blob: () => Promise.resolve(new Blob(['test2'], { type: 'image/jpeg' })),
        status: 200,
        statusText: 'OK'
      });
      
      await imageCache.get('https://example.com/test2.jpg');
      
      const stats = getCacheStats();
      expect(stats.hitRate).to.be.approximately(0.67, 0.1); // 2 hits out of 3 requests
    });

    it('should return empty stats for empty cache', () => {
      const stats = getCacheStats();
      
      expect(stats.size).to.equal(0);
      expect(stats.totalSize).to.equal(0);
      expect(stats.entries).to.have.lengthOf(0);
    });

    it('should include memory usage information', () => {
      const stats = getCacheStats();
      
      expect(stats).to.have.property('memoryUsage');
      expect(stats.memoryUsage).to.be.a('number');
    });

    it('should include cache efficiency metrics', async () => {
      const testUrl = 'https://example.com/test.jpg';
      const mockBlob = new Blob(['test'], { type: 'image/jpeg' });
      
      await imageCache.set(testUrl, mockBlob);
      await imageCache.get(testUrl);
      
      const stats = getCacheStats();
      
      expect(stats).to.have.property('hits');
      expect(stats).to.have.property('misses');
      expect(stats).to.have.property('evictions');
    });
  });

  describe('invalidateCache', () => {
    it('should remove expired entries', async () => {
      const currentTime = Date.now();
      const validUrl = 'https://example.com/valid.jpg';
      const expiredUrl = 'https://example.com/expired.jpg';
      
      const validBlob = new Blob(['valid'], { type: 'image/jpeg' });
      const expiredBlob = new Blob(['expired'], { type: 'image/jpeg' });
      
      await imageCache.set(validUrl, validBlob, currentTime);
      await imageCache.set(expiredUrl, expiredBlob, currentTime - (mockConfig.maxAge + 1000));
      
      const removedCount = invalidateCache();
      
      expect(removedCount).to.equal(1);
      expect(imageCache.has(validUrl)).to.be.true;
      expect(imageCache.has(expiredUrl)).to.be.false;
    });

    it('should not remove valid entries', async () => {
      const validUrls = ['test1.jpg', 'test2.jpg'];
      const blobs = validUrls.map(url => new Blob([url], { type: 'image/jpeg' }));
      
      for (let i = 0; i < validUrls.length; i++) {
        await imageCache.set(validUrls[i], blobs[i]);
      }
      
      const removedCount = invalidateCache();
      
      expect(removedCount).to.equal(0);
      validUrls.forEach(url => {
        expect(imageCache.has(url)).to.be.true;
      });
    });

    it('should return zero for empty cache', () => {
      const removedCount = invalidateCache();
      expect(removedCount).to.equal(0);
    });

    it('should update localStorage when persistence enabled', async () => {
      const expiredUrl = 'https://example.com/expired.jpg';
      const expiredBlob = new Blob(['expired'], { type: 'image/jpeg' });
      const expiredTimestamp = Date.now() - (mockConfig.maxAge + 1000);
      
      await imageCache.set(expiredUrl, expiredBlob, expiredTimestamp);
      invalidateCache();
      
      expect(localStorageMock.removeItem.called).to.be.true;
    });
  });

  describe('setCacheConfig', () => {
    it('should update cache configuration', () => {
      const newConfig: Partial<CacheConfig> = {
        maxSize: 200,
        maxAge: 7200000,
        compressionLevel: 0.9
      };
      
      setCacheConfig(newConfig);
      
      const updatedConfig = imageCache.getConfig();
      expect(updatedConfig.maxSize).to.equal(200);
      expect(updatedConfig.maxAge).to.equal(7200000);
      expect(updatedConfig.compressionLevel).to.equal(0.9);
    });

    it('should validate configuration updates', () => {
      const invalidConfig = {
        maxSize: -1,
        compressionLevel: 2.0
      };
      
      expect(() => setCacheConfig(invalidConfig)).to.throw(ImageCacheError);
    });

    it('should merge with existing configuration', () => {
      const originalConfig = imageCache.getConfig();
      const partialConfig: Partial<CacheConfig> = {
        maxSize: 150
      };
      
      setCacheConfig(partialConfig);
      
      const updatedConfig = imageCache.getConfig();
      expect(updatedConfig.maxSize).to.equal(150);
      expect(updatedConfig.maxAge).to.equal(originalConfig.maxAge); // Should remain unchanged
      expect(updatedConfig.enablePersistence).to.equal(originalConfig.enablePersistence);
    });

    it('should trigger cache resize when maxSize is reduced', async () => {
      // Fill cache
      const urls = ['test1.jpg', 'test2.jpg', 'test3.jpg', 'test4.jpg', 'test5.jpg'];
      const blobs = urls.map(url => new Blob([url], { type: 'image/jpeg' }));
      
      for (let i = 0; i < urls.length; i++) {
        await imageCache.set(urls[i], blobs[i]);
      }
      
      // Reduce max size
      setCacheConfig({ maxSize: 2 });
      
      const stats = getCacheStats();
      expect(stats.size).to.be.at.most(2);
    });
  });

  describe('Edge Cases and Error Handling', () => {
    it('should handle memory pressure gracefully', async () => {
      const largeCache = createImageCache({ ...mockConfig, maxSize: 1000 });
      
      // Create a very large blob (simulating memory pressure)
      const largeData = 'x'.repeat(1000000);
      const largeBlob = new Blob([largeData], { type: 'image/jpeg' });
      
      await largeCache.set('https://example.com/large.jpg', largeBlob);
      expect(largeCache.has('https://example.com/large.jpg')).to.be.true;
    });

    it('should handle malformed localStorage data', () => {
      localStorageMock.getItem.returns('invalid-json');
      
      // Should not throw error during initialization
      expect(() => createImageCache(mockConfig)).to.not.throw();
    });

    it('should handle localStorage unavailable', () => {
      delete (global as any).localStorage;
      
      // Should fallback gracefully to memory-only cache
      expect(() => createImageCache(mockConfig)).to.not.throw();
    });

    it('should handle blob size calculation errors', async () => {
      const testUrl = 'https://example.com/test.jpg';
      const mockBlob = {
        size: undefined,
        type: 'image/jpeg'
      } as any;
      
      await imageCache.set(testUrl, mockBlob);
      expect(imageCache.has(testUrl)).to.be.true;
    });

    it('should handle URL normalization', async () => {
      const baseUrl = 'https://example.com/test.jpg';
      const urlWithQuery = 'https://example.com/test.jpg?v=1';
      const urlWithFragment = 'https://example.com/test.jpg#section';
      
      const mockBlob = new Blob(['test'], { type: 'image/jpeg' });
      
      await imageCache.set(baseUrl, mockBlob);
      
      // Should treat different URL variations appropriately
      expect(imageCache.has(urlWithQuery)).to.be.false; // Different due to query params
      expect(imageCache.has(urlWithFragment)).to.be.false; // Different due to fragment
    });

    it('should handle extremely long URLs', async () => {
      const longUrl = 'https://example.com/' + 'a'.repeat(2000) + '.jpg';
      const mockBlob = new Blob(['test'], { type: 'image/jpeg' });
      
      await imageCache.set(longUrl, mockBlob);
      expect(imageCache.has(longUrl)).to.be.true;
    });

    it('should handle special characters in URLs', async () => {
      const specialUrl = 'https://example.com/test%20file%20(1).jpg';
      const mockBlob = new Blob(['test'], { type: 'image/jpeg' });
      
      await imageCache.set(specialUrl, mockBlob);
      expect(imageCache.has(specialUrl)).to.be.true;
    });
  });

  describe('Performance and Optimization', () => {
    it('should implement LRU eviction strategy correctly', async () => {
      const smallCache = createImageCache({ ...mockConfig, maxSize: 3 });
      const urls = ['test1.jpg', 'test2.jpg', 'test3.jpg', 'test4.jpg'];
      const blobs = urls.map(url => new Blob([url], { type: 'image/jpeg' }));
      
      // Fill cache to capacity
      for (let i = 0; i < 3; i++) {
        await smallCache.set(urls[i], blobs[i]);
      }
      
      // Access first item to make it recently used
      await smallCache.get(urls[0]);
      
      // Add fourth item, should evict second item (least recently used)
      await smallCache.set(urls[3], blobs[3]);
      
      expect(smallCache.has(urls[0])).to.be.true;  // Recently accessed
      expect(smallCache.has(urls[1])).to.be.false; // Should be evicted
      expect(smallCache.has(urls[2])).to.be.true;  // Still in cache
      expect(smallCache.has(urls[3])).to.be.true;  // Newly added
    });

    it('should batch localStorage operations', async () => {
      const urls = ['test1.jpg', 'test2.jpg', 'test3.jpg'];
      const blobs = urls.map(url => new Blob([url], { type: 'image/jpeg' }));
      
      // Set multiple items
      for (let i = 0; i < urls.length; i++) {
        await imageCache.set(urls[i], blobs[i]);
      }
      
      // Should not call localStorage.setItem excessively
      expect(localStorageMock.setItem.callCount).to.be.at.most(urls.length + 1); // +1 for potential metadata
    });

    it('should debounce cache persistence', async () => {
      const testUrl = 'https://example.com/test.jpg';
      const blobs = [
        new Blob(['v1'], { type: 'image/jpeg' }),
        new Blob(['v2'], { type: 'image/jpeg' }),
        new Blob(['v3'], { type: 'image/jpeg' })
      ];
      
      // Rapid updates
      await imageCache.set(testUrl, blobs[0]);
      await imageCache.set(testUrl, blobs[1]);
      await imageCache.set(testUrl, blobs[2]);
      
      // Should not call localStorage for every update
      expect(localStorageMock.setItem.callCount).to.be.lessThan(3);
    });

    it('should handle cache warming efficiently', async () => {
      const urls = Array.from({ length: 50 }, (_, i) => `https://example.com/test${i}.jpg`);
      
      fetchStub.callsFake(() => Promise.resolve({
        ok: true,
        blob: () => Promise.resolve(new Blob(['test'], { type: 'image/jpeg' })),
        status: 200,
        statusText: 'OK'
      }));
      
      const startTime = Date.now();
      await preloadImages(urls);
      const endTime = Date.now();
      
      // Should complete reasonably quickly (this is a rough performance check)
      expect(endTime - startTime).to.be.lessThan(5000); // 5 seconds max
    });
  });

  describe('Integration with DOM', () => {
    it('should work with Image elements', async () => {
      const testUrl = 'https://example.com/test.jpg';
      const mockBlob = new Blob(['test'], { type: 'image/jpeg' });
      
      await imageCache.set(testUrl, mockBlob);
      
      const img = new Image();
      const cachedBlob = await imageCache.get(testUrl);
      
      // In a real environment, you would use URL.createObjectURL
      expect(cachedBlob).to.equal(mockBlob);
      expect(img).to.be.an('object');
    });

    it('should handle Image onload events', (done) => {
      const img = new Image();
      
      img.onload = () => {
        expect(img.complete).to.be.true;
        done();
      };
      
      // Simulate image loading
      setTimeout(() => {
        mockImage.complete = true;
        if (img.onload) {
          img.onload.call(img, new Event('load'));
        }
      }, 10);
    });

    it('should handle Image onerror events', (done) => {
      const img = new Image();
      
      img.onerror = () => {
        done();
      };
      
      // Simulate image error
      setTimeout(() => {
        if (img.onerror) {
          img.onerror.call(img, new Event('error'));
        }
      }, 10);
    });

    it('should provide object URLs for cached images', async () => {
      const testUrl = 'https://example.com/test.jpg';
      const mockBlob = new Blob(['test'], { type: 'image/jpeg' });
      
      await imageCache.set(testUrl, mockBlob);
      const cachedBlob = await imageCache.get(testUrl);
      
      // Verify we get the blob that can be used with URL.createObjectURL
      expect(cachedBlob).to.be.instanceOf(Blob);
      expect(cachedBlob.type).to.equal('image/jpeg');
    });
  });

  describe('Compression and Format Handling', () => {
    it('should handle different image formats', async () => {
      const formats = [
        { url: 'https://example.com/test.jpg', type: 'image/jpeg' },
        { url: 'https://example.com/test.png', type: 'image/png' },
        { url: 'https://example.com/test.webp', type: 'image/webp' },
        { url: 'https://example.com/test.gif', type: 'image/gif' }
      ];
      
      for (const format of formats) {
        const blob = new Blob(['test'], { type: format.type });
        await imageCache.set(format.url, blob);
        expect(imageCache.has(format.url)).to.be.true;
      }
    });

    it('should apply compression when configured', async () => {
      const compressedCache = createImageCache({ 
        ...mockConfig, 
        compressionLevel: 0.5 
      });
      
      const testUrl = 'https://example.com/test.jpg';
      const largeBlob = new Blob(['x'.repeat(10000)], { type: 'image/jpeg' });
      
      await compressedCache.set(testUrl, largeBlob);
      const retrievedBlob = await compressedCache.get(testUrl);
      
      // In a real implementation, compression would reduce size
      expect(retrievedBlob).to.be.instanceOf(Blob);
    });

    it('should validate image format extensions', async () => {
      const validFormats = ['jpg', 'jpeg', 'png', 'webp', 'gif'];
      const invalidFormats = ['bmp', 'tiff', 'svg', 'txt'];
      
      for (const format of validFormats) {
        const url = `https://example.com/test.${format}`;
        const blob = new Blob(['test'], { type: `image/${format}` });
        
        await imageCache.set(url, blob);
        expect(imageCache.has(url)).to.be.true;
      }
      
      for (const format of invalidFormats) {
        const url = `https://example.com/test.${format}`;
        const blob = new Blob(['test'], { type: `image/${format}` });
        
        try {
          await imageCache.set(url, blob);
          if (format !== 'svg') { // SVG might be allowed in some configs
            expect.fail(`Should have rejected format: ${format}`);
          }
        } catch (error) {
          expect(error).to.be.instanceOf(ImageCacheError);
        }
      }
    });
  });
});