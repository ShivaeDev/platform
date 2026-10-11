import { Deferred, Effect, Fiber } from "effect";
import { expect } from "vitest";
import { program } from "#program.ts";
import { effectApp } from "#test/services.ts";
import { Watcher } from "#Watcher.ts";

const until = Effect.fnUntraced(function* (predicate: () => boolean) {
	for (let attempt = 0; attempt < 400 && !predicate(); attempt += 1) {
		yield* Effect.sleep("10 millis");
	}
	expect(predicate()).toBe(true);
});
function args(h: {
	options: {
		stateFile: string;
		apiUrl: string;
	};
}) {
	return ["--repo", "acme/project", "--state", h.options.stateFile, "--api-url", h.options.apiUrl];
}
effectApp("one long-running process discovers a later PR and stops on interruption", function* (h) {
	const running = yield* Effect.forkChild(program([...args(h), "--fleet", "--interval", "1"], "token", h.emit, h.diagnostic));
	yield* until(() => h.requests.some((request) => request.path.endsWith("/status")));
	h.setPull(2);
	h.set("/pulls?state=open&per_page=100", { body: [{ number: 1 }, { number: 2 }] });
	yield* until(() => h.requests.some((request) => request.path.endsWith("sha2/status")));
	h.setPull(2, { merged: true, state: "closed" });
	yield* until(() => h.lines.length === 1);
	expect(JSON.parse(h.lines[0] ?? "")).toMatchObject({ event: "merged", number: 2 });
	yield* Fiber.interrupt(running);
	const count = h.requests.length;
	yield* Effect.sleep("50 millis");
	expect(h.requests).toHaveLength(count);
});
effectApp("once fails on request failure and help prints the CLI usage", function* (h) {
	h.set("/pulls/1", { body: {}, status: 500 });
	const result = yield* Effect.result(program([...args(h), "1", "--once"], "token", h.emit, h.diagnostic));
	expect(result._tag).toBe("Failure");
	expect(h.lines).toEqual([]);
	yield* program(["--help"], "", h.emit, h.diagnostic);
	expect(h.lines[0]).toContain("pr-watch --repo OWNER/REPO");
});
effectApp("continuous fleet polling reloads discovered open PRs after a failed first snapshot", function* (h) {
	h.setPull(1, { mergeable: null, "mergeable_state": "unknown" });
	const running = yield* Effect.forkChild(program([...args(h), "--fleet", "--interval", "1"], "token", h.emit, h.diagnostic));
	yield* until(() => h.diagnostics.length > 0);
	h.setPull(1, { merged: true, state: "closed" });
	h.set("/pulls?state=open&per_page=100", { body: [] });
	yield* until(() => h.lines.length === 1);
	yield* Fiber.interrupt(running);
	yield* h.restart;
	expect(h.lines.map((line) => JSON.parse(line))).toEqual([{ branch: "feature-1", event: "merged", number: 1, title: "Change 1" }]);
});
effectApp("graceful interruption waits for output and snapshot replacement", function* (h) {
	const state = yield* h.cycle;
	h.setPull(1, { merged: true, state: "closed" });
	const started = yield* Deferred.make<void>();
	const finish = yield* Deferred.make<void>();
	const watcher = yield* Watcher;
	const running = yield* Effect.forkChild(
		watcher.poll(
			h.options,
			state,
			(line) =>
				Effect.gen(function* () {
					yield* h.emit(line);
					yield* Deferred.succeed(started, undefined);
					yield* Deferred.await(finish);
				}),
			h.diagnostic,
		),
	);
	yield* Deferred.await(started);
	const stopping = yield* Effect.forkChild(Fiber.interrupt(running));
	yield* Deferred.succeed(finish, undefined);
	yield* Fiber.join(stopping);
	yield* h.restart;
	expect(h.lines).toHaveLength(1);
});
