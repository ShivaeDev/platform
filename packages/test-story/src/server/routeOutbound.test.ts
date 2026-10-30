import { Effect, Exit } from "effect";
import { expect, it } from "vitest";
import { routeOutbound } from "#routeOutbound.ts";
import { withRecordingDispatchers } from "#test/outbound.ts";

it.each([false, true])("routes and restores both installed dispatcher slots when the scope fails: %s", async (fail) => {
	await withRecordingDispatchers(async (records) => {
		const exit = await Effect.runPromise(
			Effect.exit(
				Effect.scoped(
					Effect.gen(function* () {
						yield* routeOutbound({ "github.com": "http://127.0.0.1:4321" }, { passthrough: true });
						for (const record of records) {
							record.dispatch("https://github.com");
							record.dispatch("https://example.com");
						}
						if (fail) {
							yield* Effect.fail("intentional scope failure");
						}
					}),
				),
			),
		);
		expect(Exit.isFailure(exit)).toBe(fail);
		for (const record of records) {
			expect(record.origins).toEqual(["http://127.0.0.1:4321", "https://example.com"]);
			record.dispatch("https://github.com");
			expect(record.origins.at(-1)).toBe("https://github.com");
		}
	});
});
