const playwright = require('playwright');
const fs = require('fs').promises;

(async () => {
    // for (const browserType of ['chromium', 'firefox', 'webkit']) {
    //     const browser = await playwright[browserType].launch();
    //     const context = await browser.newContext();
    //     const page = await context.newPage();
    //     await page.goto("https://github.com/BrahyanPro");
    //     await page.screenshot({path: `brahyanpro${browserType}.png`, fullPage: true});
    //     await page.waitForTimeout(1000);
    //     await browser.close();
    // };

    const browser = await playwright.chromium.launch();
    const context = await browser.newContext();
    const page = await context.newPage();
    await page.goto("https://soft.uasd.edu.do/PensumGrado/?periodoV=999999&programa=P-APLA&plan=200820&nivel=GR", { waitUntil: 'networkidle' });
    await page.screenshot({path: `softuasd.png`, fullPage: true});
    await page.waitForTimeout(1000);
    await browser.close();
})();