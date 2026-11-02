import { readFileSync } from "node:fs";
import { write } from "./fixture.ts";
import { workspace } from "./workspace.ts";

const guide = readFileSync(new URL("../../../../docs/releases.md", import.meta.url), "utf8");
export const guideExamples = [...guide.matchAll(/```markdown\n(?<text>[\s\S]*?)\n```/gu)].map((match) => match.groups?.text ?? "");

export function copiedGuideExample(index: number, text: string) {
	return workspace.trait(
		"pending",
		`example ${index + 1} is copied verbatim from the release guide into a workspace with its named packages`,
		function* ({ root }) {
			for (const name of ["react", "releases", "new-name"]) {
				yield* write(root, `packages/${name}/package.json`, JSON.stringify({ name: `@shivaedev/${name}`, version: "0.0.0" }));
			}
			yield* write(root, `.changeset/guide-${index + 1}.md`, `${text}\n`);
		},
	);
}
