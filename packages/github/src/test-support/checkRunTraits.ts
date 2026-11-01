import { github } from "./github.ts";
import { HEAD } from "./writeTraits.ts";

export const checksFromSeveralApps = github.trait("github", "the commit has old and new checks from several apps across pages", ({ writes }) => {
	const base = { conclusion: null, detailsUrl: null, headSha: HEAD, output: { summary: null, text: null, title: null }, status: "queued" };
	writes.checks = [
		{ ...base, app: { id: 7 }, id: 11, name: "Coverage" },
		{ ...base, app: { id: 9 }, id: 99, name: "Coverage" },
		{ ...base, app: { id: 7 }, id: 15, name: "Coverage" },
		{ ...base, app: { id: 7 }, id: 17, name: "Lint" },
		{ ...base, app: { id: 7 }, headSha: "another-commit", id: 120, name: "Coverage" },
	];
});

export const checkListingRefused = github.trait("github", "GitHub refuses listing check runs", function* ({ server }) {
	yield* server.scriptFault("checkRuns", { kind: "status", reply: { body: { message: "Resource not accessible by integration" }, status: 403 } });
});

export const checkWithoutApp = github.trait("github", "a newer check has no app metadata", ({ writes }) => {
	const check = {
		conclusion: null,
		detailsUrl: null,
		headSha: HEAD,
		id: 200,
		name: "Coverage",
		output: { summary: null, text: null, title: null },
		status: "queued",
	};
	writes.checks.push(check, { ...check, app: null, id: 201 });
});

export function actionsCheckInState(status: "waiting" | "requested" | "pending") {
	return github.trait("github", `another app has a newer Coverage check in the GitHub Actions ${status} state`, ({ writes }) => {
		writes.checks.push({
			app: { id: 9 },
			conclusion: null,
			detailsUrl: null,
			headSha: HEAD,
			id: 300,
			name: "Coverage",
			output: { summary: null, text: null, title: null },
			status,
		});
	});
}
