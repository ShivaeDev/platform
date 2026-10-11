export interface CloudStartup {
	readonly sharedEnvironment: string;
}
export interface WorkerPrompt extends CloudStartup {
	readonly branch: string;
	readonly task: string;
	readonly workId: string;
}
export const PULL_REQUEST_MARKER = "FLEET_PR:";

// Codex Cloud cannot run startup steps; without this block workers spend minutes probing a provisioning sandbox.
export function cloudStartup({ sharedEnvironment }: CloudStartup) {
	return [
		"Cloud startup:",
		"- Your workspace may still be provisioning when this message arrives. If the cloud-environment runtime skill offers wait_for_environment, call it and wait calmly until the environment is ready; this usually takes about 90 seconds. Do not explore the snapshot or retry commands while waiting. Your instructions below stay valid.",
		`- Source ${sharedEnvironment} at the start of EVERY independent shell command when it exists. The pinned Node, pnpm and Bun, the proxy, CA trust, caches and database settings come from it.`,
		"- Request escalation (require_escalated) from the FIRST network-dependent command, such as git fetch or dependency installation, instead of waiting for it to fail.",
	].join("\n");
}

export function workerPrompt(input: WorkerPrompt) {
	return [
		`Work Board task: ${input.workId}`,
		"",
		cloudStartup(input),
		`- Fetch origin/main and create ${input.branch} from that exact current revision, not from the environment snapshot. Use the supplied checkout and leave unrelated state alone.`,
		"",
		"Implement this approved Board task:",
		"---",
		input.task.trim(),
		"---",
		"",
		"Evidence rules:",
		"- Read the root and package AGENTS.md before editing, and follow the repository's documentation and pull request skills.",
		"- Run focused tests while working, then `pnpm ready` before handing off. Never bypass or skip hooks, and never raise the quality baseline.",
		"- Open exactly ONE pull request for human review. Do not merge it and do not launch other workers.",
		"- Keep Board IDs, environment IDs, prompts and other private identifiers out of source, docs and pull request metadata.",
		"",
		"Final report:",
		"- The pull request URL, its head SHA and base, the changed paths and the exact commands you ran with their results.",
		"- A short result against each acceptance criterion, separating proven behavior from anything still pending.",
		"- Before the final PR line, include one line `FLEET_HEAD: <sha>` with the full 40-character PR head SHA, or the exact checked main SHA when no change was needed.",
		`- End with one line \`${PULL_REQUEST_MARKER} <url>\` naming the pull request, or \`${PULL_REQUEST_MARKER} none\` when no change was needed.`,
	].join("\n");
}

export function reportedPullRequest(output: string) {
	const lines = output.trim().split(/\r?\n/u);
	const markers = lines.filter((line) => line.startsWith(PULL_REQUEST_MARKER));
	if (markers.length !== 1 || markers[0] !== lines.at(-1)) {
		return undefined;
	}
	const value = markers[0]?.slice(PULL_REQUEST_MARKER.length).trim();
	if (value === "none") {
		return { kind: "none" } as const;
	}
	if (value === undefined || /^https:\/\/github\.com\/[\w.-]+\/[\w.-]+\/pull\/[1-9]\d*$/u.exec(value) === null) {
		return undefined;
	}
	return { kind: "url", url: value } as const;
}
