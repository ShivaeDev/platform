import { Effect } from "effect";
import type { JobRegistration } from "#definition.ts";
import { PgBossQueueNamesError } from "#error.ts";
import { registrationName } from "./register.ts";

export const validateQueueNames = Effect.fnUntraced(function* (jobs: readonly JobRegistration[], declared: readonly string[] | undefined) {
	if (declared === undefined) {
		return;
	}
	const registered = new Set(jobs.map(registrationName));
	const expected = new Set(declared);
	const missing = [...expected].filter((name) => !registered.has(name));
	const unexpected = [...registered].filter((name) => !expected.has(name));
	if (missing.length > 0 || unexpected.length > 0) {
		return yield* Effect.fail(new PgBossQueueNamesError({ missing, unexpected }));
	}
});
