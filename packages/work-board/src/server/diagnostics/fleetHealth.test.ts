import { expect } from "vitest";
import { outcomes } from "@shivaedev/test-story/server/outcomes.ts";
import { fleetHealth } from "#server/diagnostics/fleetHealth.ts";
import { boardStory, projectFiles } from "#test/boardStory.ts";
import { health, syntheticSources } from "#test/diagnostics.ts";
import { diagnosticsSources, healthBoundary } from "#test/readingTraits.ts";

const fleetFromFile = diagnosticsSources((root) => syntheticSources({ fleet: fleetHealth(root) }));

boardStory.it(
	"System shows the running count and last capacity rejection from Fleet's health file",
	[projectFiles({ "fleet/health.json": JSON.stringify(health) }), fleetFromFile],
	function* ({ systemCardText }) {
		expect(yield* systemCardText("fleet")).toEqual(expect.stringMatching(/3 \/ 8.*Provider is at capacity/u));
	},
);

for (const [what, files, state] of [
	["a missing Fleet health file", {}, "not-configured"],
	["a Fleet health file that is not JSON", { "fleet/health.json": "broken json" }, "error"],
	["a Fleet health file with a negative running count", { "fleet/health.json": JSON.stringify({ ...health, running: -1 }) }, "error"],
] as const) {
	boardStory.it(`${what} shows Fleet as ${state}`, [projectFiles(files), fleetFromFile], function* ({ systemCards }) {
		expect(yield* systemCards()).toMatchObject({ fleet: state });
	});
}

boardStory.it(
	"a health file of an unsupported version names the version instead of listing unknown fields",
	[projectFiles({ "fleet/health.json": JSON.stringify({ version: 3 }) }), fleetFromFile],
	function* ({ systemCardText }) {
		expect(yield* systemCardText("fleet")).toContain(
			"Fleet health snapshot version 3 is not supported by this Board. Use compatible Board and Fleet versions.",
		);
	},
);

for (const kind of ["outside-directory", "file-link"] as const) {
	boardStory.it(`a ${kind} health snapshot shows Fleet as failed`, [healthBoundary(kind)], function* ({ systemCards }) {
		expect(yield* systemCards()).toMatchObject({ fleet: "error" });
	});
}

for (const kind of ["directory-file", "oversized"] as const) {
	boardStory.it(
		`a ${kind} health snapshot shows Fleet as failed and asks for a supported snapshot`,
		[healthBoundary(kind)],
		function* ({ systemCards, systemCardText }) {
			yield* outcomes({
				"fleet advice": [systemCardText("fleet"), expect.stringContaining("Ask Fleet to publish a supported health snapshot")],
				"fleet card": [systemCards(), expect.objectContaining({ fleet: "error" })],
			});
		},
	);
}
