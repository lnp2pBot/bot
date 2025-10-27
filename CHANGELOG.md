# Changelog

All notable changes to this project will be documented in this file.

The format is based on [Keep a Changelog](https://keepachangelog.com/en/1.0.0/),
and this project adheres to [Semantic Versioning](https://semver.org/spec/v2.0.0.html).

## [0.14.3] - 2025-10-27

### Added
- Display Telegram user ID (tgId) in channel notification messages for easier user identification (#708).

### Changed
- Persian (Farsi) translation improvements and corrections (#707).

### Security
- Updated `tar-fs` from 2.1.3 to 2.1.4 (#704).
- Updated `axios` from 1.9.0 to 1.12.0 (#698).

## [0.14.2] - 2025-10-10

### Added
- Serialize hold-invoice processing with a per-order mutex to prevent the cancel-order job from racing against subscription handlers (#705).

### Changed
- The late-payment sweep now notifies admins of overdue trades before expiry and reuses the new per-order locking (#705).
- Temporarily disabled the communities deletion job while the replacement disable flow lands (commit `91ca64e`).

### Fixed
- Updated bot tests to reflect the disabled community-deletion pathway and kept legacy image-cache formatting consistent (#699).

## [0.14.1] - 2025-09-10

### Fixed
- Prevented `convertImageToBase64` from treating legacy base64 payloads as filenames, avoiding `ENAMETOOLONG` errors when processing cached artwork (commit `55230a7`).

## [0.14.0] - 2025-09-10

### Added
- Enriched NIP-69 events with buyer and seller rating metadata to improve marketplace transparency (#689).

### Changed
- Optimized invoice artwork handling by caching image paths and tightening error reporting when attachments fail (#695).
- Adopted Prettier 3.6.2 formatting project-wide, documented the workflow expectations, and wired CI to check formatting at the end of the pipeline (#691).
- Upgraded GitHub Actions checkout to v4 and improved community tooling by normalizing ID comparisons, reusing the shared logger, and guarding solver checks with env validation (#696).

### Fixed
- Stopped community copy from being double-translated during admin flows and corrected unban checks that compared mixed ID types (#696).

### Security
- Updated `form-data`, `sha.js`, `base-x`, and `cipher-base` to the latest patch releases (#679, #694, #692, #693).

## [0.13.3] - 2025-07-11

### Added
- Standardized changelog format following Keep a Changelog guidelines
- Comprehensive project documentation improvements

## [0.13.2] - 2025-07-11

### Fixed
- Improve logic of paytobuyer, setinvoice, settleorder (#677)
- Fix frozen issues (#676)
- Fix git error building image

### Changed
- Optimize order creation performance (#675)
- Image Caching Optimization (#672)

## [0.13.1] - 2024-XX-XX

### Added
- App platform support integration (#670)

### Fixed
- Improve order cancellation logic (#669)
- Replace .warn() by .warning() in logger (#668)

### Changed
- Canvas package requires native compilation (#671)
- Add git to container

## [0.13.0] - 2024-XX-XX

### Added
- TypeScript strict mode implementation (#665)
- Convert ln module to TypeScript (#646)
- Block exchanges between specific users (#630)

### Fixed
- Improve timeout handling and error recovery (#667)

### Changed
- Reduce the size of images within QR invoices (#660)
