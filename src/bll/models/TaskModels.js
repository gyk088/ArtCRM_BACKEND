import { PgObject } from 'pgobject';

// Задачи в стиле Trello (см. TaskService): статусы (колонки), доски, задачи.

export class TaskStatusModel extends PgObject {
  static get schema() {
    return {
      id: { pk: true },
      user_id: { required: true },
      name: {
        required: true,
        set(name) {
          if (typeof name !== 'string' || !name.trim()) throw new Error('Status name is required');
          if (name.length > 100) throw new Error('Status name too long (max 100 characters)');
          return name.trim();
        }
      },
      color: {
        set(color) {
          if (!color) return null;
          if (!/^#[0-9a-fA-F]{6}$/.test(color)) throw new Error('Invalid color: must be a hex string like #8a6d2f');
          return color.toLowerCase();
        }
      },
      is_final: { default: false },
      order_num: {},
      ctime: { default: new Date() },
    }
  }

  static get table() {
    return 'my_task_status';
  }

  static async getById(id) {
    const rows = await TaskStatusModel.select('WHERE id = $1 LIMIT 1', [id]);
    return rows[0];
  }
}

export class TaskBoardModel extends PgObject {
  static get schema() {
    return {
      id: { pk: true },
      user_id: { required: true },
      name: { required: true },
      description: {},
      updated_by: {},
      ctime: { default: new Date() },
      utime: { default: new Date() },
    }
  }

  static get table() {
    return 'my_task_board';
  }

  static async getById(id) {
    const rows = await TaskBoardModel.select('WHERE id = $1 LIMIT 1', [id]);
    return rows[0];
  }
}

export class TaskModel extends PgObject {
  static get schema() {
    return {
      id: { pk: true },
      board_id: { required: true },
      user_id: { required: true },
      title: { required: true },
      description: {},
      status_id: { required: true },
      assignee_id: {},
      due_date: {},
      priority: { default: 'normal' },
      order_num: {},
      completed_at: {},
      updated_by: {},
      ctime: { default: new Date() },
      utime: { default: new Date() },
    }
  }

  static get table() {
    return 'my_task';
  }

  static async getById(id) {
    const rows = await TaskModel.select('WHERE id = $1 LIMIT 1', [id]);
    return rows[0];
  }
}
