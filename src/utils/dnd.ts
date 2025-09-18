type DragEventLike = { dataTransfer: DataTransfer };

export const TASK_DRAG_TYPE = 'application/x-task-id';

export function setTaskDragData(event: DragEventLike, taskId: string) {
  event.dataTransfer.setData(TASK_DRAG_TYPE, taskId);
  event.dataTransfer.effectAllowed = 'move';
  event.dataTransfer.setData('text/plain', taskId);
}

export function getTaskIdFromDrag(event: DragEventLike): string | null {
  const id = event.dataTransfer.getData(TASK_DRAG_TYPE);
  return id || null;
}
