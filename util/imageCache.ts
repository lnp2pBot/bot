import { logger } from '../logger';
import path from 'path';

const fs = require('fs').promises;

interface ImageCache {
  honeybadgerImage: string | null;
  regularImages: string[];
  isInitialized: boolean;
}

class ImageCacheManager {
  private cache: ImageCache = {
    honeybadgerImage: null,
    regularImages: [],
    isInitialized: false
  };

  async initialize(): Promise<void> {
    try {
      logger.info('Initializing image cache...');
      
      const honeybadgerFilename = 'Honeybadger.png';
      const honeybadgerFullPath = `images/${honeybadgerFilename}`;
      
      // Try to load Honeybadger image
      try {
        const goldenImage = await fs.readFile(honeybadgerFullPath);
        this.cache.honeybadgerImage = Buffer.from(goldenImage, 'binary').toString('base64');
        logger.info('Golden Honey Badger image cached successfully');
      } catch (err) {
        logger.warning(`Honeybadger image not found: ${err}`);
        this.cache.honeybadgerImage = null;
      }
      
      // Load all regular images
      try {
        const files = await fs.readdir('images');
        const imageFiles = files.filter((file: string) => 
          ['.png'].includes(path.extname(file).toLowerCase()) && 
          file !== honeybadgerFilename
        );
        
        for (const imageFile of imageFiles) {
          try {
            const imageData = await fs.readFile(`images/${imageFile}`);
            const base64Image = Buffer.from(imageData, 'binary').toString('base64');
            this.cache.regularImages.push(base64Image);
          } catch (error) {
            logger.error(`Error loading image ${imageFile}: ${error}`);
          }
        }
        
        logger.info(`Cached ${this.cache.regularImages.length} regular images`);
      } catch (error) {
        logger.error(`Error reading images directory: ${error}`);
      }
      
      this.cache.isInitialized = true;
      logger.info('Image cache initialization completed');
    } catch (error) {
      logger.error(`Error initializing image cache: ${error}`);
      this.cache.isInitialized = false;
    }
  }

  generateRandomImage(nonce: string): { randomImage: string; isGoldenHoneyBadger: boolean } {
    if (!this.cache.isInitialized) {
      logger.warning('Image cache not initialized, returning empty image');
      return { randomImage: '', isGoldenHoneyBadger: false };
    }

    let randomImage = '';
    let isGoldenHoneyBadger = false;
    
    try {
      // Check for Golden Honey Badger
      if (this.cache.honeybadgerImage) {
        const goldenProbability = parseInt(process.env.GOLDEN_HONEY_BADGER_PROBABILITY || '100');
        const probability = isNaN(goldenProbability) ? 100 : Math.max(1, goldenProbability);
        const luckyNumber = Math.floor(Math.random() * probability) + 1;
        const winningNumber = 1; 
        
        logger.debug(`Golden Honey Badger probability check: ${luckyNumber}/${probability} (wins if ${luckyNumber}=${winningNumber})`);
        
        if (luckyNumber === winningNumber) {
          randomImage = this.cache.honeybadgerImage;
          isGoldenHoneyBadger = true;
          logger.info(`🏆 GOLDEN HONEY BADGER ASSIGNED to order with nonce: ${nonce} - FEES WILL BE ZERO`);
          return { randomImage, isGoldenHoneyBadger };
        }
      }
      
      // Select random regular image
      if (this.cache.regularImages.length > 0) {
        const randomIndex = Math.floor(Math.random() * this.cache.regularImages.length);
        randomImage = this.cache.regularImages[randomIndex];
      } else {
        logger.error('No regular images available in cache');
      }
      
    } catch (error) {
      logger.error(`Error in generateRandomImage: ${error}`);
    }

    return { randomImage, isGoldenHoneyBadger };
  }

  getStats(): { honeybadgerCached: boolean; regularImagesCount: number; isInitialized: boolean } {
    return {
      honeybadgerCached: this.cache.honeybadgerImage !== null,
      regularImagesCount: this.cache.regularImages.length,
      isInitialized: this.cache.isInitialized
    };
  }
}

// Export singleton instance
export const imageCache = new ImageCacheManager();