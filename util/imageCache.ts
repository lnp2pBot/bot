import { logger } from '../logger';
import path from 'path';
import { ImageProcessingError } from './errors';

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
              honeybadgerFilename.toLowerCase(),
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
          process.env.GOLDEN_HONEY_BADGER_PROBABILITY || '100',
        );
        const probability = isNaN(goldenProbability)
          ? 100
          : Math.max(1, goldenProbability);
        const luckyNumber = Math.floor(Math.random() * probability) + 1;
        const winningNumber = 1;

        logger.debug(
          `Golden Honey Badger probability check: ${luckyNumber}/${probability} (wins if ${luckyNumber}=${winningNumber})`,
        );

        if (luckyNumber === winningNumber) {
          randomImage = this.cache.honeybadgerImage;
          isGoldenHoneyBadger = true;
          logger.info(
            `🏆 GOLDEN HONEY BADGER ASSIGNED to order with nonce: ${nonce} - FEES WILL BE ZERO`,
          );
          return { randomImage, isGoldenHoneyBadger };
        }
      }

      // Select random regular image
      if (this.cache.regularImages.length > 0) {
        const randomIndex = Math.floor(
          Math.random() * this.cache.regularImages.length,
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
   * The image is from the images directory (if it's a filename) or returns the image if it's already base64
   * @param image Image file name or base64 string
   * @returns Image base64 string
   *
   *  throws @ImageProcessingError
   */
  convertImageToBase64 = async (image: string) => {
    try {
      // Check if the image is already base64 data (legacy format)
      // Base64 strings are much longer than filenames and typically don't contain file extensions in the middle
      if (
        image.length > 100 &&
        !image.includes('.png') &&
        !image.includes('.jpg') &&
        !image.includes('.jpeg')
      ) {
        logger.debug('Image appears to be base64 data, returning as-is');
        return image;
      }

      // Otherwise, treat as filename and read from disk
      const imageData = await fs.readFile(`images/${image}`);
      return imageData.toString('base64');
    } catch (error) {
      logger.error(`Error in convertImageToBase64: ${error}, image: ${image}`);
      throw new ImageProcessingError(`Failed to convert image ${image}`, image);
    }
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
