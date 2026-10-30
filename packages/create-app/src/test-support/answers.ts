import { realpathSync } from "node:fs";

export interface Ran {
	readonly status: number | null;
	readonly stderr: string;
	readonly stdout: string;
}

const PREFIX = "create-app: ";

function withoutWorkspace(text: string, workspace: string) {
	return text.replaceAll(realpathSync(workspace), "<workspace>").replaceAll(workspace, "<workspace>");
}

export function cliAnswer(result: Ran, workspace: string, success: (stdout: string) => string) {
	if (result.status === 0) {
		return success(result.stdout);
	}
	const at = result.stderr.lastIndexOf(PREFIX);
	if (result.status === 1 && at !== -1) {
		const message = result.stderr
			.slice(at)
			.split("\n")
			.filter((line) => !line.startsWith("[generated app timing]"))
			.join("\n")
			.trim();
		return withoutWorkspace(message, workspace);
	}
	return `crashed with exit ${result.status}: ${result.stdout}${result.stderr}`;
}

export function scriptOutcome(result: Ran) {
	return result.status === 0 ? "passed" : `failed with exit ${result.status}:\n${result.stdout}${result.stderr}`;
}
