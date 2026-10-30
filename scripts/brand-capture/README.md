# brand-capture

Scripts that screenshot a product (website or app) into `shared/brands/<brand>/captures/`, so videos show the real UI
without touching the product repo (Rule #1: product repos are read-only).

Write one script per brand, e.g. `scripts/brand-capture/<brand>.cjs` with Playwright:

```js
const { chromium } = require('playwright');      // npm i -D playwright && npx playwright install chromium
const path = require('node:path');
const OUT = path.resolve(__dirname, '../../shared/brands/<brand>/captures');

(async () => {
  const browser = await chromium.launch();
  const page = await browser.newPage({ viewport: { width: 1440, height: 900 }, deviceScaleFactor: 2 });
  await page.goto('https://example.com');
  await page.screenshot({ path: path.join(OUT, '01-home.png') });
  await browser.close();
})();
```

Rules: run against a local or public build, never write into the product repo, and name files `<NN>-<page>.png`
so storyboards can refer to them.
