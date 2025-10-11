import { ContemplationTag } from '../types';

export interface ContemplationTagDefinition {
  id: ContemplationTag;
  label: string;
  description: string;
  tone: 'energy' | 'mood';
}

export const CONTEMPLATION_TAGS: ContemplationTagDefinition[] = [
  {
    id: 'energy_high',
    label: 'Требует много сил',
    description: 'Задача, требующая высокой концентрации и энергии.',
    tone: 'energy',
  },
  {
    id: 'energy_gentle',
    label: 'Мягкий старт',
    description: 'Лёгкое дело, которое можно сделать даже с низким уровнем энергии.',
    tone: 'energy',
  },
  {
    id: 'mood_pleasant',
    label: 'Приятно делать',
    description: 'Дело, которое заряжает и приносит удовольствие.',
    tone: 'mood',
  },
  {
    id: 'mood_neutral',
    label: 'Нейтрально',
    description: 'Задача без ярко выраженных эмоций.',
    tone: 'mood',
  },
];

export function getContemplationTagLabel(tag: ContemplationTag | null | undefined): string | null {
  if (!tag) {
    return null;
  }
  const match = CONTEMPLATION_TAGS.find((item) => item.id === tag);
  return match ? match.label : null;
}

export const CONTEMPLATION_HINTS: string[] = [
  'Если сомневаешься — запиши и уточни позже.',
  'Смотри на точку и дай подсознанию дорисовать хвосты.',
  'Всё, что шумит в голове, заслуживает места в системе.',
  'Запиши мысль, даже если она кажется мелочью.',
  'Не оценивай сейчас — просто выгружай.',
  'Можно записывать не только дела, но и тревоги.',
];

export function pickNextHint(current?: string): string {
  if (CONTEMPLATION_HINTS.length === 0) {
    return '';
  }
  const alternatives = CONTEMPLATION_HINTS.filter((hint) => hint !== current);
  const source = alternatives.length > 0 ? alternatives : CONTEMPLATION_HINTS;
  const index = Math.floor(Math.random() * source.length);
  return source[index]!;
}
