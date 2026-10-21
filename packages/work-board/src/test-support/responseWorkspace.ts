import { stringify } from "yaml";
import { documentWorkspace } from "./documentWorkspace.ts";
import { responseRecords } from "./responseRecords.ts";

export function responseWorkspace(count = 200): Readonly<Record<string, string>> {
	const files: Record<string, string> = { ...documentWorkspace(count / 2) };
	for (let index = 0; index < count; index += 1) {
		const item = `decision.fixture.${index}`;
		const file = `decisions/decision-${index}.md`;
		const source = `---\n${stringify({
			attention: [
				{
					id: "choose",
					kind: "decision",
					managed: true,
					reason: "Choose the next step",
					"response_from": ["maintainer"],
					state: "open",
					unblocks: [item],
				},
			],
			id: item,
			kind: "question",
			options: [
				{ description: "Continue with the recorded direction.", label: "Continue" },
				{ description: "Wait for the next review.", label: "Wait" },
			],
			recommended: "Continue",
			scope: "task",
			status: "ready",
			urgency: "whenever",
		})}---\n# Decision ${index}\n\n${"Review the recorded context and choose the next step. ".repeat(40)}\n`;
		files[file] = source;
		Object.assign(files, responseRecords(index, item, file, source));
	}
	return files;
}
