# Deployment Guide

This guide explains how to build and deploy the quiz app to ai-lab.in with optimized asset loading.

## Overview

The app uses a hybrid asset loading strategy:
- **Development** (`npm run dev`): Uses local files from `public/`
- **Preview** (`npm run preview`): Uses local files, tests the production build locally
- **Production** (`npm run build:prod`): Uses remote URLs from ai-lab.in, minimal bundle size

## Build Scripts

### Development (Local Testing)
```bash
npm run dev
```
- Starts dev server at http://localhost:5173
- Uses local files from `public/` directory
- Hot module reloading enabled
- All media files available locally

### Preview (Local Testing of Production Build)
```bash
npm run preview
```
- Builds the app with base path `/` (localhost friendly)
- Excludes media directories from dist
- Uses local files from `public/` (if available in dist)
- Serves at http://localhost:4173
- **Note**: Use this to test locally before production deployment

### Production Build (For ai-lab.in Deployment)
```bash
npm run build:prod
```
- Sets `DEPLOY_ENV=production`
- Builds with base path `/quiz-app/`
- Configures app to use remote URLs from ai-lab.in
- Excludes all media directories from dist
- Minimal bundle size (~100+ MB smaller than including media)

### Standard Build (Testing Only)
```bash
npm run build
```
- Builds with base path `/` (for localhost preview)
- Use `npm run preview` after this to test
- **Note**: Do NOT use this for ai-lab.in deployment

## Deployment Workflow

### 1. Build for Production
```bash
npm run build:prod
```
This will:
- Clean the dist folder
- Transform code for production
- Exclude media directories
- Generate optimized assets

### 2. Verify Build
Check that dist/ has these directories:
```
dist/
├── assets/          (JS/CSS bundles)
├── config/          (config.json)
├── learn/           (learn manifests and data)
├── quizzes/         (quiz data)
├── index.html       (main page)
```

⚠️ These should NOT be in dist:
- `audio/`
- `images/`
- `images_downloaded/`
- `countries_images/`

### 3. Deploy to ai-lab.in
Copy `dist/` folder to your web server:
```bash
scp -r dist/* user@ai-lab.in:/path/to/quiz-app/
```

### 4. Verify Server Has Media Files
Ensure these directories exist on ai-lab.in:
- `https://ai-lab.in/data/quiz-app/audio/`
- `https://ai-lab.in/data/quiz-app/images/`
- `https://ai-lab.in/data/quiz-app/images_downloaded/`
- `https://ai-lab.in/data/quiz-app/countries_images/`

### 5. Test in Production
1. Open https://ai-lab.in/quiz-app
2. Check Browser DevTools Network tab:
   - Assets should load from `/quiz-app/assets/`
   - Images should load from `https://ai-lab.in/data/quiz-app/images/`
   - Audio should load from `https://ai-lab.in/data/quiz-app/audio/`
3. Test Learn screen for images and audio
4. Test Paint screen for image loading

## Environment Detection

The app automatically detects the environment:

```javascript
const isProd = location.hostname.includes('ai-lab.in');
```

- On `ai-lab.in`: Uses remote URLs from `https://ai-lab.in/data/quiz-app/`
- On `localhost`: Uses local files from `public/`
- On other domains: Would use remote URLs (update if needed)

## Troubleshooting

### Blank Page on localhost:4173
**Cause**: Build configuration issue
**Solution**: Run `npm run preview` (not just rebuilding manually)

### Assets Not Loading (404 errors)
**Cause**: Base path mismatch
**Solution**: 
- For localhost: Use default `npm run build` then `npm run preview`
- For ai-lab.in: Use `npm run build:prod`

### Images/Audio Not Loading in Production
**Cause**: Media files not on server or wrong URL
**Solution**:
1. Verify media directories exist on ai-lab.in at expected paths
2. Check browser Network tab to see the actual URL being requested
3. Verify file names match between local and server

### Deployment Bundle Too Large
**Cause**: Media files were included in dist
**Solution**: Use `npm run build:prod` (not `npm run build`)

## File Structure Reference

### Local Repository
```
public/
├── audio/                    (committed to git)
├── images/                   (committed to git)
├── images_downloaded/        (committed to git)
├── countries_images/         (committed to git)
├── learn/                    (learn data - served locally)
├── quizzes/                  (quiz data - served locally)
└── config/                   (config - served locally)
```

### Production Server (ai-lab.in)
```
/quiz-app/                    (dist folder contents)
├── assets/
├── config/
├── learn/
├── quizzes/
└── index.html

/data/quiz-app/               (media files, separate from app)
├── audio/
├── images/
├── images_downloaded/
└── countries_images/
```

## Advanced: Testing Production URLs Locally

To test production mode without deploying:

```bash
# Build for production
npm run build:prod

# Manually test by modifying the app:
# 1. Edit src/config/assetUrls.js
# 2. Change: const isProd = true;
# 3. Rebuild and preview
npm run preview
```

This lets you test remote URL loading before deployment (media files will fail to load locally, but you can see the URLs being requested).

## CI/CD Notes

For automated deployment:
1. Use `npm run build:prod` in your CI pipeline
2. Deploy `dist/` to ai-lab.in
3. Ensure media files are pre-staged on ai-lab.in
4. Test with `npm run test` before deploying
