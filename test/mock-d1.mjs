// 用 node:sqlite 模拟 Cloudflare D1 的异步 API，便于本地跑测试
import { DatabaseSync } from 'node:sqlite';

class MockStatement {
  constructor(db, sql) {
    this.db = db;
    this.sql = sql;
    this.args = [];
  }
  bind(...args) {
    this.args = args;
    return this;
  }
  all() {
    const stmt = this.db.prepare(this.sql);
    const rows = stmt.all(...this.args);
    return { results: rows, success: true };
  }
  first() {
    const stmt = this.db.prepare(this.sql);
    const row = stmt.get(...this.args);
    return row ?? null;
  }
  run() {
    const stmt = this.db.prepare(this.sql);
    const info = stmt.run(...this.args);
    return {
      success: true,
      meta: { changes: info.changes, last_row_id: Number(info.lastInsertRowid) },
    };
  }
}

export class MockD1 {
  constructor(dbPath = ':memory:') {
    this.db = new DatabaseSync(dbPath);
  }
  prepare(sql) {
    return new MockStatement(this.db, sql);
  }
  exec(sql) {
    this.db.exec(sql);
    return { count: 0, duration: 0 };
  }
  batch(stmts) {
    this.db.exec('BEGIN');
    try {
      const results = stmts.map((s) => s.run());
      this.db.exec('COMMIT');
      return results;
    } catch (err) {
      this.db.exec('ROLLBACK');
      throw err;
    }
  }
  close() {
    this.db.close();
  }
}
