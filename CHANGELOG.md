# Changelog

All notable changes to this project will be documented in this file.

The format is based on [Keep a Changelog](https://keepachangelog.com/en/1.0.0/),
and this project adheres to [Semantic Versioning](https://semver.org/spec/v2.0.0.html).

## [Unreleased]

## [0.1.3] - 2025-05-13

### Added
- Use processedContent instead of markdown in response
- Improve enrich prompt to not remove any fields from the original JSON object

## [0.1.2] - 2025-05-12

### Added
- Support enriching data
- Handle nullable instead of optional. This is required for schema in OpenAI models

## [0.1.1] - 2025-05-11

### Added
- Initial release with core functionality
- HTML to Markdown conversion with main content extraction
- Structured data extraction with LLM support
- Support for OpenAI and Google Gemini API
- URL validation and fixing
- Comprehensive test suite
