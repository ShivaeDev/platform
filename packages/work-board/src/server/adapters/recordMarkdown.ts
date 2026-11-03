import { stringify } from "yaml";

export function recordMarkdown(fields: Readonly<Record<string, unknown>>, body: string): string {
	return `---\n${stringify(fields)}---\n${body}`;
}
