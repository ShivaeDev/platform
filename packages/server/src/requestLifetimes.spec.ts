import { Effect } from "effect";
import { expect } from "vitest";
import { requestStory } from "#test/request/story.ts";

for (const transport of ["http", "websocket"] as const) {
	requestStory.it(
		`concurrent ${transport} calls read their own session user, identity and subject through a request service`,
		[],
		function* ({ connect }) {
			const alice = yield* connect("alice", transport);
			const bob = yield* connect("bob", transport);

			const results = yield* Effect.all([alice.read(true), bob.read(true)], { concurrency: "unbounded" });

			expect(results).toMatchObject([
				[
					{ caller: "alice", captured: "alice", identity: "alice", subject: "alice" },
					{ caller: "alice", captured: "alice", identity: "alice", subject: "alice" },
				],
				[
					{ caller: "bob", captured: "bob", identity: "bob", subject: "bob" },
					{ caller: "bob", captured: "bob", identity: "bob", subject: "bob" },
				],
			]);
		},
	);

	requestStory.it(`${transport} calls cache once across their read policy and handler, then recompute on the next call`, [], function* ({ connect }) {
		const alice = yield* connect("alice", transport);

		const first = yield* alice.read();
		const next = yield* alice.read();

		expect(first.map(({ cached }) => cached.computation)).toEqual([1, 1]);
		expect(next.map(({ cached }) => cached.computation)).toEqual([2, 2]);
	});

	requestStory.it(`${transport} calls reuse one global Layer across requests`, [], function* ({ connect, builds }) {
		const alice = yield* connect("alice", transport);

		const first = yield* alice.read();
		const next = yield* alice.read();

		expect(first.map(({ cached }) => cached.build)).toEqual([1, 1]);
		expect(next.map(({ cached }) => cached.build)).toEqual([1, 1]);
		expect(yield* builds()).toEqual({ global: 1 });
	});
}

requestStory.it("a visitor is refused by identity before request services are acquired", [], function* ({ read }) {
	expect(yield* read()).toBe("failed with unauthorized");
});

requestStory.it("a visitor can read the host version alongside caller-dependent request services", [], function* ({ version }) {
	expect(yield* version()).toBe("story-version");
});
