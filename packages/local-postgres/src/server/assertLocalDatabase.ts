import { Result } from "effect";
import { LocalPostgresError } from "#server/LocalPostgresError.ts";

export function assertLocalDatabase(value: string, names: readonly string[], ports: readonly string[] = ["55432"]) {
	return Result.gen(function* () {
		const message = `Use a local database on 127.0.0.1:${ports.join(" or ")} named ${names.join(" or ")}.`;
		const url = yield* Result.try({ catch: () => new LocalPostgresError({ message }), try: () => new URL(value) });
		if (
			!(
				["postgres:", "postgresql:"].includes(url.protocol)
				&& ["localhost", "127.0.0.1"].includes(url.hostname)
				&& ports.includes(url.port)
				&& names.includes(url.pathname.slice(1))
			)
			|| ["host", "hostaddr", "port", "dbname", "service"].some((key) => url.searchParams.has(key))
		) {
			return yield* Result.fail(new LocalPostgresError({ message }));
		}
		return url;
	});
}
