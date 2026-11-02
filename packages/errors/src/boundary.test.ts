import { expect } from "vitest";
import { outcomes } from "@shivaedev/test-story/server/outcomes.ts";
import { Conflict, InternalServerError, ServiceUnavailable } from "#taxonomy.ts";
import { errors, releaseFails, unavailableFallback } from "#test/errors.ts";

errors.it("a successful request keeps its value", [], function* ({ answer, succeed }) {
	yield* succeed("saved");

	expect(yield* answer()).toBe("saved");
});

errors.it("a declared rejection keeps its identity", [], function* ({ answer, fault }) {
	const conflict = new Conflict({ field: "name", message: "Name is taken" });

	yield* fault("failure", conflict);

	expect(yield* answer()).toBe(conflict);
});

for (const kind of ["failure", "defect"] as const) {
	errors.it(
		`an unexpected ${kind} becomes an internal rejection, retains the original fault and keeps it off the wire`,
		[],
		function* ({ answer, fault, retainedFaults, wireAnswer }) {
			const original = new Error("database password=private-value");

			yield* fault(kind, original);

			const rejection = yield* answer();
			const retained = yield* retainedFaults();
			const wire = yield* wireAnswer();
			expect(rejection).toBeInstanceOf(InternalServerError);
			expect(retained[0]).toBe(original);
			expect(wire).toEqual({ _tag: "InternalServerError", message: "Internal server error" });
		},
	);
}

errors.it(
	"a custom fallback redacts its public message",
	[unavailableFallback("Upstream failed with token=private-value")],
	function* ({ answer, fault }) {
		yield* fault("failure", "private failure");

		const rejection = yield* answer();
		expect(rejection).toBeInstanceOf(ServiceUnavailable);
		expect(rejection).toHaveProperty("message", "Upstream failed with token=<redacted>");
	},
);

errors.it("cancellation stays cancellation without a rejection or a report", [], function* ({ answer, cancel, cancelled, recordedReports, start }) {
	yield* start();

	yield* cancel();

	yield* outcomes([
		["answer", () => answer(), "cancelled"],
		["cancellation", () => cancelled(), true],
		["reports", () => recordedReports(), []],
	]);
});

const cleanupFault = new Error("cleanup password=private-value");

errors.it(
	"a release defect becomes a rejection, retains its fault and reaches the reporter redacted",
	[releaseFails(cleanupFault)],
	function* ({ answer, recordedReports, release, retainedFaults, start }) {
		yield* start();

		yield* release("saved");

		expect(yield* answer()).toBeInstanceOf(InternalServerError);
		yield* outcomes([
			["retained fault", () => retainedFaults(), [cleanupFault]],
			["reported defect", () => recordedReports(), [{ defects: [expect.objectContaining({ message: "cleanup password=<redacted>" })] }]],
		]);
	},
);

errors.it(
	"cancellation with a release defect keeps cancellation and reports the normalized fault",
	[releaseFails(cleanupFault)],
	function* ({ answer, cancel, cancelled, recordedReports, retainedFaults, start }) {
		yield* start();

		yield* cancel();

		expect(yield* answer()).toBeInstanceOf(InternalServerError);
		yield* outcomes([
			["cancellation", () => cancelled(), true],
			["retained fault", () => retainedFaults(), [cleanupFault]],
			[
				"reported cancellation and defect",
				() => recordedReports(),
				[{ cancelled: true, defects: [expect.objectContaining({ message: "cleanup password=<redacted>" })] }],
			],
		]);
	},
);
