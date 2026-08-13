// Smoke test for the two new context features (run against a live dev server).
// Usage: node frontend/e2e-smoke.mjs   (servers expected on :5173 and :8000)
import { chromium } from 'playwright';

const browser = await chromium.launch({ executablePath: '/Users/yangyang/Library/Caches/ms-playwright/chromium-1228/chrome-mac-arm64/Google Chrome for Testing.app/Contents/MacOS/Google Chrome for Testing' });
const page = await browser.newPage();
const failures = [];
const check = (name, cond) => {
  console.log(`${cond ? '✅' : '❌'} ${name}`);
  if (!cond) failures.push(name);
};

try {
  await page.goto('http://localhost:5173', { waitUntil: 'networkidle' });

  // ---- Pain 1: selection resolves to raw Markdown source -------------------
  const selectTextInDocument = async (substr) => {
    await page.evaluate((sub) => {
      const card = document.querySelector('.prose [class*="rounded-md"]');
      const walker = document.createTreeWalker(card, NodeFilter.SHOW_TEXT);
      let node = null;
      while ((node = walker.nextNode())) {
        if (node.textContent.includes(sub)) break;
      }
      node.parentElement.scrollIntoView({ block: 'center' });
      const range = document.createRange();
      range.setStart(node, 0);
      range.setEnd(node, node.textContent.length);
      const sel = window.getSelection();
      sel.removeAllRanges();
      sel.addRange(range);
      document.dispatchEvent(new Event('selectionchange'));
      card.dispatchEvent(new MouseEvent('mouseup', { bubbles: true }));
    }, substr);
    await page.waitForTimeout(200);
  };

  await selectTextInDocument('层级语法示例');
  const addBtn = page.getByRole('button', { name: /加入上下文/ });
  check('floating add-to-context button appears', await addBtn.isVisible());
  await addBtn.click();
  // The first chip should carry the RAW heading source, including "## ".
  const chip1 = page.locator('text=@ctx-1');
  check('context chip @ctx-1 appears', await chip1.isVisible().catch(() => false));
  check('chip label derives from heading text', await page.locator('text=层级语法示例').count() > 0);
  const chipTitle = await page.locator('[title*="## 层级语法示例"]').count();
  check('attached content is raw markdown (## prefix)', chipTitle > 0);

  // Second context: the blockquote, whose source starts with "> ".
  await selectTextInDocument('这是一段引用');
  await page.getByRole('button', { name: /加入上下文/ }).click();
  const chip2Title = await page.locator('[title*="> 这是一段引用"]').count();
  check('second context attached with raw blockquote source (> prefix)', chip2Title > 0);

  // ---- Pain 2: multiple contexts + @ mention in the input ------------------
  const input = page.getByPlaceholder(/对 Agent 下指令/);
  await input.click();
  await input.fill('把 @');
  const popup = page.locator('text=@document').first();
  check('mention popup offers @document', await popup.isVisible());
  check('mention popup offers @ctx-1', await page.locator('text=@ctx-1').first().isVisible());
  check('mention popup offers @ctx-2', await page.locator('text=@ctx-2').first().isVisible());

  // Keyboard selection: ArrowDown past @document → @ctx-1, Enter inserts.
  await page.keyboard.press('ArrowDown');
  await page.keyboard.press('Enter');
  const value1 = await input.inputValue();
  check('Enter inserts @ctx-1 into the message', value1 === '把 @ctx-1 ');

  // Continue typing a second mention and pick @document with the mouse.
  await input.fill('把 @ctx-1 和 @');
  await page.locator('button:has-text("@document")').first().click({ force: true });
  const value2 = await input.inputValue();
  check('mouse click inserts @document', value2 === '把 @ctx-1 和 @document ');

  // Removing a chip removes the context.
  await page.getByRole('button', { name: /移除上下文 ctx-2/ }).click();
  check('removing a chip drops @ctx-2 from suggestions', (await page.locator('text=@ctx-2').count()) === 0);

  await page.screenshot({ path: 'gui-test-screenshots/context-features-smoke.png', fullPage: true });
  console.log('screenshot: gui-test-screenshots/context-features-smoke.png');
} catch (e) {
  console.error('SMOKE TEST ERROR:', e.message);
  await page.screenshot({ path: 'gui-test-screenshots/context-features-error.png', fullPage: true });
  failures.push(`exception: ${e.message}`);
} finally {
  await browser.close();
}

if (failures.length) {
  console.error(`\n${failures.length} check(s) failed:`);
  for (const f of failures) console.error(' -', f);
  process.exit(1);
}
console.log('\nAll smoke checks passed.');
