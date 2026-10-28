import { expect } from "vitest";
import { hasPull, quotaRemaining, watchesPulls } from "#test/traits.ts";
import { watch } from "#test/watch.ts";

for (const numbers of [[1], [1, 2, 3]]) {
	watch.it(
		`a round over ${numbers.length} open PRs with single pages sends 3N + 1 REST requests and waits the 60-second interval`,
		[watchesPulls(...numbers), ...numbers.map((number) => hasPull(number)), quotaRemaining(5000)],
		function* (h) {
			const before = h.requests.length;
			yield* h.poll;
			const round = h.requests.slice(before);
			expect(round).toHaveLength(3 * numbers.length + 1);
			expect(round.every((request) => request.method === "GET" && !request.path.endsWith("/graphql"))).toBe(true);
			expect(yield* h.delay()).toBe(h.options.interval);
		},
	);
}
