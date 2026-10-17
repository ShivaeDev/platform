import { expect } from "@effect/vitest";
import { Effect } from "effect";
import { hostProvider } from "#host/providers.ts";
import { SessionService } from "#session/service.ts";
import { dispatchWork } from "#test/dispatchWork.ts";
import { cliProcess } from "#test/fleetCli.ts";
import { type NamedHost, namedAttempt, namedRecord, withNamedCloudHost } from "#test/namedCloudHost.ts";
import { postgresTests } from "#test/postgres.ts";
import { withReadDaemon } from "#test/readDaemon.ts";

const test = postgresTests("live");

for (const prefix of [undefined, "Automation: "]) {
	test(`names dispatched workers with the ${prefix === undefined ? "default" : "configured"} prefix and Board title`, () =>
		withNamedCloudHost(prefix, (fixture) =>
			Effect.gen(function* () {
				yield* dispatchWork(fixture.host, "synthetic-work", { ...fixture.parts, provider: hostProvider(fixture.host) });
				expect([...fixture.names.values()]).toEqual([`${prefix ?? "Fleet: "}synthetic-work: Readable title`]);
			}),
		));
}

for (const role of ["reviewer", "repair"] as const) {
	test(`names a separate ${role} thread from its persisted intent before starting its turn`, () =>
		withNamedCloudHost(undefined, (fixture) =>
			Effect.gen(function* () {
				const attempt = namedAttempt(role);
				yield* fixture.store(namedRecord("synthetic-work", [attempt], `# ${"x".repeat(90)}`));
				yield* Effect.gen(function* () {
					yield* (yield* SessionService).start({ cwd: fixture.host.cloud?.cwd ?? "", operationId: attempt.operationId, prompt: "Synthetic turn" });
				}).pipe(Effect.provide(fixture.sessions));
				expect([...fixture.names.values()]).toEqual([`Fleet: synthetic-work (${role === "reviewer" ? "review" : "repair"}): ${"x".repeat(79)}…`]);
				expect(fixture.requests.map(({ method }) => method).indexOf("thread/name/set")).toBeLessThan(
					fixture.requests.map(({ method }) => method).indexOf("turn/start"),
				);
			}),
		));
}

test("keeps the worker name when repair continues its existing Cloud thread", () =>
	withNamedCloudHost(undefined, (fixture) =>
		Effect.gen(function* () {
			const worker = namedAttempt("worker");
			yield* fixture.store(namedRecord("synthetic-work", [worker]));
			yield* Effect.gen(function* () {
				const sessions = yield* SessionService;
				const receipt = yield* sessions.start({ cwd: fixture.host.cloud?.cwd ?? "", operationId: worker.operationId, prompt: "Synthetic work" });
				const repair = namedAttempt("repair", receipt.sessionId);
				yield* fixture.store(namedRecord("synthetic-work", [{ ...worker, receipt, status: "completed" }, repair]));
				yield* sessions.continue({ operationId: repair.operationId, prompt: "Synthetic repair", sessionId: receipt.sessionId });
			}).pipe(Effect.provide(fixture.sessions));
			expect([...fixture.names.values()]).toEqual(["Fleet: synthetic-work: Readable title"]);
			expect(fixture.requests.filter(({ method }) => method === "thread/name/set")).toHaveLength(1);
			expect(fixture.requests.filter(({ method }) => method === "turn/start")).toHaveLength(2);
		}),
	));

test(
	"backfills sessions across all records and history once, including legacy names and continued repairs",
	() =>
		withNamedCloudHost("Automation: ", (fixture) =>
			withReadDaemon(fixture.host, (port) => backfillStory(fixture, port), { ...fixture.parts, provider: hostProvider(fixture.host) }),
		),
	30_000,
);

test(
	"reports read and rename failures, continues other sessions, and retries only failed names",
	() =>
		withNamedCloudHost(undefined, (fixture) =>
			withReadDaemon(fixture.host, (port) => namingFailureStory(fixture, port), { ...fixture.parts, provider: hostProvider(fixture.host) }),
		),
	30_000,
);

const backfillStory = Effect.fn("CloudThreadNamesTest.backfillStory")(function* (fixture: NamedHost, port: number) {
	const worker = namedAttempt("worker", "synthetic-worker");
	const repair = { ...namedAttempt("repair", "synthetic-worker"), operationId: "synthetic-continuation" };
	const record = namedRecord("synthetic-work", [worker, repair, namedAttempt("reviewer", "synthetic-reviewer")]);
	const old = namedRecord("synthetic-work", [namedAttempt("repair", "synthetic-old")], "# Original title");
	yield* fixture.store({ ...record, history: [{ ...old, archivedAt: 1 }] });
	yield* fixture.store(namedRecord("synthetic-other", [namedAttempt("worker", "synthetic-other-session")]));
	yield* fixture.store(namedRecord("synthetic-prepared", []));
	fixture.names.set("synthetic-worker", "New chat");
	fixture.names.set("synthetic-reviewer", "Fleet: synthetic-reviewer");
	const args = ["name-threads", "--port", String(port), "--config", "unused.json"];
	const first = yield* Effect.promise(() => cliProcess(args));
	expect(first.code).toBe(0);
	expect(first.stdout).toContain("synthetic-worker: renamed to Automation: synthetic-work: Readable title");
	expect(first.stdout).toContain("synthetic-reviewer: renamed to Automation: synthetic-work (review): Readable title");
	expect(first.stdout).toContain("synthetic-old: renamed to Automation: synthetic-work (repair): Original title");
	expect(first.stdout).toContain("synthetic-other-session: renamed to Automation: synthetic-other: Readable title");
	expect(fixture.requests.filter(({ method }) => method === "thread/name/set")).toHaveLength(4);
	expect(yield* Effect.promise(() => cliProcess(args))).toEqual({ code: 0, stdout: "" });
	expect(fixture.requests.filter(({ method }) => method === "thread/name/set")).toHaveLength(4);
	expect(fixture.requests.filter(({ method }) => method === "thread/start" || method === "turn/start")).toEqual([]);
});

const namingFailureStory = Effect.fn("CloudThreadNamesTest.namingFailureStory")(function* (fixture: NamedHost, port: number) {
	yield* fixture.store(
		namedRecord("synthetic-work", [
			namedAttempt("worker", "synthetic-read-failure"),
			namedAttempt("reviewer", "synthetic-name-failure"),
			namedAttempt("repair", "synthetic-success"),
		]),
	);
	fixture.failures.add("thread/read:synthetic-read-failure");
	fixture.failures.add("thread/name/set:synthetic-name-failure");
	let errors = "";
	function captureError(text: string) {
		errors += text;
	}
	const args = ["name-threads", "--port", String(port), "--config", "unused.json"];
	const first = yield* Effect.promise(() =>
		cliProcess(args, {
			onError: captureError,
		}),
	);
	expect(first.code).toBe(0);
	expect(errors).toContain("synthetic-read-failure: naming failed: Codex rejected the protocol request: Synthetic naming failure");
	expect(errors).toContain("synthetic-name-failure: naming failed: Codex rejected the protocol request: Synthetic naming failure");
	expect(first.stdout).toContain("synthetic-success: renamed to Fleet: synthetic-work (repair): Readable title");
	fixture.failures.clear();
	const retried = yield* Effect.promise(() => cliProcess(args));
	expect(retried.code).toBe(0);
	expect(retried.stdout).toContain("synthetic-read-failure: renamed to Fleet: synthetic-work: Readable title");
	expect(retried.stdout).toContain("synthetic-name-failure: renamed to Fleet: synthetic-work (review): Readable title");
	expect(retried.stdout).not.toContain("synthetic-success");
	expect(yield* Effect.promise(() => cliProcess(args))).toEqual({ code: 0, stdout: "" });
});
