const ADJECTIVES = [
  'Быстрый',
  'Умный',
  'Смелый',
  'Тихий',
  'Яркий',
  'Серый',
  'Рыжий',
  'Белый',
  'Сонный',
  'Весёлый',
  'Строгий',
  'Мягкий',
  'Дикий',
  'Золотой',
  'Серебряный',
  'Морской',
  'Лесной',
  'Ночной',
  'Хитрый',
  'Добрый',
] as const;

const ANIMALS = [
  'ёж',
  'лиса',
  'волк',
  'медведь',
  'заяц',
  'бобр',
  'сова',
  'орёл',
  'сокол',
  'кот',
  'пёс',
  'тигр',
  'панда',
  'краб',
  'осьминог',
  'дельфин',
  'акула',
  'черепаха',
  'жаба',
  'олень',
] as const;

export function randomDisplayName(): string {
  const a = ADJECTIVES[Math.floor(Math.random() * ADJECTIVES.length)];
  const n = ANIMALS[Math.floor(Math.random() * ANIMALS.length)];
  return `${a} ${n}`;
}
