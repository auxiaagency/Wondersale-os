import react from '@vitejs/plugin-react'
import { defineConfig } from 'vite'
import { execSync } from 'child_process'
import pkg from './package.json'

// Retrieve latest Git metadata safely
const getGitInfo = () => {
  let commitHash = 'dev';
  let commitCount = '1';
  let commitDate = new Date().toLocaleDateString('en-GB', { day: '2-digit', month: 'short', year: 'numeric' });
  let commitMsg = 'Development build';

  try {
    commitHash = execSync('git rev-parse --short HEAD', { stdio: ['pipe', 'pipe', 'ignore'] }).toString().trim();
  } catch (e) {
    // ignore git error
  }

  try {
    commitCount = execSync('git rev-list --count HEAD', { stdio: ['pipe', 'pipe', 'ignore'] }).toString().trim();
  } catch (e) {
    // ignore git error
  }

  try {
    commitDate = execSync('git log -1 --format="%cd" --date=format:"%d %b %Y, %I:%M %p"', { stdio: ['pipe', 'pipe', 'ignore'] }).toString().trim();
  } catch (e) {
    // ignore git error
  }

  try {
    const rawMsg = execSync('git log -1 --pretty=%B', { stdio: ['pipe', 'pipe', 'ignore'] }).toString().trim();
    commitMsg = rawMsg.split('\n')[0] || 'Latest build';
  } catch (e) {
    // ignore git error
  }

  return { commitHash, commitCount, commitDate, commitMsg };
};

const gitInfo = getGitInfo();

// https://vite.dev/config/
export default defineConfig({
  plugins: [react()],
  define: {
    __APP_VERSION__: JSON.stringify(`v${pkg.version || '1.0.0'}`),
    __APP_BUILD_NUMBER__: JSON.stringify(gitInfo.commitCount),
    __APP_COMMIT_HASH__: JSON.stringify(gitInfo.commitHash),
    __APP_COMMIT_DATE__: JSON.stringify(gitInfo.commitDate),
    __APP_COMMIT_MSG__: JSON.stringify(gitInfo.commitMsg),
    __APP_GITHUB_REPO__: JSON.stringify('https://github.com/auxiaagency/Wondersale-os'),
  },
  server: {
    allowedHosts: ['*', "mountains-highlight-glance-valuation.trycloudflare.com"],
    port: 5173,
    proxy: {
      '/api': {
        target: 'http://127.0.0.1:8000',
        changeOrigin: true,
      },
      '/media': {
        target: 'http://127.0.0.1:8000',
        changeOrigin: true,
      }
    }
  }
})


