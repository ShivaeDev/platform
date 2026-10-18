import { engineConfiguration } from "#test/engineConfiguration.ts";

export const singleSlot = engineConfiguration("one execution slot is available", () => ({ concurrency: 1 }));

export function priorityTask(id: string, priority: string, metadata = "") {
	return `---\nid: ${id}\nkind: task\nfleet: approved\nfleet-priority: ${priority}\n${metadata}---\n# Work ${id}\n`;
}
