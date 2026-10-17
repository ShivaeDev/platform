import { Effect } from "effect";
import type { TransactionOptions } from "#model.ts";
import { makeChanges } from "./changes.ts";
import type { CoverageSettings } from "./coverageHarness.ts";
import { makeDatabase, orderIds } from "./database.ts";
import { probe } from "./expiry.ts";

export interface PrismaEngine extends Effect.Success<typeof makeDatabase> {
	binding: ReturnType<typeof makeChanges>;
	client: Effect.Success<typeof makeDatabase>["client"];
	coverage: CoverageSettings | undefined;
	options: TransactionOptions | undefined;
	probe: ReturnType<typeof probe>;
	readonly seen: (readonly string[])[];
}

export function* prismaEngine() {
	const database = yield* makeDatabase;
	const seen: (readonly string[])[] = [];
	const binding = makeChanges(database.client, () =>
		orderIds(database.observer).pipe(
			Effect.flatMap((ids) =>
				Effect.sync(() => {
					seen.push(ids);
				}),
			),
		),
	);
	const engine: PrismaEngine = { ...database, binding, coverage: undefined, options: undefined, probe: probe("2 seconds"), seen };
	return engine;
}
