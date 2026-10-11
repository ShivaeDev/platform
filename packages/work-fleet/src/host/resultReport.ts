import { Effect } from "effect";
import { FleetFailure } from "#policy.ts";
import { reportedPullRequest } from "#prompt/worker.ts";

export const resultReport = Effect.fn("FleetHost.resultReport")(function* (output: string) {
	const pr = reportedPullRequest(output);
	if (pr === undefined) {
		return yield* new FleetFailure({ message: "Worker report needs one final FLEET_PR line containing a GitHub PR URL or none", reason: "invalid" });
	}
	const heads = output.split(/\r?\n/u).filter((line) => line.startsWith("FLEET_HEAD:"));
	const head = heads[0]?.slice("FLEET_HEAD:".length).trim();
	if (heads.length !== 1 || head === undefined || /^[a-f\d]{40}$/u.exec(head) === null) {
		return yield* new FleetFailure({ message: "Worker report needs one FLEET_HEAD line containing the exact full head SHA", reason: "invalid" });
	}
	return { head, pr };
});
