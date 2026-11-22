// Guest browser checks; never creates accounts or writes to the production database.
// Start the isolated laboratory with POLYMATH_SQL_LAB=1 npm run dev first.
import assert from 'node:assert/strict';
import fs from 'node:fs/promises';
import path from 'node:path';
import puppeteer from 'puppeteer-core';
import axe from 'axe-core';

const base = process.env.POLYMATH_BROWSER_URL || 'http://127.0.0.1:8000';
if (!/^http:\/\/127\.0\.0\.1:\d+$/.test(base)) throw new Error('Browser tests must target an isolated local laboratory.');
const chrome = process.env.CHROME_PATH || '/Applications/Google Chrome.app/Contents/MacOS/Google Chrome';
const screenshotDir = process.env.POLYMATH_BROWSER_SCREENSHOTS;
const course = JSON.parse(await fs.readFile(new URL('../backend/sql/sql-course.json', import.meta.url), 'utf8'));
const checks = [], accessibility = [], errors = [];
const browser = await puppeteer.launch({executablePath: chrome, headless: true, args: ['--no-first-run']});
const page = await browser.newPage();
page.setDefaultTimeout(15000);
page.on('pageerror', error => errors.push(error.message));

async function ready() {
  await page.waitForFunction(() => window.PolymathApp && document.querySelector('#main-content h1') && !window.PolymathAccount?.loading && !window.PolymathAccount?.authenticating);
}
async function route(hash) {
  await page.evaluate(value => new Promise(resolve => {
    if (location.hash === value) { resolve(); return; }
    window.addEventListener('hashchange', () => requestAnimationFrame(() => resolve()), {once: true});
    location.hash = value;
  }), hash);
  await page.waitForFunction(value => location.hash === value && document.querySelector('#main-content h1'), {}, hash);
}
async function fill(selector, value) {
  const field = await page.waitForSelector(selector);
  await field.click();
  await field.evaluate(element => element.select());
  await field.type(value);
}
async function snapshot() {
  return page.evaluate(() => window.PolymathApp.snapshot().state);
}
async function runSQL(query, correct, code, keyboard = false) {
  await fill('#sql-editor', query);
  const pending = page.waitForResponse(response => response.url() === base + '/api/sql-lab' && response.request().method() === 'POST');
  if (keyboard) {
    await page.keyboard.down('Control');
    await page.keyboard.press('Enter');
    await page.keyboard.up('Control');
  } else await page.click('#run-sql');
  const response = await pending;
  const result = await response.json();
  await page.waitForFunction(() => !document.querySelector('#run-sql').disabled && document.querySelector('#sql-feedback').classList.contains('feedback'));
  assert.equal(result.correct === true, correct, JSON.stringify(result));
  if (code) assert.equal(result.errorCode, code);
  assert.equal(await page.$eval('#sql-feedback', element => element.classList.contains('success')), correct);
  if (correct) {
    assert.ok(await page.$('#sql-result table'), 'Correct result must be rendered as a table.');
    const rendered = await page.$$eval('#sql-result tbody tr', rows => rows.map(row => [...row.cells].map(cell => cell.textContent)));
    assert.deepEqual(rendered, result.rows.map(row => row.map(value => value === null ? 'NULL' : String(value))));
  }
  return result;
}
async function screenshot(name) {
  if (!screenshotDir) return;
  await fs.mkdir(screenshotDir, {recursive: true});
  await page.screenshot({path: path.join(screenshotDir, name + '.png'), fullPage: true});
}
async function audit(name) {
  await page.addScriptTag({content: axe.source});
  const results = await page.evaluate(async () => {
    const result = await axe.run(document, {runOnly: {type: 'tag', values: ['wcag2a', 'wcag2aa', 'wcag21a', 'wcag21aa', 'wcag22aa']}});
    return result.violations.map(v => ({id: v.id, impact: v.impact, nodes: v.nodes.map(n => ({target: n.target, summary: n.failureSummary}))}));
  });
  accessibility.push({page: name, violations: results});
}
async function noOverflow(name) {
  const dimensions = await page.evaluate(() => ({viewport: document.documentElement.clientWidth, page: document.documentElement.scrollWidth}));
  assert.ok(dimensions.page <= dimensions.viewport + 1, `${name} overflows: ${JSON.stringify(dimensions)}`);
}

try {
  await page.setViewport({width: 1280, height: 900});
  await page.goto(base, {waitUntil: 'networkidle0'});
  await ready();
  assert.equal((await snapshot()).xp, 0, 'New browser profile starts as a guest with no XP.');
  assert.equal(await page.$eval('#domain-meter', el => el.textContent), '-');
  await audit('desktop-home');
  await screenshot('desktop-home');
  // Reload starts the keyboard sequence at the beginning of the document.
  await page.reload({waitUntil: 'networkidle0'});
  await ready();
  await page.keyboard.press('Tab');
  assert.equal(await page.evaluate(() => document.activeElement.className), 'skip-link');
  await page.keyboard.press('Enter');
  assert.equal(await page.evaluate(() => document.activeElement.id), 'main-content');
  assert.notEqual(await page.evaluate(() => location.hash), '#main-content', 'Skip link must not change the app route.');
  await page.focus('#domain-meter');
  await page.keyboard.press('Enter');
  await page.waitForSelector('#domain-meter-dialog[open]');
  assert.equal(await page.$('.home .home-activity, .home [data-save-status]'), null);
  assert.deepEqual(await page.$$eval('.meter-activity li strong', items => items.map(item => item.textContent)), ['0', '0', '0 XP']);
  assert.equal(await page.evaluate(() => !!document.activeElement.closest('#domain-meter-dialog')), true);
  for (let i = 0; i < 4; i++) {
    await page.keyboard.press('Tab');
    assert.equal(await page.evaluate(() => document.querySelector('#domain-meter-dialog').matches(':modal') && (!!document.activeElement.closest('#domain-meter-dialog') || document.activeElement === document.body)), true, 'The native modal must not expose background controls to Tab.');
  }
  await page.keyboard.press('Escape');
  assert.equal(await page.evaluate(() => document.activeElement.id), 'domain-meter');
  checks.push('keyboard-skip-link-dialog-focus-restoration');

  await route('#lectie?ex=s1-all&etapa=practica');
  await page.waitForSelector('#sql-editor');
  await runSQL('SELECT FROM customers', false, 'syntax');
  assert.match(await page.$eval('#sql-feedback', el => el.textContent), /nu a putut fi executată/);
  await runSQL('SELECT name FROM customers', false, 'columns');
  assert.match(await page.$eval('#sql-feedback', el => el.textContent), /rulează/);
  for (let i = 1; i <= 3; i++) {
    await page.click('#hint-button');
    assert.equal(await page.$$eval('#hint-list li', elements => elements.length), i);
  }
  assert.equal(await page.$eval('#hint-button', el => el.disabled), true);
  const longWrongQuery = 'SELECT name AS [' + 'coloana_lunga_'.repeat(45) + '] FROM customers';
  await runSQL(longWrongQuery, false, 'columns');
  await route('#greseli');
  await page.waitForSelector('.review-item');
  assert.match(await page.$eval('.review-item', el => el.textContent), /coloane/);
  assert.equal(await page.$eval('.review-query', el => el.textContent), longWrongQuery);
  await page.reload({waitUntil: 'networkidle0'});
  await ready();
  assert.equal((await snapshot()).sqlPractice.records['s1-all'].needsReview, true);
  await audit('desktop-review-pending');
  checks.push('sql-syntax-wrong-result-progressive-hints-mistakes-reload');

  await route('#lectie?ex=s1-all&etapa=practica');
  await page.waitForSelector('#sql-editor');
  const beforeNetwork = (await snapshot()).sqlPractice.records['s1-all'].attempts;
  await page.setRequestInterception(true);
  const abortSQL = request => request.url() === base + '/api/sql-lab' && request.method() === 'POST' ? request.abort('failed') : request.continue();
  page.on('request', abortSQL);
  await fill('#sql-editor', 'SELECT * FROM customers');
  await page.click('#run-sql');
  await page.waitForFunction(() => document.querySelector('#sql-feedback').textContent.includes('conexiune'));
  assert.equal((await snapshot()).sqlPractice.records['s1-all'].attempts, beforeNetwork, 'Network failure must not become a learning mistake.');
  assert.equal(await page.$eval('#sql-editor', el => el.value), 'SELECT * FROM customers');
  page.off('request', abortSQL);
  await page.setRequestInterception(false);
  checks.push('network-error-retains-query-without-recording-mistake');

  await route('#lectie?ex=s1-all&etapa=teorie');
  for (const [index, ex] of course.exercises.entries()) {
    const firstOfLesson = course.lessons.find(lesson => lesson.exercises[0] === ex.id);
    if (firstOfLesson) {
      await page.waitForSelector('.reader .code-example');
      assert.equal(await page.$eval('.code-example', el => el.textContent), firstOfLesson.example);
      assert.ok(await page.$$eval('.reader table caption', caps => caps.some(c => c.textContent.includes('Rezultatul exemplului'))));
      assert.match(await page.$eval('.reader', el => el.textContent), /De reținut/);
      if (index === 0) await audit('desktop-sql-theory');
      await page.click('.reader-next a');
    }
    await page.waitForFunction(({id, prompt}) => new URLSearchParams(location.hash.split('?')[1]).get('ex') === id && !!document.querySelector('#sql-editor') && document.querySelector('.task-prompt')?.textContent === prompt, {}, ex);
    await runSQL(ex.reference, true, undefined, index === 0);
    assert.equal((await snapshot()).xp, (index + 1) * 20);
    if (index === 0) {
      await audit('desktop-sql-practice');
      await screenshot('desktop-sql-practice');
    }
    if (index < course.exercises.length - 1) await page.click('#next-exercise a');
  }
  assert.equal((await snapshot()).xp, 300);
  assert.equal(Object.values((await snapshot()).sqlPractice.records).filter(r => r.passed).length, 15);
  await route('#proiect');
  await page.waitForFunction(() => document.querySelector('#main-content').textContent.includes('3/3'));
  await audit('desktop-final-project');
  checks.push('all-six-theories-and-fifteen-sql-exercises-final-project');

  await route('#lectie?ex=s4-price&etapa=practica');
  await page.waitForSelector('#sql-editor');
  await runSQL('SELECT name, price FROM products ORDER BY price DESC, id DESC', false, 'check-data');
  await page.click('#alternate-data');
  await page.waitForFunction(() => location.hash.includes('date=1') && document.querySelector('.schema-note').textContent.includes('Setul 2'));
  await runSQL(course.exercises.find(ex => ex.id === 's4-price').reference, true);
  assert.equal((await snapshot()).xp, 300, 'Repeat on alternate data must not award new XP.');
  await page.click('#clear-sql');
  assert.equal(await page.$eval('#sql-editor', el => el.value), '');
  assert.equal((await snapshot()).xp, 300);
  await route('#greseli');
  await page.waitForSelector('[data-filter="resolved"]');
  await page.click('[data-filter="resolved"]');
  assert.equal(await page.$eval('[data-filter="resolved"]', el => el.getAttribute('aria-pressed')), 'true');
  assert.equal(await page.evaluate(() => document.activeElement.dataset.filter), 'resolved');
  await page.focus('[data-filter="pending"]');
  await page.keyboard.press('Enter');
  assert.equal(await page.evaluate(() => document.activeElement.dataset.filter), 'pending');
  await page.focus('[data-filter="resolved"]');
  await page.keyboard.press('Enter');
  assert.equal(await page.evaluate(() => document.activeElement.dataset.filter), 'resolved');
  assert.equal(await page.$$eval('.review-item', elements => elements.length), 2);
  assert.ok(await page.$$eval('.review-query', items => items.some(el => el.textContent.includes('coloana_lunga_'))), 'Resolved mistakes retain the failed query.');
  checks.push('alternate-data-secondary-order-check-resolved-history-repeat-xp-reset');

  await route('#limba?etapa=teorie');
  await page.waitForSelector('.reader-next a');
  assert.match(await page.$eval('#main-content', el => el.textContent), /infinitiv/);
  await page.click('.reader-next a');
  await page.waitForSelector('#translate-dialogue');
  assert.equal(await page.$$eval('.dialogue-ro', items => items.every(el => el.hidden)), true);
  await page.click('#translate-dialogue');
  assert.equal(await page.$$eval('.dialogue-ro', items => items.every(el => !el.hidden)), true);
  assert.equal(await page.$eval('#translate-dialogue', el => el.getAttribute('aria-expanded')), 'true');
  assert.equal(await page.$$eval('[data-speak]', items => items.every(el => !!el.getAttribute('aria-label'))), true);
  await page.click('.reader-next a');
  await page.waitForSelector('#language-form');
  for (const [i, answer] of ['vendre', 'comment', 'prix'].entries()) await fill(`[name="answer-${i}"]`, answer);
  await page.click('#language-form button[type="submit"]');
  assert.equal(await page.$$eval('.answer-feedback', items => items.filter(el => !el.hidden && el.textContent).length), 3);
  assert.match(await page.$eval('#answer-feedback-0', el => el.textContent), /vinde/);
  assert.equal((await snapshot()).languagePractice.needsReview, true);
  for (let i = 0; i < 3; i++) await page.click('#language-hint');
  assert.equal(await page.$eval('#language-hint', el => el.disabled), true);
  await page.reload({waitUntil: 'networkidle0'});
  await ready();
  assert.equal(await page.$eval('[name="answer-0"]', el => el.value), 'vendre');
  for (const [i, answer] of ['acheter', 'combien', 'combien'].entries()) await fill(`[name="answer-${i}"]`, answer);
  await page.click('#language-form button[type="submit"]');
  assert.equal((await snapshot()).xp, 320);
  assert.equal(await page.$$eval('.cloze-input', items => items.every(el => el.getAttribute('aria-invalid') === 'false')), true);
  await page.click('#language-form button[type="submit"]');
  assert.equal((await snapshot()).xp, 320);
  await page.click('#language-reset');
  assert.equal(await page.$$eval('.cloze-input', items => items.every(el => el.value === '')), true);
  assert.equal((await snapshot()).xp, 320);
  assert.equal((await snapshot()).languagePractice.completed, true);
  assert.equal(await page.evaluate(() => document.activeElement.name), 'answer-0');
  await route('#limba?etapa=teorie');
  await route('#limba?etapa=practica');
  await page.waitForSelector('#language-form');
  assert.equal(await page.$$eval('.cloze-input', items => items.every(el => el.value === '')), true);
  assert.equal(await page.$eval('#language-meter', el => el.getAttribute('aria-valuenow')), '0');
  assert.match(await page.$eval('#language-count', el => el.textContent), /Verifică|verificate/);
  await audit('desktop-french-practice');
  await screenshot('desktop-french-practice');
  checks.push('french-theory-dialogue-translation-feedback-reload-resolution-repeat-reset');

  await page.reload({waitUntil: 'networkidle0'});
  await ready();
  assert.equal((await snapshot()).xp, 320);
  assert.equal((await snapshot()).languagePractice.needsReview, false);
  await route('#greseli');
  await page.waitForSelector('[data-filter="resolved"]');
  await page.click('[data-filter="resolved"]');
  assert.equal(await page.$$eval('.review-item', elements => elements.length), 3);
  checks.push('guest-completion-and-three-resolved-mistakes-survive-reload');

  for (const width of [1280, 375]) {
    await page.setViewport({width, height: 900});
    for (const [name, hash] of [
      ['home', '#acasa'], ['catalog', '#cursuri'], ['sql-theory', '#lectie?ex=s5-inner&etapa=teorie'],
      ['sql-practice', '#lectie?ex=p3&etapa=practica'], ['french', '#limba?etapa=practica'],
      ['review', '#greseli'], ['progress', '#progres'], ['project', '#proiect'],
    ]) {
      await route(hash);
      if (name === 'review') await page.click('[data-filter="resolved"]');
      await noOverflow(`${width}-${name}`);
      if (width === 375 && ['home', 'sql-practice', 'french', 'review', 'progress'].includes(name)) await audit(`mobile-${name}`);
      if (width === 375 && ['sql-practice', 'french', 'review'].includes(name)) await screenshot(`mobile-${name}`);
    }
  }
  await route('#lectie?ex=p3&etapa=practica');
  await page.focus('#outline-button');
  await page.keyboard.press('Enter');
  await page.waitForSelector('#course-dialog[open]');
  await page.keyboard.press('Escape');
  assert.equal(await page.evaluate(() => document.activeElement.id), 'outline-button');
  await page.emulateMediaFeatures([{name: 'prefers-reduced-motion', value: 'reduce'}]);
  await noOverflow('mobile-reduced-motion');
  checks.push('desktop-and-375px-reflow-essential-pages-mobile-outline-keyboard-reduced-motion');

  await page.goto(base + '/biblioteca.html#invata?lesson=path-en-animals&pane=practice');
  await page.waitForSelector('#user-answer-input', {visible:true});
  await fill('#user-answer-input', 'dog');
  await page.click('#verify-btn');
  await page.waitForFunction(() => window.PolymathApp.snapshot().state.xp === 15);
  await page.goto(base + '/#progres');
  await page.waitForFunction(() => document.querySelector('.progress-summary strong')?.textContent === '335');
  await page.click('#domain-meter');
  assert.equal(await page.$eval('.meter-activity [data-xp]', item => item.textContent), '335 XP');
  await page.click('.meter-activity a[href="/#progres"]');
  await page.waitForSelector('#domain-meter-dialog', {hidden:true});
  await page.waitForFunction(() => document.querySelector('[data-domain-summary]')?.textContent.includes('1 / 26'));
  await route('#acasa');
  assert.match(await page.$eval('.home-continuation a', a => a.href), /lesson=path-en-animals&pane=practice$/);
  await page.click('.home-continuation a');
  await page.waitForSelector('#user-answer-input', {visible:true});
  assert.equal(await page.evaluate(() => window.PolymathApp.snapshot().state.xp), 15);
  checks.push('combined-guest-xp-domain-progress-resume-without-duplicate-awards');

  await page.goto(base + '/#acasa');
  await ready();
  await page.focus('#account-control button');
  await page.keyboard.press('Enter');
  await page.waitForSelector('.appearance-picker');
  assert.equal(await page.evaluate(() => document.activeElement.id), 'auth-title');
  assert.equal(await page.$eval('#auth-title', title => getComputedStyle(title).outlineStyle), 'none');
  await page.focus('#profile-tab-account');
  await page.keyboard.press('ArrowRight');
  assert.notEqual(await page.$eval('#profile-tab-colors', tab => getComputedStyle(tab).outlineStyle), 'none');
  assert.equal(await page.$eval('#profile-tab-colors', tab => tab.getAttribute('aria-selected')), 'true');
  assert.equal(await page.$$eval('#profile-pane-colors input[name=appearance]', options => options.length), 8);
  await page.click('input[name=banner][value="grid"]');
  assert.equal(await page.$eval('.profile-cover', el => el.dataset.pattern), 'grid');
  await page.reload({waitUntil:'networkidle0'});
  await page.click('#account-control button');
  await page.click('#profile-tab-colors');
  assert.equal(await page.$eval('input[name=banner]:checked', el => el.value), 'grid');
  await audit('mobile-profile-colors');
  await page.click('input[name="appearance"][value="cyber-dark"]');
  await page.keyboard.press('Escape');
  await page.goto(base + '/sql-university.html?ex=5-14');
  await page.waitForSelector('#terminal-input', {visible:true});
  assert.equal(await page.evaluate(() => document.documentElement.dataset.theme), 'cyber-dark');
  assert.ok(await page.$eval('#terminal-input', e => e.getBoundingClientRect().top < innerHeight * .65));
  await audit('mobile-university-night');
  await page.click('#picker-toggle');
  await page.select('#exercise-select', '5-18');
  assert.equal(await page.$eval('#picker-toggle', e => e.getAttribute('aria-expanded')), 'false');
  assert.match(page.url(), /ex=5-18/);
  checks.push('university-mobile-night-editor-and-exercise-picker');

  assert.deepEqual(errors, [], 'Browser must not emit uncaught JavaScript errors.');
  const violations = accessibility.filter(result => result.violations.length);
  console.log(JSON.stringify({checks, accessibility, uncaughtErrors: errors}, null, 2));
  assert.deepEqual(violations, [], 'Fix accessibility violations listed in the browser report.');
  console.log(`PASS: ${checks.length} browser journeys; ${accessibility.length} axe audits; combined guest XP 335.`);
} catch (error) {
  console.error(JSON.stringify({completedChecks: checks, currentURL: page.url(), accessibility, uncaughtErrors: errors}, null, 2));
  await screenshot('failure');
  throw error;
} finally {
  await browser.close();
}
