import { Effect } from "effect";
import { BadRequest } from "@shivaedev/effect-contract/errors/taxonomy.ts";
import { withFailureContext } from "#engine/failureContext.ts";
import { reportedPullRequest } from "#prompt/worker.ts";

export const resultReport = Effect.fn("FleetHost.resultReport")(function* (output: string) {
	const pr = reportedPullRequest(output);
	if (pr === undefined) {
		return yield* withFailureContext(new BadRequest({ message: "Worker report needs one final FLEET_PR line containing a GitHub PR URL or none" }), {
			code: "worker-report-pr-invalid",
		});
	}
	const lines = output
		.trim()
		.split(/\r?\n/u)
		.map((line) => line.trim());
	const heads = lines.filter((line) => line.startsWith("FLEET_HEAD:"));
	const head = heads[0]
		?.slice("FLEET_HEAD:".length)
		.trim()
		.replace(/^`(?<value>[^`]*)`$/u, "$<value>")
		.trim();
	if (heads.length !== 1 || heads[0] !== lines.at(-2) || head === undefined || /^[a-f\d]{40}$/u.exec(head) === null) {
		return yield* withFailureContext(
			new BadRequest({
				message: "Worker report needs one FLEET_HEAD line with the exact full head SHA immediately before the final PR line",
			}),
			{ code: "worker-report-head-invalid" },
		);
	}
	return { head, pr };
});
