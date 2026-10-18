import { expect } from "vitest";
import { fleetHealth } from "#server/diagnostics/fleetHealth.ts";
import { boardStory, projectFiles, serverReading } from "#test/boardStory.ts";
import { health, syntheticSources } from "#test/diagnostics.ts";
import { diagnosticsSources, healthBoundary } from "#test/readingTraits.ts";

boardStory.it(
	"reads Fleet's versioned health file into System",
	[
		serverReading(),
		projectFiles({ "fleet/health.json": JSON.stringify(health) }),
		diagnosticsSources((root) => syntheticSources({ fleet: fleetHealth(root) })),
	],
	function* ({ systemHtml }) {
		const html = yield* systemHtml();
		expect(html).toContain("3 / 8");
		expect(html).toContain("Provider is at capacity");
	},
);
for (const source of [undefined, "broken json", JSON.stringify({ ...health, running: -1 })]) {
	boardStory.it(
		`distinguishes ${source === undefined ? "missing" : "invalid"} Fleet state (${source})`,
		[
			serverReading(),
			projectFiles(source === undefined ? {} : { "fleet/health.json": source }),
			diagnosticsSources((root) => syntheticSources({ fleet: fleetHealth(root) })),
		],
		function* ({ systemHtml }) {
			expect(yield* systemHtml()).toContain(`data-source="fleet" data-state="${source === undefined ? "not-configured" : "error"}"`);
		},
	);
}
boardStory.it(
	"explains unsupported health versions before validating unknown fields",
	[
		serverReading(),
		projectFiles({ "fleet/health.json": JSON.stringify({ version: 3 }) }),
		diagnosticsSources((root) => syntheticSources({ fleet: fleetHealth(root) })),
	],
	function* ({ systemHtml }) {
		expect(yield* systemHtml()).toContain("Fleet health snapshot version 3 is not supported by this Board. Use compatible Board and Fleet versions.");
	},
);
for (const kind of ["outside-directory", "file-link", "directory-file", "oversized"] as const) {
	boardStory.it(`rejects a ${kind} health snapshot`, [serverReading(), healthBoundary(kind)], function* ({ systemHtml }) {
		const html = yield* systemHtml();
		expect(html).toContain('data-source="fleet" data-state="error"');
		if (kind === "directory-file" || kind === "oversized") {
			expect(html).toContain("Ask Fleet to publish a supported health snapshot");
		}
	});
}
