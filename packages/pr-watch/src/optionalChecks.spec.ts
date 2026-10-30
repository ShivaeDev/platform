import { Effect } from "effect";
import { expect } from "vitest";
import { outcomes } from "@shivaedev/test-story/server/outcomes.ts";
import { requiredPage } from "#test/requiredChecks.ts";
import { checksAre, hasPull } from "#test/traits.ts";
import { watch } from "#test/watch.ts";

for (const status of ["completed", "in_progress"]) {
	watch.it(
		`a queued PR with a ${status} optional app check stays queued without failing`,
		[
			hasPull(1, { "auto_merge": null }),
			checksAre(1, [
				{ conclusion: "success", name: "CI", status: "completed" },
				{ conclusion: "failure", name: "Entire Gates", required: false, status },
				{ conclusion: null, name: "Queue CI", status: "in_progress" },
			]),
		],
		function* (h) {
			yield* h.poll;

			h.queueHas(1);
			yield* h.poll;

			expect(h.eventNames()).toEqual(["queued"]);
		},
	);
}
watch.it("a required failure still marks a queued PR stuck alongside an optional app failure", [hasPull(1, { "auto_merge": null })], function* (h) {
	yield* h.poll;
	h.queueHas(1);
	h.checksAre(1, [
		{ conclusion: "failure", name: "CI", status: "completed" },
		{ conclusion: "failure", name: "Entire Gates", required: false, status: "completed" },
	]);

	yield* h.poll;

	expect(h.eventNames()).toEqual(["queued", "checks-failed", "stuck"]);
});
watch.it("an optional app failure leaves an auto-merge PR ready", [], function* (h) {
	yield* h.poll;
	h.checksAre(1, [{ conclusion: "action_required", name: "Entire Gates", required: false, status: "completed" }]);

	const state = yield* h.poll;

	expect(state.prs["1"]).toMatchObject({ autoMerge: true, dirty: false, failed: false });
});

for (const state of ["failure", "error", "pending"]) {
	watch.it(`an optional ${state} commit status does not mark auto-merge stuck`, [], function* (h) {
		yield* h.poll;
		h.statusIs(1, state, "sha1", false);

		yield* h.poll;

		expect(h.eventNames()).toEqual([]);
	});
}

watch.it("a required failure on a later metadata page still marks auto-merge stuck", [], function* (h) {
	yield* h.poll;
	h.checksAre(1, [{ conclusion: "failure", status: "completed" }]);
	h.requiredChecksPage(null, requiredPage([], "next"));
	h.requiredChecksPage("next", requiredPage([{ __typename: "CheckRun", id: "check-1-0", isRequired: true }]));

	yield* h.poll;

	expect(h.eventNames()).toEqual(["checks-failed", "stuck"]);
});

for (const response of [
	{ body: { errors: [{ message: "Unavailable" }] } },
	{ body: { data: { repository: null } } },
	{ body: { data: { repository: null }, errors: [{ message: "Partial response" }] } },
]) {
	watch.it(`missing required-check evidence retains the last successful observation: ${JSON.stringify(response.body)}`, [], function* (h) {
		yield* h.poll;
		h.checksAre(1, [{ conclusion: "failure", status: "completed" }]);
		h.requiredChecksPage(null, response);

		const result = yield* h.pollOutcome();

		yield* outcomes({
			events: [Effect.sync(h.events), []],
			observation: [Effect.succeed(result), "failed"],
			"stored failure": [h.saved().pipe(Effect.map((state) => state.prs["1"]?.failed)), false],
		});
	});
}
