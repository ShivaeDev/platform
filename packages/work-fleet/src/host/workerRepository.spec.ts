import { expect } from "@effect/vitest";
import { task } from "#test/fleetHost.ts";
import { REPORT_SOURCE } from "#test/hostReportTraits.ts";
import { boardWork, host } from "#test/hostStory.ts";
import { cloudWorker } from "#test/workerBrief.ts";

for (const deliverable of ["pr", "report"] as const) {
	const source = deliverable === "report" ? REPORT_SOURCE : task("research", "approved");
	const checkout = deliverable === "report" ? "check out that revision detached" : "create worker/research at that revision";

	host.it(
		`cloud ${deliverable} workers retain the default repository startup instructions`,
		[boardWork({ "research.md": source }, cloudWorker)],
		function* (daemon) {
			yield* daemon.approve("research");

			const prompt = daemon.providerTurns()[0]?.prompt;
			expect(prompt).toContain(
				`- Fetch origin/main, ${checkout} in the supplied checkout, then immediately run \`./script/update\` with require_escalated. Leave unrelated state alone.`,
			);
		},
	);

	host.it(
		`cloud ${deliverable} workers receive the configured remote, base branch and setup command`,
		[
			boardWork(
				{ "research.md": source },
				{
					...cloudWorker,
					repository: { branch: "release/next", remote: "upstream" },
					worker: { ...cloudWorker.worker, setupCommand: "pnpm install --frozen-lockfile && pnpm prepare" },
				},
			),
		],
		function* (daemon) {
			yield* daemon.approve("research");

			const prompt = daemon.providerTurns()[0]?.prompt;
			expect(prompt).toContain(
				`- Fetch upstream/release/next, ${checkout} in the supplied checkout, then immediately run \`pnpm install --frozen-lockfile && pnpm prepare\` with require_escalated. Leave unrelated state alone.`,
			);
			expect(prompt).not.toContain("origin/main");
			expect(prompt).not.toContain("./script/update");
			if (deliverable === "pr") {
				expect(prompt).toContain("Merge release/next only");
				expect(prompt).not.toContain("Merge main only");
			}
		},
	);
}

host.it(
	"local PR workers receive the question and result protocol",
	[boardWork({ "research.md": task("research", "approved") })],
	function* (daemon) {
		yield* daemon.approve("research");

		const prompt = daemon.providerTurns()[0]?.prompt;
		expect(prompt).toContain("FLEET_QUESTION: <question>");
		expect(prompt).toContain("FLEET_MAINTAINER_QUESTION: <question>");
		expect(prompt).toContain("FLEET_HEAD: <sha>\nFLEET_PR: <url or none>");
	},
);
