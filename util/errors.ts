export class ImageProcessingError extends Error {
  constructor(message: string, public readonly imageName?: string) {
    super(message);
    this.name = 'ImageProcessingError';

    Object.setPrototypeOf(this, ImageProcessingError.prototype);
  }
}
