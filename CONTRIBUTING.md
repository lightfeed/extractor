# Contributing to lightfeed-extract

Thank you for considering contributing to lightfeed-extract! This document outlines the process for contributing to the project and releasing new versions.

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
1. Unit tests - Run across multiple Node.js versions (16.x, 18.x, 20.x)
2. Integration tests - Run on Node.js 20.x using provided API secrets

### Setting up API keys for CI

To enable integration tests in CI, add your API keys as secrets in your GitHub repository:

1. Go to your GitHub repository
2. Click on "Settings" > "Secrets and variables" > "Actions"
3. Add the following secrets:
   - `OPENAI_API_KEY` - Your OpenAI API key
   - `GOOGLE_API_KEY` - Your Google API key

## Release Process

This project uses semantic versioning. To create a new release:

1. Update the version in `package.json`
2. Update the `CHANGELOG.md` with details of the changes
3. Commit these changes with a message like "Bump version to x.y.z"
4. Create and push a new tag:
   ```
   git tag -a vx.y.z -m "Release version x.y.z"
   git push origin vx.y.z
   ```

When you push a new tag prefixed with "v" (e.g., v1.0.0), GitHub Actions will automatically:
1. Build the package
2. Run unit tests
3. Create a GitHub Release with notes from your git history
4. Publish the package to npm
