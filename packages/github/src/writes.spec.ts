import { expect } from "vitest";
import { github } from "#test/github.ts";
import { coverageCheckQueued, coverageCheckRunning, HEAD } from "#test/writeTraits.ts";

const MEASURING = { summary: "Measuring", title: "Coverage" };
const MEASURED = { summary: "90% covered", text: "All targets measured", title: "Coverage" };

github.it("creating a queued Coverage check for a head SHA returns it with no conclusion and no report link", [], function* ({ createCheck }) {
	expect(yield* createCheck({ headSha: HEAD, name: "Coverage", status: "queued" })).toEqual({
		conclusion: null,
		detailsUrl: null,
		headSha: HEAD,
		id: 1,
		name: "Coverage",
		output: { summary: null, text: null, title: null },
		status: "queued",
	});
});

github.it("creating an in-progress Coverage check gives GitHub its output", [], function* ({ checkOnGitHub, createCheck }) {
	yield* createCheck({ headSha: HEAD, name: "Coverage", output: { ...MEASURING, text: "Targets selected" }, status: "in_progress" });

	expect(yield* checkOnGitHub(1)).toMatchObject({ output: { ...MEASURING, text: "Targets selected" }, status: "in_progress" });
});

github.it(
	"starting queued check 1 moves it to in progress on GitHub with its output",
	[coverageCheckQueued],
	function* ({ checkOnGitHub, updateCheck }) {
		yield* updateCheck(1, { output: MEASURING, status: "in_progress" });

		expect(yield* checkOnGitHub(1)).toMatchObject({ output: MEASURING, status: "in_progress" });
	},
);

github.it(
	"completing running check 1 gives GitHub its success conclusion and full output",
	[coverageCheckRunning],
	function* ({ checkOnGitHub, updateCheck }) {
		yield* updateCheck(1, { conclusion: "success", output: MEASURED, status: "completed" });

		expect(yield* checkOnGitHub(1)).toMatchObject({ conclusion: "success", output: MEASURED, status: "completed" });
	},
);

github.it("creating a queued check with a report link sends it as details_url and returns it as detailsUrl", [], function* ({ createCheck }) {
	expect(yield* createCheck({ detailsUrl: "https://reports.example/queued", headSha: HEAD, name: "Coverage", status: "queued" })).toMatchObject({
		detailsUrl: "https://reports.example/queued",
	});
});

github.it(
	"starting check 1 with a new report link sends it as details_url and returns it as detailsUrl",
	[coverageCheckQueued],
	function* ({ updateCheck }) {
		expect(yield* updateCheck(1, { detailsUrl: "https://reports.example/running", status: "in_progress" })).toMatchObject({
			detailsUrl: "https://reports.example/running",
		});
	},
);

github.it(
	"completing check 1 with a new report link sends it as details_url and returns it as detailsUrl",
	[coverageCheckRunning],
	function* ({ updateCheck }) {
		expect(yield* updateCheck(1, { conclusion: "success", detailsUrl: "https://reports.example/complete", status: "completed" })).toMatchObject({
			detailsUrl: "https://reports.example/complete",
		});
	},
);
