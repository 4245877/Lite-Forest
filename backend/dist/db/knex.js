import knex from 'knex';
import { env } from '../config/env';
let _knex = null;
export function getKnex() {
    if (_knex)
        return _knex;
    _knex = knex({
        client: 'pg',
        connection: {
            host: env.PG.host,
            port: env.PG.port,
            database: env.PG.db,
            user: env.PG.user,
            password: env.PG.password
        },
        pool: { min: env.PG.poolMin, max: env.PG.poolMax }
    });
    return _knex;
}
