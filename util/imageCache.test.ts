import { imageCache } from './imageCache';
const sinon = require('sinon');
const { expect } = require('chai');
const proxyquire = require('proxyquire');

describe('ImageCache', () => {
  let sandbox: any;
  let fsStub: any;
  let loggerStub: any;
  let mathRandomStub: any;
  let processEnvStub: any;
  let ImageCacheModule: any;
  let testImageCache: any;

  beforeEach(() => {
    sandbox = sinon.createSandbox();
    
    // Mock filesystem operations
    fsStub = {
      readFile: sandbox.stub(),
      readdir: sandbox.stub()
    };
    
    // Mock logger
    loggerStub = {
      info: sandbox.stub(),
      error: sandbox.stub(),
      warning: sandbox.stub(),
      debug: sandbox.stub()
    };
    
    // Mock Math.random for predictable testing
    mathRandomStub = sandbox.stub(Math, 'random');
    
    // Mock process.env
    processEnvStub = {};
    
    // Use proxyquire to inject mocks
    ImageCacheModule = proxyquire('./imageCache', {
      fs: { promises: fsStub },
      '../logger': { logger: loggerStub },
      process: { env: processEnvStub }
    });
    
    testImageCache = new ImageCacheModule.ImageCacheManager();
  });

  afterEach(() => {
    sandbox.restore();
  });

  describe('initialize', () => {
    it('should successfully initialize with Honeybadger and regular images', async () => {
      const mockHoneybadgerBuffer = Buffer.from('honeybadger-image-data');
      const mockRegularBuffer = Buffer.from('regular-image-data');
      
      fsStub.readFile.onFirstCall().resolves(mockHoneybadgerBuffer);
      fsStub.readdir.resolves(['Honeybadger.png', 'image1.png', 'image2.png', 'ignore.jpg']);
      fsStub.readFile.onSecondCall().resolves(mockRegularBuffer);
      fsStub.readFile.onThirdCall().resolves(mockRegularBuffer);
      
      await testImageCache.initialize();
      
      expect(loggerStub.info.calledWith('Initializing image cache...')).to.be.true;
      expect(loggerStub.info.calledWith('Golden Honey Badger image cached successfully')).to.be.true;
      expect(loggerStub.info.calledWith('Cached 2 regular images')).to.be.true;
      expect(loggerStub.info.calledWith('Image cache initialization completed')).to.be.true;
      
      const stats = testImageCache.getStats();
      expect(stats.isInitialized).to.be.true;
      expect(stats.honeybadgerCached).to.be.true;
      expect(stats.regularImagesCount).to.equal(2);
    });

    it('should handle missing Honeybadger image gracefully', async () => {
      const mockRegularBuffer = Buffer.from('regular-image-data');
      
      fsStub.readFile.onFirstCall().rejects(new Error('File not found'));
      fsStub.readdir.resolves(['image1.png', 'image2.png']);
      fsStub.readFile.onSecondCall().resolves(mockRegularBuffer);
      fsStub.readFile.onThirdCall().resolves(mockRegularBuffer);
      
      await testImageCache.initialize();
      
      expect(loggerStub.warning.calledWith(sinon.match('Honeybadger image not found'))).to.be.true;
      
      const stats = testImageCache.getStats();
      expect(stats.isInitialized).to.be.true;
      expect(stats.honeybadgerCached).to.be.false;
      expect(stats.regularImagesCount).to.equal(2);
    });

    it('should handle images directory not existing', async () => {
      fsStub.readFile.onFirstCall().rejects(new Error('File not found'));
      fsStub.readdir.rejects(new Error('Directory not found'));
      
      await testImageCache.initialize();
      
      expect(loggerStub.error.calledWith(sinon.match('Error reading images directory'))).to.be.true;
      
      const stats = testImageCache.getStats();
      expect(stats.isInitialized).to.be.true;
      expect(stats.honeybadgerCached).to.be.false;
      expect(stats.regularImagesCount).to.equal(0);
    });

    it('should filter only PNG files and exclude Honeybadger', async () => {
      fsStub.readFile.onFirstCall().rejects(new Error('File not found'));
      fsStub.readdir.resolves([
        'Honeybadger.png',
        'image1.png',
        'image2.PNG',
        'image3.jpg',
        'image4.gif',
        'document.txt'
      ]);
      
      const mockBuffer = Buffer.from('image-data');
      fsStub.readFile.onSecondCall().resolves(mockBuffer);
      fsStub.readFile.onThirdCall().resolves(mockBuffer);
      
      await testImageCache.initialize();
      
      const stats = testImageCache.getStats();
      expect(stats.regularImagesCount).to.equal(2); // Only image1.png and image2.PNG
    });

    it('should handle individual image loading failures', async () => {
      fsStub.readFile.onFirstCall().rejects(new Error('File not found'));
      fsStub.readdir.resolves(['image1.png', 'image2.png', 'image3.png']);
      
      const mockBuffer = Buffer.from('image-data');
      fsStub.readFile.onSecondCall().resolves(mockBuffer);
      fsStub.readFile.onThirdCall().rejects(new Error('Corrupted file'));
      fsStub.readFile.onCall(3).resolves(mockBuffer);
      
      await testImageCache.initialize();
      
      expect(loggerStub.error.calledWith(sinon.match('Error loading image image2.png'))).to.be.true;
      
      const stats = testImageCache.getStats();
      expect(stats.regularImagesCount).to.equal(2); // image1.png and image3.png loaded successfully
    });

    it('should handle complete initialization failure', async () => {
      // Mock a critical error that prevents initialization
      fsStub.readFile.onFirstCall().throws(new Error('Critical filesystem error'));
      
      await testImageCache.initialize();
      
      expect(loggerStub.error.calledWith(sinon.match('Error initializing image cache'))).to.be.true;
      
      const stats = testImageCache.getStats();
      expect(stats.isInitialized).to.be.false;
    });
  });

  describe('generateRandomImage', () => {
    beforeEach(async () => {
      // Initialize cache with test data
      const mockHoneybadgerBuffer = Buffer.from('honeybadger-data');
      const mockRegularBuffer = Buffer.from('regular-data');
      
      fsStub.readFile.onFirstCall().resolves(mockHoneybadgerBuffer);
      fsStub.readdir.resolves(['Honeybadger.png', 'image1.png', 'image2.png']);
      fsStub.readFile.onSecondCall().resolves(mockRegularBuffer);
      fsStub.readFile.onThirdCall().resolves(mockRegularBuffer);
      
      await testImageCache.initialize();
    });

    it('should return empty image when cache not initialized', () => {
      const uninitializedCache = new ImageCacheModule.ImageCacheManager();
      
      const result = uninitializedCache.generateRandomImage('test-nonce');
      
      expect(result.randomImage).to.equal('');
      expect(result.isGoldenHoneyBadger).to.be.false;
      expect(loggerStub.warning.calledWith('Image cache not initialized, returning empty image')).to.be.true;
    });

    it('should return Golden Honey Badger when lucky number matches', () => {
      processEnvStub.GOLDEN_HONEY_BADGER_PROBABILITY = '100';
      mathRandomStub.returns(0); // This will give luckyNumber = 1, which matches winningNumber = 1
      
      const result = testImageCache.generateRandomImage('test-nonce');
      
      expect(result.isGoldenHoneyBadger).to.be.true;
      expect(result.randomImage).to.equal(Buffer.from('honeybadger-data', 'binary').toString('base64'));
      expect(loggerStub.info.calledWith(sinon.match('🏆 GOLDEN HONEY BADGER ASSIGNED to order with nonce: test-nonce'))).to.be.true;
    });

    it('should return regular image when lucky number does not match', () => {
      processEnvStub.GOLDEN_HONEY_BADGER_PROBABILITY = '100';
      mathRandomStub.onFirstCall().returns(0.5); // This will give luckyNumber = 51, which doesn't match winningNumber = 1
      mathRandomStub.onSecondCall().returns(0.3); // For selecting regular image (index 0)
      
      const result = testImageCache.generateRandomImage('test-nonce');
      
      expect(result.isGoldenHoneyBadger).to.be.false;
      expect(result.randomImage).to.equal(Buffer.from('regular-data', 'binary').toString('base64'));
    });

    it('should handle invalid probability environment variable', () => {
      processEnvStub.GOLDEN_HONEY_BADGER_PROBABILITY = 'invalid';
      mathRandomStub.returns(0); // This will give luckyNumber = 1
      
      const result = testImageCache.generateRandomImage('test-nonce');
      
      expect(result.isGoldenHoneyBadger).to.be.true; // Should default to probability = 100
    });

    it('should handle missing probability environment variable', () => {
      // Don't set the environment variable - it should default to '100'
      mathRandomStub.returns(0); // This will give luckyNumber = 1
      
      const result = testImageCache.generateRandomImage('test-nonce');
      
      expect(result.isGoldenHoneyBadger).to.be.true;
    });

    it('should handle zero probability gracefully', () => {
      processEnvStub.GOLDEN_HONEY_BADGER_PROBABILITY = '0';
      mathRandomStub.returns(0);
      
      const result = testImageCache.generateRandomImage('test-nonce');
      
      // With probability 0, it gets corrected to Math.max(1, 0) = 1, so luckyNumber = 1 should still win
      expect(result.isGoldenHoneyBadger).to.be.true;
    });

    it('should handle negative probability gracefully', () => {
      processEnvStub.GOLDEN_HONEY_BADGER_PROBABILITY = '-10';
      mathRandomStub.returns(0);
      
      const result = testImageCache.generateRandomImage('test-nonce');
      
      // With probability -10, it gets corrected to Math.max(1, -10) = 1, so luckyNumber = 1 should win
      expect(result.isGoldenHoneyBadger).to.be.true;
    });

    it('should return empty image when no regular images available and not golden', async () => {
      // Initialize cache with no regular images
      const mockHoneybadgerBuffer = Buffer.from('honeybadger-data');
      
      fsStub.readFile.onFirstCall().resolves(mockHoneybadgerBuffer);
      fsStub.readdir.resolves(['Honeybadger.png']); // Only honeybadger, no regular images
      
      const emptyImageCache = new ImageCacheModule.ImageCacheManager();
      await emptyImageCache.initialize();
      
      processEnvStub.GOLDEN_HONEY_BADGER_PROBABILITY = '100';
      mathRandomStub.returns(0.5); // Won't match for golden
      
      const result = emptyImageCache.generateRandomImage('test-nonce');
      
      expect(result.isGoldenHoneyBadger).to.be.false;
      expect(result.randomImage).to.equal('');
      expect(loggerStub.error.calledWith('No regular images available in cache')).to.be.true;
    });

    it('should handle cache without Honeybadger image', async () => {
      // Initialize cache without honeybadger
      const mockRegularBuffer = Buffer.from('regular-data');
      
      fsStub.readFile.onFirstCall().rejects(new Error('File not found'));
      fsStub.readdir.resolves(['image1.png']);
      fsStub.readFile.onSecondCall().resolves(mockRegularBuffer);
      
      const noHoneybadgerCache = new ImageCacheModule.ImageCacheManager();
      await noHoneybadgerCache.initialize();
      
      mathRandomStub.returns(0.3);
      
      const result = noHoneybadgerCache.generateRandomImage('test-nonce');
      
      expect(result.isGoldenHoneyBadger).to.be.false;
      expect(result.randomImage).to.equal(Buffer.from('regular-data', 'binary').toString('base64'));
    });

    it('should handle errors in random image generation gracefully', () => {
      // Force an error by making Math.random throw
      mathRandomStub.throws(new Error('Random generation failed'));
      
      const result = testImageCache.generateRandomImage('test-nonce');
      
      expect(result.randomImage).to.equal('');
      expect(result.isGoldenHoneyBadger).to.be.false;
      expect(loggerStub.error.calledWith(sinon.match('Error in generateRandomImage'))).to.be.true;
    });

    it('should log debug information for probability checks', () => {
      processEnvStub.GOLDEN_HONEY_BADGER_PROBABILITY = '50';
      mathRandomStub.returns(0.4); // This will give luckyNumber = 21
      
      testImageCache.generateRandomImage('debug-test');
      
      expect(loggerStub.debug.calledWith(sinon.match('Golden Honey Badger probability check: 21/50'))).to.be.true;
    });

    it('should select different regular images based on random index', () => {
      processEnvStub.GOLDEN_HONEY_BADGER_PROBABILITY = '100';
      mathRandomStub.onFirstCall().returns(0.5); // Won't match golden (luckyNumber = 51)
      mathRandomStub.onSecondCall().returns(0.9); // Will select index 1 (second image)
      
      const result = testImageCache.generateRandomImage('test-nonce');
      
      expect(result.isGoldenHoneyBadger).to.be.false;
      expect(result.randomImage).to.not.be.empty;
    });
  });

  describe('getStats', () => {
    it('should return correct stats for uninitialized cache', () => {
      const stats = testImageCache.getStats();
      
      expect(stats.isInitialized).to.be.false;
      expect(stats.honeybadgerCached).to.be.false;
      expect(stats.regularImagesCount).to.equal(0);
    });

    it('should return correct stats after successful initialization', async () => {
      const mockHoneybadgerBuffer = Buffer.from('honeybadger-data');
      const mockRegularBuffer = Buffer.from('regular-data');
      
      fsStub.readFile.onFirstCall().resolves(mockHoneybadgerBuffer);
      fsStub.readdir.resolves(['Honeybadger.png', 'image1.png', 'image2.png', 'image3.png']);
      fsStub.readFile.onSecondCall().resolves(mockRegularBuffer);
      fsStub.readFile.onThirdCall().resolves(mockRegularBuffer);
      fsStub.readFile.onCall(3).resolves(mockRegularBuffer);
      
      await testImageCache.initialize();
      
      const stats = testImageCache.getStats();
      
      expect(stats.isInitialized).to.be.true;
      expect(stats.honeybadgerCached).to.be.true;
      expect(stats.regularImagesCount).to.equal(3);
    });

    it('should return correct stats when honeybadger failed to load', async () => {
      const mockRegularBuffer = Buffer.from('regular-data');
      
      fsStub.readFile.onFirstCall().rejects(new Error('File not found'));
      fsStub.readdir.resolves(['image1.png']);
      fsStub.readFile.onSecondCall().resolves(mockRegularBuffer);
      
      await testImageCache.initialize();
      
      const stats = testImageCache.getStats();
      
      expect(stats.isInitialized).to.be.true;
      expect(stats.honeybadgerCached).to.be.false;
      expect(stats.regularImagesCount).to.equal(1);
    });

    it('should return stats reflecting partial loading failures', async () => {
      const mockHoneybadgerBuffer = Buffer.from('honeybadger-data');
      const mockRegularBuffer = Buffer.from('regular-data');
      
      fsStub.readFile.onFirstCall().resolves(mockHoneybadgerBuffer);
      fsStub.readdir.resolves(['Honeybadger.png', 'image1.png', 'image2.png', 'image3.png']);
      fsStub.readFile.onSecondCall().resolves(mockRegularBuffer);
      fsStub.readFile.onThirdCall().rejects(new Error('Corrupted file'));
      fsStub.readFile.onCall(3).resolves(mockRegularBuffer);
      
      await testImageCache.initialize();
      
      const stats = testImageCache.getStats();
      
      expect(stats.isInitialized).to.be.true;
      expect(stats.honeybadgerCached).to.be.true;
      expect(stats.regularImagesCount).to.equal(2); // Only 2 out of 3 loaded successfully
    });
  });

  describe('singleton behavior', () => {
    it('should export a singleton instance', () => {
      // Test that the exported imageCache is the same instance
      const { imageCache: cache1 } = require('./imageCache');
      const { imageCache: cache2 } = require('./imageCache');
      
      expect(cache1).to.equal(cache2);
    });
  });

  describe('edge cases and error handling', () => {
    it('should handle Buffer.from errors gracefully', async () => {
      const mockBuffer = {
        toString: () => { throw new Error('Buffer conversion failed'); }
      };
      
      fsStub.readFile.onFirstCall().resolves(mockBuffer);
      fsStub.readdir.resolves(['image1.png']);
      
      await testImageCache.initialize();
      
      expect(loggerStub.error.calledWith(sinon.match('Honeybadger image not found'))).to.be.true;
    });

    it('should handle very large probability values', () => {
      processEnvStub.GOLDEN_HONEY_BADGER_PROBABILITY = '999999999';
      mathRandomStub.returns(0.999999); // This will give a very high luckyNumber
      
      const result = testImageCache.generateRandomImage('test-nonce');
      
      expect(result.isGoldenHoneyBadger).to.be.false; // Should not win with such low probability
    });

    it('should handle empty images directory', async () => {
      fsStub.readFile.onFirstCall().rejects(new Error('File not found'));
      fsStub.readdir.resolves([]);
      
      await testImageCache.initialize();
      
      const stats = testImageCache.getStats();
      expect(stats.regularImagesCount).to.equal(0);
      expect(stats.isInitialized).to.be.true;
    });

    it('should handle file system permission errors', async () => {
      fsStub.readFile.onFirstCall().rejects(new Error('EACCES: permission denied'));
      fsStub.readdir.rejects(new Error('EACCES: permission denied'));
      
      await testImageCache.initialize();
      
      expect(loggerStub.error.calledWith(sinon.match('Error reading images directory'))).to.be.true;
      expect(loggerStub.warning.calledWith(sinon.match('Honeybadger image not found'))).to.be.true;
    });

    it('should handle mixed case file extensions', async () => {
      fsStub.readFile.onFirstCall().rejects(new Error('File not found'));
      fsStub.readdir.resolves(['image1.PNG', 'image2.png', 'image3.Png']);
      
      const mockBuffer = Buffer.from('image-data');
      fsStub.readFile.onSecondCall().resolves(mockBuffer);
      fsStub.readFile.onThirdCall().resolves(mockBuffer);
      fsStub.readFile.onCall(3).resolves(mockBuffer);
      
      await testImageCache.initialize();
      
      const stats = testImageCache.getStats();
      expect(stats.regularImagesCount).to.equal(3); // All should be loaded regardless of case
    });
  });

  describe('concurrent access', () => {
    it('should handle multiple concurrent initialization calls', async () => {
      const mockBuffer = Buffer.from('test-data');
      fsStub.readFile.resolves(mockBuffer);
      fsStub.readdir.resolves(['image1.png']);
      
      // Call initialize multiple times concurrently
      const promises = [
        testImageCache.initialize(),
        testImageCache.initialize(),
        testImageCache.initialize()
      ];
      
      await Promise.all(promises);
      
      // Should not cause issues and cache should be properly initialized
      const stats = testImageCache.getStats();
      expect(stats.isInitialized).to.be.true;
    });

    it('should handle concurrent generateRandomImage calls', async () => {
      // Initialize first
      const mockBuffer = Buffer.from('test-data');
      fsStub.readFile.resolves(mockBuffer);
      fsStub.readdir.resolves(['image1.png', 'image2.png']);
      
      await testImageCache.initialize();
      
      // Make concurrent calls
      mathRandomStub.returns(0.5);
      const promises = [
        testImageCache.generateRandomImage('nonce1'),
        testImageCache.generateRandomImage('nonce2'),
        testImageCache.generateRandomImage('nonce3')
      ];
      
      const results = await Promise.all(promises);
      
      // All should return valid results
      results.forEach(result => {
        expect(result).to.have.property('randomImage');
        expect(result).to.have.property('isGoldenHoneyBadger');
      });
    });
  });
});