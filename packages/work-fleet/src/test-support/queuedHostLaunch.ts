import { configureApprovalBackoff } from "#test/approvalBackoff.ts";
import { host } from "#test/hostStory.ts";

export function queuedHostLaunch(rejectedCall: "session" | "turn", workerGuidance: string) {
	return host.trait("configuration", `the provider rejects its first ${rejectedCall} while full`, (engine) =>
		configureApprovalBackoff(engine, rejectedCall, workerGuidance),
	);
}
