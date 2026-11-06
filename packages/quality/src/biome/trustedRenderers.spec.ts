import { expect } from "@effect/vitest";
import { biomeStory, presetInstalled, repositoryHas } from "#test/biomeStory.ts";

biomeStory.it(
	"Quality accepts declared trusted renderer output and still reports undeclared HTML injection",
	[
		presetInstalled(),
		repositoryHas(
			{
				content: `export default { exceptions: [{ files: ["src/Diagram.tsx"], reason: "The renderer adapter produces the trusted Mermaid SVG.", rules: ["biome/lint/security/noDangerouslySetInnerHtml"] }] };`,
				path: "quality.config.ts",
			},
			{ content: "export const Diagram = ({ svg }) => <div dangerouslySetInnerHTML={{ __html: svg }} />;", path: "src/Diagram.tsx" },
			{ content: "export const Undeclared = ({ html }) => <div dangerouslySetInnerHTML={{ __html: html }} />;", path: "src/Undeclared.tsx" },
		),
	],
	function* ({ checks, reported }) {
		yield* checks();

		expect(yield* reported("lint/security/noDangerouslySetInnerHtml")).toEqual(["src/Undeclared.tsx:1"]);
	},
);
