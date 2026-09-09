'use strict';

const crypto = require('crypto');
const fs = require('fs');
const path = require('path');
const { cloneDefaultCategories, findCategory } = require('./categories');

const DATA_VERSION = 1;
const MAX_AMOUNT_CENTS = 9999999999;
const MAX_NOTE_LENGTH = 200;
const MAX_CATEGORY_NAME_LENGTH = 20;

function parseAmountToCents(input) {
  if (typeof input === 'number') {
    if (!Number.isFinite(input)) {
      return null;
    }
    const cents = Math.round(input * 100);
    return cents > 0 && cents <= MAX_AMOUNT_CENTS ? cents : null;
  }

  if (typeof input !== 'string') {
    return null;
  }

  const text = input.trim();
  if (!/^\d+(\.\d{1,2})?$/.test(text)) {
    return null;
  }

  const [whole, fraction = ''] = text.split('.');
  const cents = Number(whole) * 100 + Number((fraction + '00').slice(0, 2));
  return Number.isSafeInteger(cents) && cents > 0 && cents <= MAX_AMOUNT_CENTS
    ? cents
    : null;
}

function formatCents(cents) {
  return new Intl.NumberFormat('zh-CN', {
    style: 'currency',
    currency: 'CNY'
  }).format(cents / 100);
}

function isValidDate(value) {
  if (typeof value !== 'string') {
    return false;
  }
  const match = /^(\d{4})-(\d{2})-(\d{2})$/.exec(value);
  if (!match) {
    return false;
  }
  const year = Number(match[1]);
  const month = Number(match[2]);
  const day = Number(match[3]);
  const date = new Date(Date.UTC(year, month - 1, day));
  return (
    date.getUTCFullYear() === year &&
    date.getUTCMonth() === month - 1 &&
    date.getUTCDate() === day
  );
}

function validateOptionalNote(note) {
  const normalized = String(note || '').trim();
  if (normalized.length > MAX_NOTE_LENGTH) {
    throw new Error(`备注不能超过 ${MAX_NOTE_LENGTH} 个字符`);
  }
  return normalized;
}

function validateCategoryName(name) {
  const normalized = String(name || '').trim();
  if (!normalized) {
    throw new Error('分类名称不能为空');
  }
  if (normalized.length > MAX_CATEGORY_NAME_LENGTH) {
    throw new Error(`分类名称不能超过 ${MAX_CATEGORY_NAME_LENGTH} 个字符`);
  }
  return normalized;
}

function sortRecords(records) {
  return records.slice().sort((a, b) => {
    if (a.date !== b.date) {
      return a.date < b.date ? 1 : -1;
    }
    return a.createdAt < b.createdAt ? 1 : -1;
  });
}

function createRecordData(categories, input) {
  const amountCents = parseAmountToCents(input.amount);
  if (amountCents === null) {
    throw new Error('请输入有效的金额，金额需大于 0，最多保留两位小数');
  }
  if (!isValidDate(input.date)) {
    throw new Error('日期格式无效');
  }
  const match = findCategory(categories, input.categoryId, input.subcategoryId);
  if (!match) {
    throw new Error('请选择有效的一级分类和二级分类');
  }

  const now = new Date().toISOString();
  return {
    id: crypto.randomUUID(),
    amountCents,
    categoryId: input.categoryId,
    subcategoryId: input.subcategoryId,
    date: input.date,
    note: validateOptionalNote(input.note),
    createdAt: now,
    updatedAt: now
  };
}

class LedgerStore {
  constructor(filePath) {
    if (!filePath || typeof filePath !== 'string') {
      throw new Error('数据文件路径无效');
    }
    this.filePath = filePath;
    this.backupPath = `${filePath}.bak`;
    this.data = null;
  }

  defaultData() {
    return {
      version: DATA_VERSION,
      categories: cloneDefaultCategories(),
      records: []
    };
  }

  normalizeData(data) {
    const source = data && typeof data === 'object' ? data : {};
    const categories = Array.isArray(source.categories) && source.categories.length
      ? source.categories
      : cloneDefaultCategories();
    return {
      version: Number.isInteger(source.version) ? source.version : DATA_VERSION,
      categories,
      records: Array.isArray(source.records) ? source.records : []
    };
  }

  async init() {
    if (!fs.existsSync(this.filePath)) {
      this.data = this.defaultData();
      this.save();
      return this.data;
    }

    try {
      const raw = fs.readFileSync(this.filePath, 'utf8');
      this.data = this.normalizeData(JSON.parse(raw));
      return this.data;
    } catch (error) {
      if (!fs.existsSync(this.backupPath)) {
        throw new Error('数据文件损坏，且没有可用备份');
      }
      const backupRaw = fs.readFileSync(this.backupPath, 'utf8');
      this.data = this.normalizeData(JSON.parse(backupRaw));
      this.writeAtomic(this.data);
      return this.data;
    }
  }

  save() {
    if (!this.data) {
      throw new Error('数据尚未初始化');
    }
    const directory = path.dirname(this.filePath);
    fs.mkdirSync(directory, { recursive: true });
    this.writeAtomic(this.data);
    if (fs.existsSync(this.filePath)) {
      fs.copyFileSync(this.filePath, this.backupPath);
    }
  }

  writeAtomic(data) {
    const directory = path.dirname(this.filePath);
    fs.mkdirSync(directory, { recursive: true });
    const temporaryPath = `${this.filePath}.tmp-${process.pid}-${Date.now()}`;
    fs.writeFileSync(temporaryPath, `${JSON.stringify(data, null, 2)}\n`, 'utf8');
    fs.renameSync(temporaryPath, this.filePath);
  }

  listRecords(filter = {}) {
    const records = this.data.records.slice();
    const month = typeof filter.month === 'string' ? filter.month.trim() : '';
    const keyword = typeof filter.keyword === 'string' ? filter.keyword.trim().toLowerCase() : '';
    const categoryId = typeof filter.categoryId === 'string' ? filter.categoryId : '';
    const subcategoryId = typeof filter.subcategoryId === 'string' ? filter.subcategoryId : '';
    return sortRecords(
      records.filter((record) => {
        if (month && !record.date.startsWith(`${month}-`)) {
          return false;
        }
        if (categoryId && record.categoryId !== categoryId) {
          return false;
        }
        if (subcategoryId && record.subcategoryId !== subcategoryId) {
          return false;
        }
        if (keyword && !record.note.toLowerCase().includes(keyword)) {
          return false;
        }
        return true;
      })
    );
  }

  addRecord(input) {
    const record = createRecordData(this.data.categories, input);
    this.data.records.push(record);
    this.save();
    return record;
  }

  updateRecord(id, input) {
    const index = this.data.records.findIndex((record) => record.id === id);
    if (index === -1) {
      throw new Error('找不到要修改的记录');
    }
    const current = this.data.records[index];
    const updated = createRecordData(this.data.categories, input);
    updated.id = current.id;
    updated.createdAt = current.createdAt;
    this.data.records[index] = updated;
    this.save();
    return updated;
  }

  deleteRecord(id) {
    const nextRecords = this.data.records.filter((record) => record.id !== id);
    if (nextRecords.length === this.data.records.length) {
      throw new Error('找不到要删除的记录');
    }
    this.data.records = nextRecords;
    this.save();
    return true;
  }

  listCategories() {
    return JSON.parse(JSON.stringify(this.data.categories));
  }

  addCategory({ parentId = null, name }) {
    const normalizedName = validateCategoryName(name);
    if (!parentId) {
      const duplicate = this.data.categories.some((category) => category.name === normalizedName);
      if (duplicate) {
        throw new Error('该一级分类已存在');
      }
      this.data.categories.push({
        id: `cat-${crypto.randomUUID()}`,
        name: normalizedName,
        icon: '📁',
        enabled: true,
        children: []
      });
      this.save();
      return this.data.categories[this.data.categories.length - 1];
    }

    const parent = this.data.categories.find((category) => category.id === parentId);
    if (!parent) {
      throw new Error('找不到一级分类');
    }
    const duplicate = parent.children.some((item) => item.name === normalizedName);
    if (duplicate) {
      throw new Error('该二级分类已存在');
    }
    parent.children.push({
      id: `${parentId}-${crypto.randomUUID()}`,
      name: normalizedName
    });
    this.save();
    return parent.children[parent.children.length - 1];
  }

  renameCategory({ categoryId, subcategoryId = null, name }) {
    const normalizedName = validateCategoryName(name);
    const match = findCategory(this.data.categories, categoryId, subcategoryId);
    if (!match) {
      throw new Error('找不到要改名的分类');
    }
    const target = match.child || match.parent;
    if (target.name === normalizedName) {
      return target;
    }
    const siblingNames = match.child
      ? match.parent.children.filter((item) => item.id !== target.id).map((item) => item.name)
      : this.data.categories.filter((item) => item.id !== target.id).map((item) => item.name);
    if (siblingNames.includes(normalizedName)) {
      throw new Error('同级分类中已存在同名分类');
    }
    target.name = normalizedName;
    this.save();
    return target;
  }

  setCategoryEnabled({ categoryId, subcategoryId = null, enabled }) {
    const match = findCategory(this.data.categories, categoryId, subcategoryId);
    if (!match) {
      throw new Error('找不到分类');
    }
    const target = match.child || match.parent;
    target.enabled = Boolean(enabled);
    this.save();
    return target;
  }
}

module.exports = {
  DATA_VERSION,
  LedgerStore,
  parseAmountToCents,
  formatCents,
  isValidDate,
  sortRecords
};
