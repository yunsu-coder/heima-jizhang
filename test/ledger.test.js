'use strict';

const assert = require('node:assert/strict');
const fs = require('fs');
const os = require('os');
const path = require('path');
const test = require('node:test');
const {
  LedgerStore,
  parseAmountToCents,
  isValidDate,
  formatCents
} = require('../src/ledger');
const { DEFAULT_CATEGORIES, findCategory } = require('../src/categories');

function createTempStore() {
  const directory = fs.mkdtempSync(path.join(os.tmpdir(), 'heima-ledger-'));
  const filePath = path.join(directory, 'ledger.json');
  const store = new LedgerStore(filePath);
  return { directory, filePath, store };
}

function recordInput(overrides = {}) {
  return {
    amount: '25.50',
    date: '2026-09-09',
    categoryId: 'cat-food',
    subcategoryId: 'food-lunch',
    note: '和朋友午餐',
    ...overrides
  };
}

test('首次启动会生成默认分类和空记录', async () => {
  const { store } = createTempStore();
  await store.init();
  assert.deepEqual(store.data.categories, DEFAULT_CATEGORIES);
  assert.deepEqual(store.data.records, []);
  assert.equal(fs.existsSync(store.filePath), true);
});

test('金额解析支持整数、两位小数并拒绝非法输入', () => {
  assert.equal(parseAmountToCents('25.50'), 2550);
  assert.equal(parseAmountToCents('100'), 10000);
  assert.equal(parseAmountToCents(10.5), 1050);
  assert.equal(parseAmountToCents('0'), null);
  assert.equal(parseAmountToCents('-1'), null);
  assert.equal(parseAmountToCents('1.234'), null);
  assert.equal(parseAmountToCents('abc'), null);
  assert.equal(parseAmountToCents(''), null);
});

test('日期仅接受真实存在的 YYYY-MM-DD', () => {
  assert.equal(isValidDate('2026-09-09'), true);
  assert.equal(isValidDate('2026-02-28'), true);
  assert.equal(isValidDate('2026-02-30'), false);
  assert.equal(isValidDate('2026-13-01'), false);
  assert.equal(isValidDate('2026/09/09'), false);
  assert.equal(isValidDate(''), false);
});

test('新增、编辑、删除记录可以持久化', async () => {
  const { store, filePath } = createTempStore();
  await store.init();
  const record = store.addRecord(recordInput());
  assert.equal(record.amountCents, 2550);
  assert.equal(store.data.records.length, 1);
  assert.equal(fs.existsSync(`${filePath}.bak`), true);

  store.updateRecord(record.id, recordInput({ amount: '88.88', note: '改后的备注' }));
  assert.equal(store.data.records[0].amountCents, 8888);
  assert.equal(store.data.records[0].note, '改后的备注');

  store.deleteRecord(record.id);
  assert.deepEqual(store.data.records, []);

  const reloaded = new LedgerStore(filePath);
  await reloaded.init();
  assert.equal(reloaded.data.records.length, 0);
});

test('列表支持月份、分类和备注筛选', async () => {
  const { store } = createTempStore();
  await store.init();
  store.addRecord(recordInput({ date: '2026-09-09', note: '午餐' }));
  store.addRecord(recordInput({
    amount: '10',
    date: '2026-08-01',
    categoryId: 'cat-transport',
    subcategoryId: 'transport-bus',
    note: '公交'
  }));

  assert.equal(store.listRecords({ month: '2026-09' }).length, 1);
  assert.equal(store.listRecords({ categoryId: 'cat-transport' }).length, 1);
  assert.equal(store.listRecords({ subcategoryId: 'transport-bus' }).length, 1);
  assert.equal(store.listRecords({ keyword: '公交' }).length, 1);
  assert.equal(store.listRecords({ keyword: '不存在' }).length, 0);
});

test('分类可以新增、改名和停用，且历史记录保留', async () => {
  const { store } = createTempStore();
  await store.init();
  const record = store.addRecord(recordInput());

  const parent = store.addCategory({ name: '宠物' });
  const child = store.addCategory({ parentId: parent.id, name: '猫粮' });
  store.renameCategory({ categoryId: parent.id, name: '宠物用品' });
  store.setCategoryEnabled({ categoryId: parent.id, enabled: false });
  assert.equal(store.data.categories.at(-1).name, '宠物用品');
  assert.equal(store.data.categories.at(-1).enabled, false);
  assert.equal(store.data.records[0].id, record.id);
  assert.equal(findCategory(store.data.categories, parent.id, child.id).child.name, '猫粮');
});

test('重名分类会被拒绝', async () => {
  const { store } = createTempStore();
  await store.init();
  assert.throws(() => store.addCategory({ name: '餐饮' }), /已存在/);
  assert.throws(
    () => store.addCategory({ parentId: 'cat-food', name: '午餐' }),
    /已存在/
  );
});

test('主文件损坏时可以从备份恢复', async () => {
  const { store, filePath } = createTempStore();
  await store.init();
  store.addRecord(recordInput());
  assert.equal(fs.existsSync(`${filePath}.bak`), true);

  fs.writeFileSync(filePath, '{broken json', 'utf8');
  const recovered = new LedgerStore(filePath);
  await recovered.init();
  assert.equal(recovered.data.records.length, 1);
  assert.equal(recovered.data.records[0].amountCents, 2550);
});

test('金额展示为人民币格式', () => {
  assert.equal(formatCents(2550), '¥25.50');
  assert.equal(formatCents(100000), '¥1,000.00');
});
