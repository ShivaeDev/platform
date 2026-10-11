import { Clock, Effect } from "effect";
import { afterEach, expect, it } from "vitest";
import type { DiagnosticsSnapshot } from "#diagnostics/daemonContract.ts";
import { type Folder, folder, type RunningBoard, rawGet, startBoard } from "#test/board.ts";
import { codexResponse, githubResponse, health } from "#test/diagnostics.ts";
import { diagnosticsDaemon } from "#test/diagnosticsDaemon.ts";

let notes: Folder;
let board: RunningBoard;
let daemon: Awaited<ReturnType<typeof diagnosticsDaemon>>;
afterEach(async () => {
	await board?.stop();
	await daemon?.stop();
	notes?.remove();
});

function snapshot(observedAt = Effect.runSync(Clock.currentTimeMillis)): DiagnosticsSnapshot {
	return {
		codex: { observedAt, state: "ready", value: codexResponse.rateLimits },
		fleet: { observedAt, state: "ready", value: { ...health, observedAt } },
		github: { observedAt, state: "ready", value: githubResponse.resources },
	};
}

async function open() {
	notes = folder({ "fleet/health.json": JSON.stringify({ ...health, running: 99 }) });
	board = await startBoard(notes.root, undefined, undefined, false, undefined, undefined, daemon.port);
}

it("reads health, rate limits and each waiting owner through HTTP RPC, ignoring a conflicting file", async () => {
	daemon = await diagnosticsDaemon(() => snapshot());
	await open();
	const page = await rawGet(board, "/_board/diagnostics");
	expect(page.status).toBe(200);
	for (const text of ["24% used", "4321 / 5000", "3 / 8", "Current snapshot"]) {
		expect(page.body).toContain(text);
	}
	for (const [owner, count] of Object.entries(health.waiting)) {
		expect(page.body).toContain(`<dt>Waiting on ${owner}</dt><dd><strong>${count}</strong>`);
	}
	expect(page.body).not.toContain("99 / 8");
});

it("discloses stale daemon data with its original observation time over HTTP", async () => {
	const old = Effect.runSync(Clock.currentTimeMillis) - 120_000;
	daemon = await diagnosticsDaemon(() => snapshot(old));
	await open();
	const page = await rawGet(board, "/_board/diagnostics");
	expect(page.body).toContain('data-source="fleet" data-state="stale"');
	expect(page.body).toContain(`Observed <time datetime="${new Date(old).toISOString()}"`);
	expect(page.body).toContain("Stale snapshot");
});

it("shows a stopped daemon despite an existing health file and recovers on its next HTTP refresh", async () => {
	daemon = await diagnosticsDaemon(() => snapshot());
	const port = daemon.port;
	await daemon.stop();
	await open();
	const stopped = await rawGet(board, "/_board/diagnostics");
	expect(stopped.status).toBe(200);
	for (const source of ["codex", "github", "fleet"]) {
		expect(stopped.body).toContain(`data-source="${source}" data-state="error"`);
	}
	expect(stopped.body).toContain(`No Fleet daemon is running at 127.0.0.1:${port}`);
	daemon = await diagnosticsDaemon(() => snapshot(), port);
	expect((await rawGet(board, "/_board/diagnostics")).body).toContain("3 / 8");
});

it("preserves independent source failures across RPC without hiding daemon health", async () => {
	const value = snapshot();
	daemon = await diagnosticsDaemon(() => ({
		...value,
		codex: { cause: "Codex missing", observedAt: value.codex.observedAt, state: "not-configured" },
		github: { cause: "<script>upstream failed</script>", observedAt: value.github.observedAt, state: "error" },
	}));
	await open();
	const page = await rawGet(board, "/_board/diagnostics");
	expect(page.body).toContain('data-source="codex" data-state="not-configured"');
	expect(page.body).toContain('data-source="github" data-state="error"');
	expect(page.body).toContain("&lt;script&gt;upstream failed&lt;/script&gt;");
	expect(page.body).toContain("3 / 8");
});
