import test from 'node:test';
import assert from 'node:assert/strict';
import {readFile} from 'node:fs/promises';
import {fileURLToPath} from 'node:url';
import path from 'node:path';

const here = path.dirname(fileURLToPath(import.meta.url));
const extensionDir = path.join(here, '..', 'extension');

async function source(name) {
  return readFile(path.join(extensionDir, name), 'utf8');
}

test('Dark mode controls are present in the green popup and dashboard UI', async () => {
  const [popupHtml, popupJs, dashboardHtml, dashboardJs, contentJs, contentCss] = await Promise.all([
    source('popup.html'), source('popup.js'), source('dashboard.html'),
    source('dashboard.js'), source('content.js'), source('content.css')
  ]);

  assert.match(popupHtml, /id="darkMode"[^>]*type="checkbox"|type="checkbox"[^>]*id="darkMode"/);
  assert.match(popupJs, /\$\('darkMode'\)/);
  assert.match(dashboardHtml, /id="prefDarkMode"[^>]*type="checkbox"|type="checkbox"[^>]*id="prefDarkMode"/);
  assert.match(dashboardJs, /\$\('prefDarkMode'\)/);
  assert.match(contentJs, /setAttribute\('data-webby-dark-mode'/);
  assert.match(contentCss, /data-webby-active="1"\]\[data-webby-dark-mode="1"\]/);
});
