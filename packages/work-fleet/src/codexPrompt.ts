import type { AgentRequest } from "./ports.ts";
export function attemptMarker(id: string) {
	return `Work Fleet attempt: ${JSON.stringify(id)}\n`;
}
export function codexPrompt({ work, attempt, outcome }: AgentRequest) {
	return [
		attemptMarker(attempt.id),
		attempt.role === "reviewer"
			? "Independently review this outcome and its exact revision. Do not modify files. Return JSON only: {kind:'review',revision,verdict:'approve'|'repair',summary}. Use double quoted JSON keys and strings."
			: "Perform the approved work within its scope. Commit any changes locally and return JSON only: {kind:'outcome',outcome:{kind:'branch',revision}}. If no changes are justified, return {kind:'outcome',outcome:{kind:'no-change',revision,justification}}. Use double quoted JSON keys and strings.",
		"Never merge, push, deploy, change fleet state, widen scope, acquire credentials, or grant permissions. The coordinator performs authorized publishing and delivery. Distinguish executed tests from analysis. Report blocked operations honestly.",
		`Approved work: ${JSON.stringify(work)}`,
		`Outcome under review: ${JSON.stringify(outcome)}`,
		`Revision: ${JSON.stringify(attempt.revision)}`,
		`Feedback: ${JSON.stringify(attempt.feedback)}`,
	].join("\n");
}
