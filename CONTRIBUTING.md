# Contributing to lightfeed/extractor

Thank you for considering contributing to lightfeed/extractor! This document outlines the process for contributing to the project and releasing new versions.

## Development Workflow

1. Fork the repository
2. Create a feature branch (`git checkout -b feature/amazing-feature`)
3. Make your changes
4. Run tests to ensure everything works:
   - `npm run test:unit` - Run unit tests
   - `npm run test:integration` - Run integration tests (requires API keys)
   - `npm run test:html2md` - Run HTML to Markdown tests
5. Commit your changes (`git commit -m 'Add some amazing feature'`)
6. Push to the branch (`git push origin feature/amazing-feature`)
7. Open a Pull Request

## CI/CD Pipeline

This project uses GitHub Actions for continuous integration and deployment:

### Testing Workflow

The testing workflow runs automatically:
- On each push to the `main` branch
- On each pull request to the `main` branch
- Weekly on Monday at midnight UTC

The workflow includes:
1. Unit tests - Run across multiple Node.js versions
2. Integration tests - Run on Node.js 20.x using provided API secrets

## Release Process (Maintainers)

This project uses semantic versioning. To create a new release:

```bash
npm version patch  # or minor, or major
git push origin main --tags
```

`npm version` automatically bumps the version in `package.json` and `package-lock.json`, creates a commit, and creates a git tag.

When the tag is pushed, GitHub Actions will automatically:
1. Build the package and run tests
2. Create a GitHub Release with notes generated from git history
3. Publish the package to npm
