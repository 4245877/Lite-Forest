export const TABS = [

  'overview',
  'profile',
  'orders',
  'custom-print',
  'payments',
  'shipping',
  'returns',
  'favorites',
  'notifications',
  'support',
  'coupons',
  'security',

];



export const LABELS = {

  overview: 'Огляд',
  profile: 'Профіль',
  orders: 'Замовлення',
  'custom-print': '3D-друк по файлу',
  payments: 'Оплата',
  shipping: 'Доставка',
  returns: 'Повернення і гарантія',
  favorites: 'Обране',
  notifications: 'Сповіщення',
  support: 'Підтримка',
  coupons: 'Купони та бали',
  security: 'Безпека',

};


export const DEFAULT_TAB = 'overview';


export const getInitialTab = () =>
  typeof window === 'undefined'
    ? DEFAULT_TAB
    : TABS.includes(window.location.hash?.slice(1))
      ? window.location.hash.slice(1)
      : DEFAULT_TAB;