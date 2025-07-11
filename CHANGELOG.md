# Changelog

All notable changes to this project will be documented in this file.

The format is based on [Keep a Changelog](https://keepachangelog.com/en/1.0.0/),
and this project adheres to [Semantic Versioning](https://semver.org/spec/v2.0.0.html).

## [Unreleased]

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