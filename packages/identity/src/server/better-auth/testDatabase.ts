import { Effect } from "effect";
import type { Pool } from "pg";

export function authTestDatabase(pool: Pool) {
	return {
		expireSessions: Effect.tryPromise(async () => {
			await pool.query('update "session" set "expiresAt" = now() - interval \'1 second\'');
		}),
		omitImageColumn: Effect.tryPromise(async () => {
			await pool.query('alter table "user" drop column image');
		}),
		sessionIpAddresses: Effect.tryPromise(async () => {
			const result = await pool.query<{ ipAddress: string | null }>('select "ipAddress" from "session" order by "createdAt", id');
			return result.rows;
		}),
		sessions: Effect.tryPromise(async () => {
			const result = await pool.query<{ email: string; id: string; userId: string }>(
				'select s.id, s."userId", u.email from "session" s join "user" u on u.id = s."userId" order by u.email, s.id',
			);
			return result.rows;
		}),
		users: Effect.tryPromise(async () => {
			const result = await pool.query<{ email: string; id: string }>('select id, email from "user" order by email');
			return result.rows;
		}),
	};
}
