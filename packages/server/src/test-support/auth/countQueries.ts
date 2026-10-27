import type { Pool } from "pg";

export function countQueries(pool: Pool) {
	const queries: Array<{ readonly text: unknown; readonly values: unknown }> = [];
	pool.on("connect", (client) => {
		client.query = new Proxy(client.query, {
			apply(query, receiver, args: unknown[]) {
				queries.push({ text: args[0], values: args[1] });
				return Reflect.apply(query, receiver, args);
			},
		});
	});
	return queries;
}
