import { Clock, Effect } from "effect";
import { afterEach, expect } from "vitest";
import { it } from "@shivaedev/effect-test/it.ts";
import type { DiagnosticsSnapshot } from "#diagnostics/daemonContract.ts";
import { type Folder, folder, type RunningBoard, startBoard } from "#test/board.ts";
import { codexResponse, githubObservations, health } from "#test/diagnostics.ts";
import { diagnosticsDaemon } from "#test/diagnosticsDaemon.ts";
import { renderRemaining } from "#test/remainingRendering.tsx";

let notes: Folder;
let board: RunningBoard;
let daemon: Effect.Success<ReturnType<typeof diagnosticsDaemon>>;

afterEach(() => {
	notes?.remove();
});

function snapshot(observedAt: number): DiagnosticsSnapshot {
	return {
		codex: { observedAt, state: "ready", value: codexResponse.rateLimits },
		fleet: { observedAt, state: "ready", value: { ...health, observedAt } },
		github: { observedAt, state: "ready", value: githubObservations },
	};
}

const open = Effect.fn("Test.open")(function* () {
	notes = folder({ "fleet/health.json": JSON.stringify({ ...health, running: 99 }) });
	board = yield* startBoard(notes.root, undefined, undefined, false, undefined, undefined, daemon.port);
});

it.live("reads health, rate limits and each waiting owner through HTTP RPC, ignoring a conflicting file", function* () {
	const now = yield* Clock.currentTimeMillis;
	daemon = yield* diagnosticsDaemon(() => snapshot(now));
	yield* open();
	const body = yield* Effect.promise(() => renderRemaining(board.url, "/_board/system"));
	for (const text of ["24% used", "4321 / 5000", "3 / 8", "Current snapshot"]) {
		expect(body).toContain(text);
	}
	expect(body).toContain(`<dt>Waiting on the orchestrator</dt><dd><strong>${health.waiting.orchestrator}</strong>`);
	expect(body).toContain(`<dt>Waiting on Fleet agents</dt><dd><strong>${health.waiting.automation}</strong>`);
	expect(body).not.toContain("99 / 8");
});

it.live("discloses stale daemon data with its original observation time over HTTP", function* () {
	const old = (yield* Clock.currentTimeMillis) - 120_000;
	daemon = yield* diagnosticsDaemon(() => snapshot(old));
	yield* open();
	const body = yield* Effect.promise(() => renderRemaining(board.url, "/_board/system"));
	expect(body).toContain('data-source="fleet" data-state="stale"');
	expect(body).toContain(`Observed <time dateTime="${new Date(old).toISOString()}"`);
	expect(body).toContain("Stale snapshot");
});

it.live("shows a stopped daemon despite an existing health file and recovers on its next HTTP refresh", function* () {
	const now = yield* Clock.currentTimeMillis;
	daemon = yield* diagnosticsDaemon(() => snapshot(now));
	const port = daemon.port;
	yield* daemon.stop();
	yield* open();
	const stopped = yield* Effect.promise(() => renderRemaining(board.url, "/_board/system"));
	for (const source of ["codex", "github", "fleet"]) {
		expect(stopped).toContain(`data-source="${source}" data-state="error"`);
	}
	expect(stopped).toContain(`No Fleet daemon is running at 127.0.0.1:${port}`);
	const recoveredAt = yield* Clock.currentTimeMillis;
	daemon = yield* diagnosticsDaemon(() => snapshot(recoveredAt), port);
	expect(yield* Effect.promise(() => renderRemaining(board.url, "/_board/system"))).toContain("3 / 8");
});

it.live("preserves independent source failures across RPC without hiding daemon health", function* () {
	const value = snapshot(yield* Clock.currentTimeMillis);
	daemon = yield* diagnosticsDaemon(() => ({
		...value,
		codex: { cause: "Codex missing", observedAt: value.codex.observedAt, state: "not-configured" },
		github: { cause: "<script>upstream failed</script>", observedAt: value.github.observedAt, state: "error" },
	}));
	yield* open();
	const body = yield* Effect.promise(() => renderRemaining(board.url, "/_board/system"));
	expect(body).toContain('data-source="codex" data-state="not-configured"');
	expect(body).toContain('data-source="github" data-state="error"');
	expect(body).toContain("&lt;script&gt;upstream failed&lt;/script&gt;");
	expect(body).toContain("3 / 8");
});
