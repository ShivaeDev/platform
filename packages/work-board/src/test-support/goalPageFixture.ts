import { goalsFixture } from "./goalsFixture.ts";

export function goalPageFixture(): Readonly<Record<string, string>> {
	const files = goalsFixture();
	return {
		...files,
		"first.md": files["first.md"]?.replace("status: done", "status: active") ?? "",
		"goal.md": `${files["goal.md"]}\n\n## Why this goal matters\n\nAuthored context follows the linked work.\n\n<article><p>Authored nested article.</p></article>`,
		"third.md": files["third.md"]?.replace("target: project.example#second", "target: project.example") ?? "",
	};
}
