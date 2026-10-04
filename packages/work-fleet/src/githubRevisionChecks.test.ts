import { Effect } from "effect";
import { expect } from "vitest";
import { checkoutResponses, effectApp, revision, scriptedGitHub, work } from "./githubFixtures.ts";
import { ChangeHost } from "./ports.ts";

const check = { conclusion: "success", "head_sha": revision, id: 1, name: "test", status: "completed" };
const checks = [{ "check_runs": [check], "total_count": 1 }];
const statuses = [{ sha: revision, statuses: [], "total_count": 0 }];
function fixture(checkPages: unknown = checks, statusPages: unknown = statuses) {
	return scriptedGitHub([...checkoutResponses(""), revision, JSON.stringify(checkPages), JSON.stringify(statusPages)]);
}
function verify(script: ReturnType<typeof fixture>, requiredChecks = work.requiredChecks) {
	return Effect.flatMap(ChangeHost, (host) => host.verifyNoChange({ ...work, requiredChecks }, revision)).pipe(Effect.provide(script.layer));
}

effectApp("checks the exact no-change revision using read-only paginated latest provider evidence", function* () {
	const script = fixture();
	yield* verify(script);
	const calls = script.calls.filter((call) => call.args[0] === "api");
	expect(calls).toHaveLength(2);
	expect(calls[0]?.args).toEqual([
		"api",
		"--method",
		"GET",
		"--hostname",
		"github.com",
		"--paginate",
		"--slurp",
		`repos/example/project/commits/${revision}/check-runs?filter=latest&per_page=100`,
		"--header",
		"Accept: application/vnd.github+json",
	]);
});
effectApp("accepts explicit successful status contexts on the same revision", function* () {
	const script = fixture(
		[{ "check_runs": [], "total_count": 0 }],
		[{ sha: revision, statuses: [{ context: "test", id: 2, state: "success" }], "total_count": 1 }],
	);
	yield* verify(script);
});
effectApp("collects check evidence across pages before deciding", function* () {
	const script = fixture([
		{ "check_runs": Array.from({ length: 100 }, (_, index) => ({ ...check, id: index + 1, name: `check-${index}` })), "total_count": 101 },
		{ "check_runs": [{ ...check, id: 101 }], "total_count": 101 },
	]);
	yield* verify(script, ["check-0", "test"]);
});
for (const conclusion of ["failure", "cancelled", "timed_out"]) {
	effectApp(`requests repair when a required no-change check reports ${conclusion}`, function* () {
		const script = fixture([{ "check_runs": [{ ...check, conclusion }], "total_count": 1 }]);
		const error = yield* verify(script).pipe(Effect.flip);
		expect(error.disposition).toBe("repair");
	});
}
for (const conclusion of [null, "neutral", "skipped", "unknown"]) {
	effectApp(`waits rather than inventing passed evidence for ${conclusion}`, function* () {
		const script = fixture([{ "check_runs": [{ ...check, conclusion }], "total_count": 1 }]);
		const error = yield* verify(script).pipe(Effect.flip);
		expect(error.disposition).toBe("retry");
	});
}
for (const state of ["pending", "failure", "error"]) {
	effectApp(`honors ${state} status evidence even when a same-name check passed`, function* () {
		const script = fixture(checks, [{ sha: revision, statuses: [{ context: "test", id: 2, state }], "total_count": 1 }]);
		const error = yield* verify(script).pipe(Effect.flip);
		expect(error.disposition).toBe(state === "pending" ? "retry" : "repair");
	});
}
effectApp("waits for missing required evidence", function* () {
	const script = fixture();
	const error = yield* verify(script, ["absent"]).pipe(Effect.flip);
	expect(error.disposition).toBe("retry");
});
for (const checkPages of [
	[{ "check_runs": [check], "total_count": 2 }],
	[{ "check_runs": [check, check], "total_count": 2 }],
	[{ "check_runs": [{ ...check, "head_sha": "b".repeat(40) }], "total_count": 1 }],
	[{ "check_runs": [check], "total_count": 1001 }],
]) {
	effectApp(`refuses incomplete, duplicate, stale or excessive check evidence ${JSON.stringify(checkPages)}`, function* () {
		const script = fixture(checkPages);
		const error = yield* verify(script).pipe(Effect.flip);
		expect(error.disposition).toBe("retry");
	});
}
effectApp("refuses combined statuses for a different revision", function* () {
	const script = fixture(checks, [{ sha: "b".repeat(40), statuses: [], "total_count": 0 }]);
	const error = yield* verify(script).pipe(Effect.flip);
	expect(error.disposition).toBe("retry");
});
effectApp("avoids provider queries when no commit checks are declared", function* () {
	const script = scriptedGitHub([...checkoutResponses(""), revision]);
	yield* verify(script, []);
	expect(script.calls.some((call) => call.args[0] === "api")).toBe(false);
});

effectApp("keeps an in-progress rerun pending despite a success-shaped conclusion", function* () {
	const script = fixture([{ "check_runs": [{ ...check, status: "in_progress" }], "total_count": 1 }]);
	const error = yield* verify(script).pipe(Effect.flip);
	expect(error.disposition).toBe("retry");
});
