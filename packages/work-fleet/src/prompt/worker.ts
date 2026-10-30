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
	`- Stop with \`${QUESTION_MARKER} <question>\` and the context and choices; use \`${MAINTAINER_QUESTION_MARKER} <question>\` only for maintainer authority. Await Fleet's answer in this thread before reporting an outcome.`,
].join("\n");
const REPORT_INSTRUCTIONS = [
	"Report deliverable:",
	"- Leave repository sources unchanged. Commit nothing, push nothing, and open no PR. Do not create a branch or launch other workers.",
	`- Write report attachments as new uncommitted files under ${REPORT_ATTACHMENT_DIRECTORY}, using the file-edit/apply_patch tool for every add and update. Fleet reconstructs files from this turn's fileChange items; files created or changed by shell commands are not retrievable. Never publish attachments to git or GitHub.`,
	`- Use UTF-8 text attachments. For binary evidence, write a base64 text file with the file-edit tool and describe its encoding. List every promised attachment in the final report on its own line: ${REPORT_ATTACHMENT_MARKER} <path relative to ${REPORT_ATTACHMENT_DIRECTORY}>. Do not reuse files from earlier turns.`,
	"- Read the root and package AGENTS.md and use read-only research to answer the approved task.",
	"- Return the whole report as your final message, with evidence for each acceptance criterion and any remaining uncertainty.",
	"- End the report with exactly one FLEET_HEAD: <full 40-character checked revision> line, using git rev-parse HEAD from the checkout you researched.",
].join("\n");

// Codex Cloud cannot run startup steps before the worker receives its prompt.
export function cloudStartup({ sharedEnvironment }: CloudStartup, access?: "read-only") {
	return [
		"Cloud startup:",
		"- If provisioning, use the runtime skill's wait_for_environment before repository commands.",
		`- Login shells load the shared tools and exports. If Node differs from .node-version, source ${sharedEnvironment} once and report it.`,
		...(access === "read-only" ? [] : ["- Use require_escalated for network commands, starting with the first."]),
	].join("\n");
}

export function workerPrompt(input: WorkerPrompt) {
	const task = input.task.trim();
	return [
		task,
		"",
		cloudStartup(input),
		...(input.deliverable === "report"
			? [
					"- Fetch origin/main, check out that revision detached in the supplied checkout, then immediately run `./script/update` with require_escalated. Leave unrelated state alone.",
				]
			: [
					`- Fetch origin/main, create ${input.branch} at that revision in the supplied checkout, then immediately run \`./script/update\` with require_escalated. Leave unrelated state alone.`,
				]),
		"",
		...(input.deliverable === "report"
			? [reportPrompt("")]
			: [
					"Evidence rules:",
					"- Follow root and package AGENTS.md and repository skills.",
					"- Open one PR for human review; do not merge or launch workers. Keep internal identifiers and prompts out of committed content and PR text.",
					"- After every push, watch required CI checks to completion and repair failures on this branch.",
					"Only checks required by GitHub branch protection or repository rulesets gate the pull request; optional app checks are information and must not trigger repair, waiting or a question.",
					"- Merge main only for a GitHub-reported conflict or a required change there; the merge queue validates current main.",
					"",
					QUESTION_INSTRUCTIONS,
					"",
					"Final report:",
					"- Give PR URL, head and base, changed paths, validation commands and results, evidence or gaps for each criterion, and exact-head CI (identify failed or pending checks if blocked).",
					"- Finish with these two lines (full 40-character head SHA; use the checked main SHA and none for no change):",
					"FLEET_HEAD: <sha>",
					`${PULL_REQUEST_MARKER} <url or none>`,
				]),
	].join("\n");
}

export function reportPrompt(task: string, baseRevision?: string): string {
	const base =
		baseRevision === undefined
			? ""
			: `Expected research base: ${baseRevision}. Fetch origin/main before research; verify HEAD is this commit or a descendant. If it is older or divergent, stop with a question instead of reporting findings.`;
	if (task.endsWith(REPORT_INSTRUCTIONS)) {
		return base && !task.includes(base) ? task.replace(REPORT_INSTRUCTIONS, `${base}\n\n${REPORT_INSTRUCTIONS}`) : task;
	}
	return [task, "", base, "", QUESTION_INSTRUCTIONS, "", REPORT_INSTRUCTIONS].join("\n");
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
