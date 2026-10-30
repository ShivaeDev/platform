import { Effect } from "effect";
import { PostgresTestDatabase } from "@shivaedev/test-sql/server/database.ts";
import { startHost } from "./host.ts";

export const startOtherApplication = Effect.gen(function* () {
	const database = yield* PostgresTestDatabase;
	const services = yield* database.isolated;
	const host = yield* startHost().pipe(Effect.provideContext(services));
	return { address: host.baseUrl, port: Number(new URL(host.baseUrl).port) };
});
