'use strict';

const api = window.ledgerAPI;

const state = {
  categories: [],
  records: [],
  filter: {
    month: currentMonth(),
    categoryId: '',
    subcategoryId: '',
    keyword: ''
  },
  editingId: null
};

const el = {
  monthFilter: document.getElementById('month-filter'),
  categoryFilter: document.getElementById('category-filter'),
  subcategoryFilter: document.getElementById('subcategory-filter'),
  keywordFilter: document.getElementById('keyword-filter'),
  clearFilter: document.getElementById('btn-clear-filter'),
  totalAmount: document.getElementById('total-amount'),
  totalCount: document.getElementById('total-count'),
  recordsMeta: document.getElementById('records-meta'),
  recordsList: document.getElementById('records-list'),
  addRecord: document.getElementById('btn-add-record'),
  manageCategories: document.getElementById('btn-manage-categories'),
  recordDialog: document.getElementById('record-dialog'),
  recordForm: document.getElementById('record-form'),
  recordDialogTitle: document.getElementById('record-dialog-title'),
  cancelRecord: document.getElementById('btn-cancel-record'),
  amount: document.getElementById('record-amount'),
  date: document.getElementById('record-date'),
  recordCategory: document.getElementById('record-category'),
  recordSubcategory: document.getElementById('record-subcategory'),
  note: document.getElementById('record-note'),
  saveRecord: document.getElementById('btn-save-record'),
  categoryDialog: document.getElementById('category-dialog'),
  closeCategory: document.getElementById('btn-close-category'),
  doneCategory: document.getElementById('btn-done-category'),
  addParent: document.getElementById('btn-add-parent'),
  categoryList: document.getElementById('category-list'),
  dataPath: document.getElementById('data-path'),
  toast: document.getElementById('toast')
};

init();

async function init() {
  bindEvents();
  try {
    await refresh();
  } catch (error) {
    showToast(error.message || '应用初始化失败');
  }
}

function bindEvents() {
  el.addRecord.addEventListener('click', () => openRecordDialog());
  el.manageCategories.addEventListener('click', openCategoryDialog);
  el.cancelRecord.addEventListener('click', () => el.recordDialog.close());
  el.recordForm.addEventListener('submit', saveRecord);
  el.recordCategory.addEventListener('change', () => {
    renderRecordSubcategoryOptions('');
  });
  el.monthFilter.addEventListener('change', async () => {
    state.filter.month = el.monthFilter.value;
    await refresh();
  });
  el.categoryFilter.addEventListener('change', async () => {
    state.filter.categoryId = el.categoryFilter.value;
    state.filter.subcategoryId = '';
    await refresh();
  });
  el.subcategoryFilter.addEventListener('change', async () => {
    state.filter.subcategoryId = el.subcategoryFilter.value;
    await refresh();
  });
  el.keywordFilter.addEventListener('input', debounce(async () => {
    state.filter.keyword = el.keywordFilter.value.trim();
    await refresh();
  }, 260));
  el.clearFilter.addEventListener('click', async () => {
    state.filter = {
      month: currentMonth(),
      categoryId: '',
      subcategoryId: '',
      keyword: ''
    };
    el.monthFilter.value = state.filter.month;
    el.keywordFilter.value = '';
    await refresh();
  });
  el.recordsList.addEventListener('click', handleRecordAction);
  el.closeCategory.addEventListener('click', () => el.categoryDialog.close());
  el.doneCategory.addEventListener('click', () => el.categoryDialog.close());
  el.addParent.addEventListener('click', addParentCategory);
  el.categoryList.addEventListener('click', handleCategoryAction);
}

function debounce(fn, wait) {
  let timer = null;
  return (...args) => {
    window.clearTimeout(timer);
    timer = window.setTimeout(() => fn(...args), wait);
  };
}

function currentMonth() {
  const now = new Date();
  return `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}`;
}

function todayISO() {
  const now = new Date();
  return `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}-${String(
    now.getDate()
  ).padStart(2, '0')}`;
}

async function refresh() {
  const [categories, records, dataPath] = await Promise.all([
    api.listCategories(),
    api.listRecords(state.filter),
    api.getDataPath().catch(() => '')
  ]);
  state.categories = categories;
  state.records = records;
  normalizeFilter();
  renderFilterOptions();
  renderSummary();
  renderRecords();
  el.dataPath.textContent = dataPath ? `数据文件：${dataPath}` : '';
}

function normalizeFilter() {
  const parentExists = state.categories.some((category) => category.id === state.filter.categoryId);
  if (!parentExists) {
    state.filter.categoryId = '';
    state.filter.subcategoryId = '';
  }
  const parent = state.categories.find((category) => category.id === state.filter.categoryId);
  if (parent && state.filter.subcategoryId) {
    const childExists = parent.children.some((item) => item.id === state.filter.subcategoryId);
    if (!childExists) {
      state.filter.subcategoryId = '';
    }
  }
}

function renderFilterOptions() {
  el.monthFilter.value = state.filter.month || currentMonth();
  el.categoryFilter.innerHTML =
    '<option value="">全部一级分类</option>' +
    state.categories
      .map(
        (category) =>
          `<option value="${category.id}">${escapeHtml(category.name)}${category.enabled === false ? '（已停用）' : ''}</option>`
      )
      .join('');
  el.categoryFilter.value = state.filter.categoryId;
  renderSubcategoryFilterOptions();
}

function renderSubcategoryFilterOptions() {
  const parent = state.categories.find((category) => category.id === state.filter.categoryId);
  el.subcategoryFilter.disabled = !parent;
  el.subcategoryFilter.innerHTML =
    '<option value="">全部二级分类</option>' +
    (parent ? parent.children : [])
      .map(
        (child) =>
          `<option value="${child.id}">${escapeHtml(child.name)}${child.enabled === false ? '（已停用）' : ''}</option>`
      )
      .join('');
  el.subcategoryFilter.value = state.filter.subcategoryId;
}

function renderSummary() {
  const total = state.records.reduce((sum, record) => sum + record.amountCents, 0);
  el.totalAmount.textContent = formatAmount(total);
  el.totalCount.textContent = `${state.records.length} 笔`;
  el.recordsMeta.textContent = `共 ${state.records.length} 条`;
}

function categoryName(categoryId, subcategoryId) {
  const parent = state.categories.find((category) => category.id === categoryId);
  if (!parent) {
    return ['未分类', ''];
  }
  const child = parent.children.find((item) => item.id === subcategoryId);
  return [parent.name, child ? child.name : ''];
}

function renderRecords() {
  if (!state.records.length) {
    el.recordsList.innerHTML = `
      <div class="empty-state">
        <strong>暂时没有支出记录</strong>
        点击右上角“记一笔”，记录你的第一笔支出吧。
      </div>`;
    return;
  }

  el.recordsList.innerHTML = state.records
    .map((record) => {
      const [parentName, childName] = categoryName(record.categoryId, record.subcategoryId);
      const categoryText = [parentName, childName].filter(Boolean).join(' · ');
      return `
        <article class="record-card">
          <div class="record-date">${escapeHtml(record.date)}</div>
          <div class="record-main">
            <div class="record-category">${escapeHtml(categoryText)}</div>
            ${record.note
              ? `<div class="record-note">${escapeHtml(record.note)}</div>`
              : '<div class="record-note">无备注</div>'}
          </div>
          <div class="record-amount">${formatAmount(record.amountCents)}</div>
          <div class="record-actions">
            <button class="row-button" type="button" data-action="edit" data-id="${record.id}">编辑</button>
            <button class="row-button" type="button" data-action="delete" data-id="${record.id}">删除</button>
          </div>
        </article>`;
    })
    .join('');
}

function findRecord(id) {
  return state.records.find((record) => record.id === id);
}

async function handleRecordAction(event) {
  const button = event.target.closest('button[data-action]');
  if (!button) {
    return;
  }
  const record = findRecord(button.dataset.id);
  if (!record) {
    return;
  }
  if (button.dataset.action === 'edit') {
    openRecordDialog(record);
    return;
  }
  if (button.dataset.action === 'delete') {
    if (window.confirm(`确定删除这笔 ${formatAmount(record.amountCents)} 的支出吗？删除后无法恢复。`)) {
      try {
        await api.deleteRecord(record.id);
        showToast('记录已删除');
        await refresh();
      } catch (error) {
        showToast(error.message || '删除失败');
      }
    }
  }
}

function openRecordDialog(record = null) {
  state.editingId = record ? record.id : null;
  el.recordDialogTitle.textContent = record ? '编辑支出' : '记一笔';
  el.amount.value = record ? String((record.amountCents / 100).toFixed(2)) : '';
  el.date.value = record ? record.date : todayISO();
  el.note.value = record ? record.note : '';
  renderRecordCategoryOptions(record ? record.categoryId : '');
  renderRecordSubcategoryOptions(record ? record.subcategoryId : '');
  el.recordDialog.showModal();
  el.amount.focus();
}

function renderRecordCategoryOptions(selectedCategoryId) {
  el.recordCategory.innerHTML =
    '<option value="">请选择一级分类</option>' +
    state.categories
      .filter((category) => category.enabled !== false || category.id === selectedCategoryId)
      .map(
        (category) =>
          `<option value="${category.id}">${escapeHtml(category.name)}${category.enabled === false ? '（已停用）' : ''}</option>`
      )
      .join('');
  el.recordCategory.value = selectedCategoryId;
}

function renderRecordSubcategoryOptions(selectedSubcategoryId) {
  const selectedCategoryId = el.recordCategory.value;
  const parent = state.categories.find((category) => category.id === selectedCategoryId);
  if (!parent) {
    el.recordSubcategory.disabled = true;
    el.recordSubcategory.innerHTML = '<option value="">请先选择一级分类</option>';
    return;
  }
  el.recordSubcategory.disabled = false;
  el.recordSubcategory.innerHTML =
    '<option value="">请选择二级分类</option>' +
    parent.children
      .filter((child) => child.enabled !== false || child.id === selectedSubcategoryId)
      .map(
        (child) =>
          `<option value="${child.id}">${escapeHtml(child.name)}${child.enabled === false ? '（已停用）' : ''}</option>`
      )
      .join('');
  el.recordSubcategory.value = selectedSubcategoryId;
}

async function saveRecord(event) {
  event.preventDefault();
  const input = {
    amount: el.amount.value,
    date: el.date.value,
    categoryId: el.recordCategory.value,
    subcategoryId: el.recordSubcategory.value,
    note: el.note.value
  };
  if (!input.categoryId || !input.subcategoryId) {
    showToast('请选择一级分类和二级分类');
    return;
  }
  try {
    if (state.editingId) {
      await api.updateRecord(state.editingId, input);
      showToast('记录已更新');
    } else {
      await api.addRecord(input);
      showToast('记录已保存');
    }
    el.recordDialog.close();
    await refresh();
  } catch (error) {
    showToast(error.message || '保存失败');
  }
}

function openCategoryDialog() {
  renderCategoryManagement();
  el.categoryDialog.showModal();
}

function renderCategoryManagement() {
  el.categoryList.innerHTML = state.categories
    .map((category) => {
      const parentDisabled = category.enabled === false;
      const parentRows = `
        <div class="category-row ${parentDisabled ? 'disabled' : ''}">
          <span class="category-name">${escapeHtml(category.icon || '📁')} ${escapeHtml(category.name)}${parentDisabled ? '<span class="disabled-label">已停用</span>' : ''}</span>
          <div class="category-row-actions">
            ${parentDisabled ? '' : '<button class="row-button" type="button" data-action="add-child" data-parent-id="' + category.id + '">＋子类</button>'}
            <button class="row-button" type="button" data-action="rename" data-category-id="${category.id}">改名</button>
            <button class="row-button" type="button" data-action="toggle" data-category-id="${category.id}">${parentDisabled ? '启用' : '停用'}</button>
          </div>
        </div>`;
      const childRows = category.children
        .map((child) => {
          const disabled = child.enabled === false;
          return `
            <div class="category-row child">
              <span class="category-name">${escapeHtml(child.name)}${disabled ? '<span class="disabled-label">已停用</span>' : ''}</span>
              <div class="category-row-actions">
                <button class="row-button" type="button" data-action="rename" data-category-id="${category.id}" data-subcategory-id="${child.id}">改名</button>
                <button class="row-button" type="button" data-action="toggle" data-category-id="${category.id}" data-subcategory-id="${child.id}">${disabled ? '启用' : '停用'}</button>
              </div>
            </div>`;
        })
        .join('');
      return `<div class="category-group">${parentRows}${childRows}</div>`;
    })
    .join('');
}

async function addParentCategory() {
  const name = window.prompt('请输入新的“一级分类”名称：');
  if (!name) {
    return;
  }
  try {
    await api.addCategory({ parentId: null, name });
    showToast('一级分类已新增');
    await refresh();
    renderCategoryManagement();
  } catch (error) {
    showToast(error.message || '新增分类失败');
  }
}

async function handleCategoryAction(event) {
  const button = event.target.closest('button[data-action]');
  if (!button) {
    return;
  }
  const action = button.dataset.action;
  const categoryId = button.dataset.categoryId;
  const subcategoryId = button.dataset.subcategoryId || null;
  try {
    if (action === 'add-child') {
      const name = window.prompt('请输入新的“二级分类”名称：');
      if (!name) {
        return;
      }
      await api.addCategory({ parentId: categoryId, name });
      showToast('二级分类已新增');
    } else if (action === 'rename') {
      const current = findManagedCategory(categoryId, subcategoryId);
      const name = window.prompt('请输入新的分类名称：', current ? current.name : '');
      if (!name) {
        return;
      }
      await api.renameCategory({ categoryId, subcategoryId, name });
      showToast('分类已改名');
    } else if (action === 'toggle') {
      const current = findManagedCategory(categoryId, subcategoryId);
      const enabled = !(current && current.enabled === false);
      await api.setCategoryEnabled({ categoryId, subcategoryId, enabled });
      showToast(enabled ? '分类已启用' : '分类已停用');
    }
    await refresh();
    renderCategoryManagement();
  } catch (error) {
    showToast(error.message || '分类操作失败');
  }
}

function findManagedCategory(categoryId, subcategoryId) {
  const parent = state.categories.find((category) => category.id === categoryId);
  if (!parent) {
    return null;
  }
  if (!subcategoryId) {
    return parent;
  }
  return parent.children.find((item) => item.id === subcategoryId) || null;
}

function formatAmount(cents) {
  return new Intl.NumberFormat('zh-CN', {
    style: 'currency',
    currency: 'CNY'
  }).format(cents / 100);
}

function escapeHtml(value) {
  return String(value ?? '')
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#39;');
}

function showToast(message) {
  el.toast.textContent = message;
  el.toast.classList.add('show');
  window.clearTimeout(showToast.timer);
  showToast.timer = window.setTimeout(() => {
    el.toast.classList.remove('show');
  }, 2600);
}
