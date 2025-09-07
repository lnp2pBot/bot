import { logger } from '../logger';
import path from 'path';

const fs = require('fs').promises;

const honeybadgerFilename = 'Honeybadger.png';

interface ImageCache {
  honeybadgerImage: string | null;
  regularImages: string[];
  isInitialized: boolean;
}

class ImageCacheManager {
  private cache: ImageCache = {
    honeybadgerImage: null,
    regularImages: [],
    isInitialized: false,
  };

  async initialize(): Promise<void> {
    try {
      logger.info('Initializing image cache...');

      this.cache.honeybadgerImage = honeybadgerFilename;

      // Load all regular images
      try {
        const files = await fs.readdir('images');
        const imageFiles = files.filter(
          (file: string) =>
            path.extname(file).toLowerCase() === '.png' &&
            path.basename(file).toLowerCase() !==
              honeybadgerFilename.toLowerCase()
        );
        this.cache.regularImages = imageFiles;

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

  generateRandomImage(nonce: string): {
    randomImage: string;
    isGoldenHoneyBadger: boolean;
  } {
    if (!this.cache.isInitialized) {
      logger.warning('Image cache not initialized, returning empty image');
      return { randomImage: '', isGoldenHoneyBadger: false };
    }

    let randomImage = '';
    let isGoldenHoneyBadger = false;

    try {
      // Check for Golden Honey Badger
      if (this.cache.honeybadgerImage) {
        const goldenProbability = parseInt(
          process.env.GOLDEN_HONEY_BADGER_PROBABILITY || '100'
        );
        const probability = isNaN(goldenProbability)
          ? 100
          : Math.max(1, goldenProbability);
        const luckyNumber = Math.floor(Math.random() * probability) + 1;
        const winningNumber = 1;

        logger.debug(
          `Golden Honey Badger probability check: ${luckyNumber}/${probability} (wins if ${luckyNumber}=${winningNumber})`
        );

        if (luckyNumber === winningNumber) {
          randomImage = this.cache.honeybadgerImage;
          isGoldenHoneyBadger = true;
          logger.info(
            `🏆 GOLDEN HONEY BADGER ASSIGNED to order with nonce: ${nonce} - FEES WILL BE ZERO`
          );
          return { randomImage, isGoldenHoneyBadger };
        }
      }

      // Select random regular image
      if (this.cache.regularImages.length > 0) {
        const randomIndex = Math.floor(
          Math.random() * this.cache.regularImages.length
        );
        randomImage = this.cache.regularImages[randomIndex];
      } else {
        logger.error('No regular images available in cache');
      }
    } catch (error) {
      logger.error(`Error in generateRandomImage: ${error}`);
    }

    return { randomImage, isGoldenHoneyBadger };
  }

  /**
   * Converts an image to base64
   * The image is from the images directory
   * @param image Image file name
   * @returns Image base64 string, or empty string if error
   */
  convertImageToBase64 = async (image: string) => {
    let base64Image = '';
    try {
      const imageData = await fs.readFile(`images/${image}`);
      base64Image = imageData.toString('base64');
    } catch (error) {
      logger.error(error);
    }
    return base64Image;
  };

  getStats(): {
    honeybadgerCached: boolean;
    regularImagesCount: number;
    isInitialized: boolean;
  } {
    return {
      honeybadgerCached: this.cache.honeybadgerImage !== null,
      regularImagesCount: this.cache.regularImages.length,
      isInitialized: this.cache.isInitialized,
    };
  }
}

// Export singleton instance
export const imageCache = new ImageCacheManager();
