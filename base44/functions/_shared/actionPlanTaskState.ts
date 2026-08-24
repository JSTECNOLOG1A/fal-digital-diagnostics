export function isActiveActionTask(task) {
  return task?.status !== 'cancelled'
    && (
      !task?.operation_status
      || task.operation_status === 'active'
    );
}