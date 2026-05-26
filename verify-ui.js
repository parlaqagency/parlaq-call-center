const puppeteer = require('puppeteer');
const fs = require('fs');
const path = require('path');

const screenshotsDir = path.join(__dirname, 'screenshots');
if (!fs.existsSync(screenshotsDir)) fs.mkdirSync(screenshotsDir, { recursive: true });

(async () => {
  let browser;
  try {
    browser = await puppeteer.launch({
      executablePath: 'C:\\Program Files\\Google\\Chrome\\Application\\chrome.exe',
      headless: true,
      defaultViewport: { width: 1024, height: 768 }
    });

    const page = await browser.newPage();

    // Test 1: Login page logo and password toggle
    console.log('📸 Testing Login page...');
    await page.goto('http://localhost:5173', { waitUntil: 'networkidle2' });
    await page.screenshot({ path: path.join(screenshotsDir, '1-login-initial.png') });

    // Check logo dimensions
    const logoSize = await page.evaluate(() => {
      const img = document.querySelector('img[alt="Parlaq"]');
      return img ? { width: img.offsetWidth, height: img.offsetHeight, className: img.className } : null;
    });
    console.log('Logo size:', logoSize);

    // Click password input and check eye icon
    await page.click('input[type="password"]');
    await page.screenshot({ path: path.join(screenshotsDir, '2-password-focused.png') });

    const eyeIcon = await page.evaluate(() => {
      const input = document.querySelector('input[type="password"]');
      const wrapper = input?.closest('div.relative');
      return wrapper ? { hasButton: !!wrapper.querySelector('button'), buttonCount: wrapper.querySelectorAll('button').length } : null;
    });
    console.log('Eye icon present:', eyeIcon);

    // Click eye toggle button
    await page.click('input[type="password"] + button');
    await new Promise(resolve => setTimeout(resolve, 300));
    await page.screenshot({ path: path.join(screenshotsDir, '3-password-toggled.png') });

    const passwordType = await page.evaluate(() => {
      return document.querySelector('input[placeholder="••••••••"]')?.type;
    });
    console.log('Password field type after toggle:', passwordType);

    // Test 2: Admin modal
    console.log('\n📸 Testing Admin Modal...');
    await page.evaluate(() => {
      const buttons = Array.from(document.querySelectorAll('button'));
      const adminBtn = buttons.find(b => b.textContent.includes('Admin'));
      if (adminBtn) adminBtn.click();
    });
    await new Promise(resolve => setTimeout(resolve, 500));
    await page.screenshot({ path: path.join(screenshotsDir, '4-admin-modal.png') });

    const adminPasswordVisible = await page.evaluate(() => {
      const modal = document.querySelector('[class*="bg-black"]');
      return modal ? {
        hasPasswordInput: !!modal.querySelector('input[type="password"], input[type="text"][placeholder="••••••••"]'),
        hasEyeButton: !!modal.querySelector('button')
      } : null;
    });
    console.log('Admin modal password setup:', adminPasswordVisible);

    // Close modal
    await page.click('[class*="bg-black"]');
    await new Promise(resolve => setTimeout(resolve, 300));

    // Test 3: Setup Admin page
    console.log('\n📸 Testing Setup Admin page...');
    await page.goto('http://localhost:5173/setup-admin', { waitUntil: 'networkidle2' });
    await page.screenshot({ path: path.join(screenshotsDir, '5-setup-admin.png') });

    const setupLogoSize = await page.evaluate(() => {
      const img = document.querySelector('img[alt="Parlaq"]');
      return img ? { width: img.offsetWidth, height: img.offsetHeight } : null;
    });
    console.log('Setup admin logo size:', setupLogoSize);

    const passwordFields = await page.evaluate(() => {
      const inputs = Array.from(document.querySelectorAll('input[type="password"], input[type="text"][placeholder*="•"]'));
      return inputs.length;
    });
    console.log('Password fields in setup:', passwordFields);

    console.log('\n✅ Screenshots saved to:', screenshotsDir);
    console.log('Check: 1-login-initial.png, 2-password-focused.png, 3-password-toggled.png, 4-admin-modal.png, 5-setup-admin.png');

  } catch (error) {
    console.error('Error during verification:', error.message);
  } finally {
    if (browser) await browser.close();
  }
})();
