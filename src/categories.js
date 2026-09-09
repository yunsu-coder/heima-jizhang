'use strict';

const DEFAULT_CATEGORIES = [
  {
    id: 'cat-food',
    name: '餐饮',
    icon: '🍜',
    enabled: true,
    children: [
      { id: 'food-breakfast', name: '早餐' },
      { id: 'food-lunch', name: '午餐' },
      { id: 'food-dinner', name: '晚餐' },
      { id: 'food-snack', name: '夜宵' },
      { id: 'food-drink', name: '零食饮品' },
      { id: 'food-takeout', name: '外卖' }
    ]
  },
  {
    id: 'cat-transport',
    name: '交通出行',
    icon: '🚌',
    enabled: true,
    children: [
      { id: 'transport-bus', name: '公交地铁' },
      { id: 'transport-taxi', name: '打车' },
      { id: 'transport-fuel', name: '加油' },
      { id: 'transport-parking', name: '停车' },
      { id: 'transport-train', name: '高铁/飞机' },
      { id: 'transport-repair', name: '维修保养' }
    ]
  },
  {
    id: 'cat-shopping',
    name: '购物',
    icon: '🛒',
    enabled: true,
    children: [
      { id: 'shopping-daily', name: '日用百货' },
      { id: 'shopping-clothes', name: '服饰鞋包' },
      { id: 'shopping-digital', name: '数码家电' },
      { id: 'shopping-home', name: '家居用品' }
    ]
  },
  {
    id: 'cat-housing',
    name: '居住',
    icon: '🏠',
    enabled: true,
    children: [
      { id: 'housing-rent', name: '房租' },
      { id: 'housing-utility', name: '水电燃气' },
      { id: 'housing-property', name: '物业' },
      { id: 'housing-network', name: '网络话费' },
      { id: 'housing-repair', name: '家居维修' }
    ]
  },
  {
    id: 'cat-entertainment',
    name: '娱乐',
    icon: '🎬',
    enabled: true,
    children: [
      { id: 'entertainment-movie', name: '电影演出' },
      { id: 'entertainment-game', name: '游戏' },
      { id: 'entertainment-fitness', name: '运动健身' },
      { id: 'entertainment-pet', name: '宠物' }
    ]
  },
  {
    id: 'cat-health',
    name: '医疗健康',
    icon: '💊',
    enabled: true,
    children: [
      { id: 'health-clinic', name: '门诊' },
      { id: 'health-medicine', name: '药品' },
      { id: 'health-checkup', name: '体检' },
      { id: 'health-care', name: '保健' }
    ]
  },
  {
    id: 'cat-education',
    name: '教育与成长',
    icon: '📚',
    enabled: true,
    children: [
      { id: 'education-course', name: '课程培训' },
      { id: 'education-book', name: '书籍资料' },
      { id: 'education-exam', name: '考试' }
    ]
  },
  {
    id: 'cat-social',
    name: '人情往来',
    icon: '🤝',
    enabled: true,
    children: [
      { id: 'social-treat', name: '请客' },
      { id: 'social-redpacket', name: '红包' },
      { id: 'social-gift', name: '礼物' }
    ]
  },
  {
    id: 'cat-other',
    name: '其他',
    icon: '📌',
    enabled: true,
    children: [
      { id: 'other-insurance', name: '保险' },
      { id: 'other-tax', name: '税费' },
      { id: 'other-transfer', name: '转账' },
      { id: 'other-uncategorized', name: '暂未归类' }
    ]
  }
];

function cloneDefaultCategories() {
  return JSON.parse(JSON.stringify(DEFAULT_CATEGORIES));
}

function findCategory(categories, categoryId, subcategoryId) {
  const parent = (categories || []).find((category) => category.id === categoryId);
  if (!parent) {
    return null;
  }

  if (!subcategoryId) {
    return { parent, child: null };
  }

  const child = (parent.children || []).find((item) => item.id === subcategoryId);
  return child ? { parent, child } : null;
}

function categoryNames(categories, categoryId, subcategoryId) {
  const match = findCategory(categories, categoryId, subcategoryId);
  if (!match) {
    return ['未分类', ''];
  }
  return [match.parent.name, match.child ? match.child.name : ''];
}

module.exports = {
  DEFAULT_CATEGORIES,
  cloneDefaultCategories,
  findCategory,
  categoryNames
};
