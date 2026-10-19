import { Clock, Effect } from "effect";
import { expect } from "vitest";
import { boardStory, projectFiles } from "#test/boardStory.ts";
import { diagnosticsSnapshot, health } from "#test/diagnostics.ts";
import { daemonSnapshot } from "#test/readingTraits.ts";

boardStory.it(
	"reads health, rate limits and the Fleet waiting counts through HTTP RPC, ignoring a conflicting file",
	[projectFiles({ "fleet/health.json": JSON.stringify({ ...health, running: 99 }) }), daemonSnapshot(diagnosticsSnapshot)],
	function* ({ systemHtml }) {
		const body = yield* systemHtml();
		for (const text of ["24% used", "4321 of 5000", "3 / 8", "Current snapshot"]) {
			expect(body).toContain(text);
		}
		expect(body).toContain(`<dt>Waiting on the orchestrator</dt><dd><strong>${health.waiting.orchestrator}</strong>`);
		expect(body).toContain(`<dt>Waiting on Fleet agents</dt><dd><strong>${health.waiting.automation}</strong>`);
		expect(body).not.toContain("99 / 8");
	},
);

const old = Effect.runSync(Clock.currentTimeMillis) - 120_000;
boardStory.it(
	"discloses stale daemon data with its original observation time over HTTP",
	[daemonSnapshot(() => diagnosticsSnapshot(old))],
	function* ({ systemHtml }) {
		const body = yield* systemHtml();
		expect(body).toContain('data-source="fleet" data-state="stale"');
		expect(body).toContain(`Last checked <time dateTime="${new Date(old).toISOString()}"`);
		expect(body).toContain("Stale snapshot");
	},
);

boardStory.it(
	"shows a stopped daemon despite an existing health file and recovers on its next HTTP refresh",
	[daemonSnapshot(diagnosticsSnapshot, true)],
	function* ({ systemHtml, story, restartDiagnostics }) {
		const port = story.engine.fleetPort;
		if (!port) {
			throw new Error("Missing daemon port");
		}
		const stopped = yield* systemHtml();
		for (const source of ["codex", "github", "fleet"]) {
			expect(stopped).toContain(`data-source="${source}" data-state="error"`);
		}
		expect(stopped).toContain(`No Fleet daemon is running at 127.0.0.1:${port}`);
		const recoveredAt = yield* Clock.currentTimeMillis;
		yield* restartDiagnostics(diagnosticsSnapshot(recoveredAt));
		expect(yield* systemHtml()).toContain("3 / 8");
	},
);

boardStory.it(
	"preserves independent source failures across RPC without hiding daemon health",
	[
		daemonSnapshot((observedAt) => ({
			...diagnosticsSnapshot(observedAt),
			codex: { cause: "Codex missing", observedAt, state: "not-configured" },
			github: { cause: "<script>upstream failed</script>", observedAt, state: "error" },
		})),
	],
	function* ({ systemHtml }) {
		const body = yield* systemHtml();
		expect(body).toContain('data-source="codex" data-state="not-configured"');
		expect(body).toContain('data-source="github" data-state="error"');
		expect(body).toContain("&lt;script&gt;upstream failed&lt;/script&gt;");
		expect(body).toContain("3 / 8");
	},
);
