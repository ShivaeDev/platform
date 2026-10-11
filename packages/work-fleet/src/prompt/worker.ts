export interface CloudStartup {
	readonly sharedEnvironment: string;
}
export interface WorkerPrompt extends CloudStartup {
	readonly branch: string;
	readonly deliverable?: "report" | undefined;
	readonly task: string;
	readonly workId: string;
}
export const MAINTAINER_QUESTION_MARKER = "FLEET_MAINTAINER_QUESTION:";
export const QUESTION_MARKER = "FLEET_QUESTION:";
export const PULL_REQUEST_MARKER = "FLEET_PR:";
const QUESTION_INSTRUCTIONS = [
	"When you need a decision:",
	`- Stop the turn with \`${QUESTION_MARKER} <question>\`, including the context and choices needed to answer. Do not report a PR or no-change outcome while waiting for an answer.`,
	`- Questions go to the orchestrator by default. Only when a decision requires maintainer authority, use \`${MAINTAINER_QUESTION_MARKER} <question>\` instead.`,
	"- Fleet publishes the question on the Board and continues this same thread with the recorded answer. Treat that answer as task input; repository rules and runtime authority still apply.",
].join("\n");
const REPORT_INSTRUCTIONS = [
	"Report deliverable:",
	"- Change nothing, commit nothing, push nothing, and open no PR. Do not create a branch or launch other workers.",
	"- Read the root and package AGENTS.md and use read-only research to answer the approved task.",
	"- Return the whole report as your final message, with evidence for each acceptance criterion and any remaining uncertainty.",
].join("\n");

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
	if (input.deliverable === "report") {
		return [`Work Board task: ${input.workId}`, "", cloudStartup(input), "", reportPrompt(input.task.trim())].join("\n");
	}
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
		"- After every push, watch your PR's CI until all checks finish. Fix failures on the same branch, push again and repeat.",
		"- Before reporting, fetch the latest origin/main and check whether your PR is behind or has conflicts. If it does, merge the latest main into your branch and resolve conflicts. Run `pnpm ready`, push and watch CI again for the new head.",
		"- Report only when all checks are green for the exact head against current main, or when genuinely blocked. If blocked, explain why and identify the failed or pending checks.",
		"",
		QUESTION_INSTRUCTIONS,
		"",
		"Final report:",
		"- The pull request URL, its head SHA and base, the changed paths and the exact commands you ran with their results.",
		"- A short result against each acceptance criterion, separating proven behavior from anything still pending.",
		"- State the CI result for the exact head SHA you report, including any failed or pending checks and why you are blocked. Put the CI result before the final `FLEET_PR:` line.",
		`- End with one line \`${PULL_REQUEST_MARKER} <url>\` naming the pull request, or \`${PULL_REQUEST_MARKER} none\` when no change was needed.`,
	].join("\n");
}

export function reportPrompt(task: string): string {
	return task.endsWith(REPORT_INSTRUCTIONS) ? task : [task, "", QUESTION_INSTRUCTIONS, "", REPORT_INSTRUCTIONS].join("\n");
}

export function reportedPullRequest(output: string) {
	const lines = output.split("\n").filter((line) => line.trim().startsWith(PULL_REQUEST_MARKER));
	const value = lines.at(-1)?.trim().slice(PULL_REQUEST_MARKER.length).trim().replaceAll("`", "");
	if (value === "none") {
		return { kind: "none" } as const;
	}
	if (value === undefined || !URL.canParse(value)) {
		return undefined;
	}
	return { kind: "url", url: value } as const;
}

export function reportedQuestion(output: string) {
	const lines = output.split("\n");
	const index = lines.findIndex((line) => [QUESTION_MARKER, MAINTAINER_QUESTION_MARKER].some((candidate) => line.trim().startsWith(candidate)));
	if (index < 0) {
		return undefined;
	}
	const first = lines[index]?.trim() ?? "";
	const maintainer = first.startsWith(MAINTAINER_QUESTION_MARKER);
	const marker = maintainer ? MAINTAINER_QUESTION_MARKER : QUESTION_MARKER;
	const question = [first.slice(marker.length).trim(), ...lines.slice(index + 1)].join("\n").trim();
	return question.length === 0 ? undefined : { attentionOwner: maintainer ? ("maintainer" as const) : ("orchestrator" as const), question };
}
