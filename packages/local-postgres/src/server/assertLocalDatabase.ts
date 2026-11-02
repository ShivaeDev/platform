import { Effect } from "effect";
import { LocalPostgresError } from "#LocalPostgresError.ts";

export const assertLocalDatabase = Effect.fn("LocalPostgres.assertLocalDatabase")(function* (value: string, names: readonly string[]) {
	const message = `Use a local database on 127.0.0.1:55432 named ${names.join(" or ")}.`;
	const url = yield* Effect.try({ catch: () => new LocalPostgresError({ message }), try: () => new URL(value) });
	if (
		!(["postgres:", "postgresql:"].includes(url.protocol) && ["localhost", "127.0.0.1"].includes(url.hostname))
		|| url.port !== "55432"
		|| ["host", "hostaddr", "port", "dbname", "service"].some((key) => url.searchParams.has(key))
		|| !names.includes(url.pathname.slice(1))
	) {
		return yield* new LocalPostgresError({ message });
	}
	return url;
});
