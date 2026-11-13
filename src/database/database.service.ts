import { Injectable, OnModuleInit, OnModuleDestroy, Logger } from '@nestjs/common';
import { Pool, QueryResult, QueryResultRow } from 'pg';

@Injectable()
export class DatabaseService implements OnModuleInit, OnModuleDestroy {
  private readonly logger = new Logger(DatabaseService.name);
  private pool: Pool;

  onModuleInit() {
    const connectionString =
      process.env.DATABASE_URL ||
      'postgresql://zoop_mcjl_user:SFpUhmH8UPlqaRhfnEBJ7TxjeT73f4oz@dpg-dbq4ii3l550s739i6fd0-a.singapore-postgres.render.com/zoop_mcjl';

    this.pool = new Pool({
      connectionString,
      ssl: {
        rejectUnauthorized: false,
      },
      max: 20,
      idleTimeoutMillis: 30000,
      connectionTimeoutMillis: 10000,
    });

    this.pool.on('error', (err) => {
      this.logger.error('Unexpected error on idle PostgreSQL client', err.stack);
    });

    this.logger.log('PostgreSQL Pool initialized');
  }

  async onModuleDestroy() {
    await this.pool.end();
    this.logger.log('PostgreSQL Pool closed');
  }

  async query<T extends QueryResultRow = any>(
    text: string,
    params?: any[],
  ): Promise<QueryResult<T>> {
    const start = Date.now();
    try {
      const res = await this.pool.query<T>(text, params);
      const duration = Date.now() - start;
      if (duration > 1000) {
        this.logger.warn(`Slow query (${duration}ms): ${text}`);
      }
      return res;
    } catch (error) {
      this.logger.error(`Database Query Error: ${error.message}`, error.stack);
      throw error;
    }
  }

  getPool(): Pool {
    return this.pool;
  }
}

