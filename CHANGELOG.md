# Changelog

All notable changes to this project will be documented in this file.

The format is based on [Keep a Changelog](https://keepachangelog.com/en/1.0.0/),
and this project adheres to [Semantic Versioning](https://semver.org/spec/v2.0.0.html).

## [Unreleased]

## [0.2.0] - 2025-08-02
- Added playwright browser

## [0.1.9] - 2025-06-28

### Added
- Added cleanUrl field in HTMLExtractionOptions - when enabled, it will clean tracking parameters from Amazon product URLs

### Changed
- Used Gemini 2.5 flash model instead of the preview version

## [0.1.8] - 2025-06-16

### Changed
- Use extractionContext to provide additional context (e.g. metadata, not limited to partial data)

## [0.1.7] - 2025-06-07

### Changed
- Updated README to use @lightfeed/extractor as new npm project

## [0.1.6] - 2025-06-07

### Changed
- Updated project name to lightfeed/extractor and publish to npm project @lightfeed/extractor

## [0.1.5] - 2025-05-14

### Fixed
- Improved main html content extraction - preserve option, label and select (can be important for product detail pages)

## [0.1.4] - 2025-05-13

### Fixed
- Fixed schema conversion bug when input zod schema is from a different zod version

## [0.1.3] - 2025-05-13

### Added
- Used processedContent instead of markdown in response
- Improved enrich prompt to not remove any fields from the original JSON object

## [0.1.2] - 2025-05-12

### Added
- Supported enriching data
- Handled nullable instead of optional in schema. This is required for schema in OpenAI models

## [0.1.1] - 2025-05-11

### Added
- Initial release with core functionality
- HTML to Markdown conversion with main content extraction
- Structured data extraction with LLM support
- Support for OpenAI and Google Gemini API
- URL validation and fixing
- Comprehensive test suite
