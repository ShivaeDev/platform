import { expect } from "vitest";
import { scopedClient } from "#test/scopedClient.ts";

for (const client of ["default", "testing"] as const) {
	for (const shared of [false, true]) {
		const sharing = shared ? ({ shared: true } as const) : {};
		scopedClient.it(
			`closing the owning Scope disconnects the ${shared ? "cached" : "uncached"} ${client} client from PostgreSQL`,
			[],
			function* ({ acquire, backends, close, untilAcquired }) {
				yield* acquire("app", { client, ...sharing });
				yield* untilAcquired("app");
				expect(yield* backends()).toBeGreaterThan(0);

				yield* close("app");

				expect(yield* backends()).toBe(0);
			},
		);

		scopedClient.it(
			`interrupting a pending acquisition disconnects the ${shared ? "cached" : "uncached"} ${client} client before its startup response arrives`,
			[],
			function* ({ acquire, backends, interrupt, resumeStartup }) {
				yield* acquire("app", { client, pending: true, ...sharing });
				expect(yield* backends()).toBeGreaterThan(0);

				yield* interrupt("app");

				expect(yield* backends()).toBe(0);
				yield* resumeStartup();
			},
		);
	}

	scopedClient.it(
		`interrupting one pending owner of a shared ${client} client keeps it connected for the other owner until its Scope closes`,
		[],
		function* ({ acquire, backends, close, interrupt, resumeStartup, untilAcquired }) {
			yield* acquire("first", { client, pending: true, shared: true });
			yield* acquire("second", { client, shared: true });
			expect(yield* backends()).toBeGreaterThan(0);

			yield* interrupt("first");

			expect(yield* backends()).toBeGreaterThan(0);
			yield* resumeStartup();
			yield* untilAcquired("second");
			yield* close("second");

			expect(yield* backends()).toBe(0);
		},
	);
}
