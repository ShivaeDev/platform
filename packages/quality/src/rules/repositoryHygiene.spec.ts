import { expect } from "@effect/vitest";
import { outcomes } from "@shivaedev/test-story/server/outcomes.ts";
import { qualityInstalled, repositoryHas, ruleStory } from "#test/ruleStory.ts";

ruleStory.it(
	"the repository gate reports dependency pins, selected ASCII text, doc paths, agent links and service folders",
	[
		qualityInstalled(),
		repositoryHas(
			{
				content: 'export default { sources: ["docs", "src"], rules: { "files/ascii": { options: { files: ["docs/*.txt"] } } } };',
				path: "quality.config.ts",
			},
			{ content: '{"name":"fixture","dependencies":{"effect":"^4.0.6"}}', path: "package.json" },
			{ content: "Read `./missing.md`.", path: "docs/guide.md" },
			{ content: "Copied instructions", path: "docs/CLAUDE.md" },
			{ content: "Caf\u00e9", path: "docs/guide.txt" },
			{ content: "export const send = 1;", path: "src/services/mail/send.ts" },
		),
	],
	function* ({ gate, gateReports }) {
		yield* gate();

		yield* outcomes([
			["dependency pins", () => gateReports("manifests/dependency-pins"), expect.stringContaining("package.json")],
			["ASCII text", () => gateReports("files/ascii"), expect.stringContaining("docs/guide.txt")],
			["repository paths", () => gateReports("docs/repository-paths"), expect.stringContaining("./missing.md")],
			["agent links", () => gateReports("docs/agent-links"), expect.stringContaining("docs/CLAUDE.md")],
			["service folders", () => gateReports("effect/service-folders"), expect.stringContaining("src/services/mail")],
		]);
	},
);
