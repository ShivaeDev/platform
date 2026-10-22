import { inboxFixture } from "./inboxFixture.ts";
import { responseRecords } from "./responseRecords.ts";

export function paletteFixture(): Readonly<Record<string, string>> {
	const decision = inboxFixture()["responses/decision.md"] ?? "";
	return {
		...Object.fromEntries(
			Array.from({ length: 10 }, (_, index) => [
				`records/decision-${index}.md`,
				decision.replace("decision.delivery", `decision.delivery.${index}`).replace("Fleet delivery decision", `Inbox decision ${index}`)
					+ '\n```json\n{"id": "task.example", "kind": "task", "next_action": "inbox"}\n```\n\nCaptured inbox context.\n',
			]),
		),
		...responseRecords(1, "decision.delivery.0", "records/decision-0.md", decision),
		"closed.md": "---\nid: project.closed\nkind: goal\nstatus: done\n---\n# Finished workspace\n",
		"goal.md": "---\nid: project.workspace\nkind: goal\nstatus: ready\n---\n# A calmer workspace\n",
		"passage.md": "# Notes\n\nA passage about the inbox.\n",
		"task.md": "---\nid: task.triage\nkind: task\nstatus: ready\n---\n# Build the inbox\n\nKeep real work easy to find.\n",
	};
}
