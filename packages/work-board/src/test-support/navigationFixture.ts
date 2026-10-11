import { inboxFixture, inboxQuestion } from "./inboxFixture.ts";
import { sidebarPaths } from "./sidebarFixture.ts";

export function navigationFixture(): Readonly<Record<string, string>> {
	return {
		...Object.fromEntries(sidebarPaths.map((path) => [path, `# ${path}\n`])),
		"question.md": inboxQuestion,
		"responses/decision.md": inboxFixture()["responses/decision.md"] ?? "",
	};
}
