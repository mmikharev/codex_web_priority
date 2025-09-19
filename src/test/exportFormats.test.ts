import { describe, expect, it } from 'vitest';
import { createMarkdown } from '../utils/exportFormats';
import { formatDate } from '../utils/date';
import { Task } from '../types';

describe('export formats', () => {
  it('formats due dates using formatDate helper', () => {
    const task: Task = {
      id: 'task-1',
      title: 'Check deadline',
      due: '1. 10. 2025 at 0:00',
      quadrant: 'Q1',
      done: false,
      createdAt: '2024-01-01T00:00:00.000Z',
      completedAt: null,
      timeSpentSeconds: 0,
    };

    const markdown = createMarkdown([task]);
    expect(markdown).toContain(`до ${formatDate(task.due)}`);
    expect(markdown).not.toContain('Invalid Date');
  });
});
