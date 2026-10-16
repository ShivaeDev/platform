import { REPORT_ATTACHMENT_DIRECTORY, REPORT_ATTACHMENT_MARKER } from "#reportAttachments.ts";

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
const GUIDANCE_HEADING =
	"Repository worker guidance: maintainer's standing answers to the repository's 'ask the maintainer first' rules; takes precedence for this task";
const GUIDANCE_END = "End repository worker guidance.";
const QUESTION_INSTRUCTIONS = [
	"When you need a decision:",
	"- Do not ask about anything covered by Repository worker guidance; follow its standing answers.",
	`- Stop the turn with \`${QUESTION_MARKER} <question>\`, including the context and choices needed to answer. Do not report a PR or no-change outcome while waiting for an answer.`,
	`- Questions go to the orchestrator by default. Only when a decision requires maintainer authority, use \`${MAINTAINER_QUESTION_MARKER} <question>\` instead.`,
	"- Fleet publishes the question on the Board and continues this same thread with the recorded answer. Treat that answer as task input; repository rules and runtime authority still apply.",
].join("\n");
const REPORT_INSTRUCTIONS = [
	"Report deliverable:",
	"- Leave repository sources unchanged. Commit nothing, push nothing, and open no PR. Do not create a branch or launch other workers.",
	`- Write report attachments as new uncommitted files under ${REPORT_ATTACHMENT_DIRECTORY}, using the file-edit/apply_patch tool for every add and update. Fleet reconstructs files from this turn's fileChange items; files created or changed by shell commands are not retrievable. Never publish attachments to git or GitHub.`,
	`- Use UTF-8 text attachments. For binary evidence, write a base64 text file with the file-edit tool and describe its encoding. List every promised attachment in the final report on its own line: ${REPORT_ATTACHMENT_MARKER} <path relative to ${REPORT_ATTACHMENT_DIRECTORY}>. Do not reuse files from earlier turns.`,
	"- Read the root and package AGENTS.md and use read-only research to answer the approved task.",
	"- Return the whole report as your final message, with evidence for each acceptance criterion and any remaining uncertainty.",
].join("\n");

// Codex Cloud cannot run startup steps; without this block workers spend minutes probing a provisioning sandbox.
export function cloudStartup({ sharedEnvironment }: CloudStartup, access?: "read-only") {
	return [
		"Cloud startup:",
		"- Your workspace may still be provisioning when this message arrives. If the cloud-environment runtime skill offers wait_for_environment, call it and wait calmly until the environment is ready; this usually takes about 90 seconds. Do not explore the snapshot or retry commands while waiting. Your instructions below stay valid.",
		"- Default login shells activate the pinned Node, pnpm, Bun, gh and psql and every shared environment export through the profile hook, including the proxy, CA trust, caches and database settings.",
		`- If \`node -v\` does not report the repository's \`.node-version\`, source ${sharedEnvironment} once in that command and say so in the final message.`,
		...(access === "read-only"
			? []
			: [
					"- Request escalation (require_escalated) from the FIRST network-dependent command, such as git fetch or dependency installation, instead of waiting for it to fail.",
				]),
	].join("\n");
}

export function workerPrompt(input: WorkerPrompt) {
	if (input.deliverable === "report") {
		return [
			`Work Board task: ${input.workId}`,
			"",
			cloudStartup(input),
			"- Before executing repository commands, run `./script/update` with escalation (require_escalated), since it installs dependencies.",
			"",
			reportPrompt(input.task.trim()),
		].join("\n");
	}
	return [
		`Work Board task: ${input.workId}`,
		"",
		cloudStartup(input),
		`- Fetch origin/main and create ${input.branch} from that exact current revision, not from the environment snapshot. Use the supplied checkout and leave unrelated state alone.`,
		"- Immediately after fetching origin/main and creating the branch, run `./script/update` with escalation (require_escalated), since it installs dependencies, before any other command or task work.",
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
		"- `main` is protected by a merge queue that re-runs CI against the latest main before merging. Merge main only when GitHub reports a conflict or your change needs something that landed there. A branch behind main without conflicts does not need a merge, fresh review or revalidation. Never wait for main to stop moving or request a merge freeze.",
		"- If you merge main or otherwise change the head, run `pnpm ready`, push and watch CI again for the new head. Report once all checks are green for your exact head, or when genuinely blocked. If blocked, explain why and identify the failed or pending checks.",
		"",
		QUESTION_INSTRUCTIONS,
		"",
		"Final report:",
		"- The pull request URL, its head SHA and base, the changed paths and the exact commands you ran with their results.",
		"- A short result against each acceptance criterion, separating proven behavior from anything still pending.",
		"- State the CI result for the exact head SHA you report, including any failed or pending checks and why you are blocked. Put the CI result before the final `FLEET_PR:` line.",
		"- Before the final PR line, include one line `FLEET_HEAD: <sha>` with the full 40-character PR head SHA, or the exact checked main SHA when no change was needed.",
		`- End with one line \`${PULL_REQUEST_MARKER} <url>\` naming the pull request, or \`${PULL_REQUEST_MARKER} none\` when no change was needed.`,
	].join("\n");
}

export function reportPrompt(task: string): string {
	return task.endsWith(REPORT_INSTRUCTIONS) ? task : [task, "", QUESTION_INSTRUCTIONS, "", REPORT_INSTRUCTIONS].join("\n");
}

export function withWorkerGuidance(prompt: string, guidance?: string): string {
	if (guidance === undefined) {
		return prompt;
	}
	const block = [GUIDANCE_HEADING, guidance, GUIDANCE_END].join("\n");
	const task = prompt.replaceAll(new RegExp(`\\n\\n${GUIDANCE_HEADING}\\n[\\s\\S]*?\\nEnd repository worker guidance\\.`, "gu"), "");
	const evidence = task.indexOf("\n\nEvidence rules:");
	const boundary = evidence < 0 ? task.indexOf("\n\nWhen you need a decision:") : evidence;
	return boundary < 0 ? [task, block].join("\n\n") : `${task.slice(0, boundary)}\n\n${block}${task.slice(boundary)}`;
}

export function reportedPullRequest(output: string) {
	const lines = output
		.trim()
		.split(/\r?\n/u)
		.map((line) => line.trim());
	const markers = lines.filter((line) => line.startsWith(PULL_REQUEST_MARKER));
	if (markers.length !== 1 || markers[0] !== lines.at(-1)) {
		return undefined;
	}
	const value = markers[0]
		?.slice(PULL_REQUEST_MARKER.length)
		.trim()
		.replace(/^`(?<value>[^`]*)`$/u, "$<value>")
		.trim();
	if (value === "none") {
		return { kind: "none" } as const;
	}
	if (value === undefined || /^https:\/\/github\.com\/[\w.-]+\/[\w.-]+\/pull\/[1-9]\d*$/u.exec(value) === null) {
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
