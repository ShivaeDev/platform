import { expect } from "vitest";
import { repositoryHas, repositoryLinks, ruleKit } from "#rule-story";
import { docsReferences } from "#rules/docs/references.ts";
import { docsWorkspace, markdown } from "#test/docsRepository.ts";

const guide = markdown(
	"docs/guide.md",
	"# Guide",
	"",
	"## Set up once",
	"",
	"Start [here](#set-up-once), then [tear down](#teardown).",
	"Read [the library](../packages/lib/README.md#using-it) and [the old page](./removed.md).",
	"Compare [a sibling project](../../elsewhere.md) and [the web](https://example.com/guide).",
	"See [the moved guide](https://github.com/acme/tools/blob/main/docs/old.md), [its release](https://github.com/acme/tools/blob/v1.0.0/docs/old.md) and [its commit](https://github.com/acme/tools/blob/0123abc/docs/old.md).",
	"Write `[a link](nowhere.md)` literally.",
	'<img src="images/diagram.png" alt="Diagram">',
	"[archive]: ./archive.md",
	"",
	"```md",
	"[an example](example.md)",
	"```",
);

ruleKit.it(
	"documentation links reach existing files and headings, while code, other sites and pinned releases stay unchecked",
	[
		repositoryHas(
			...docsWorkspace,
			guide,
			markdown("packages/lib/README.md", "# @acme/lib", "", "## Using it"),
			markdown("CHANGELOG.md", "# Changelog", "", "- Moved [the guide](docs/old.md)."),
		),
	],
	function* ({ checks, writes }) {
		const findings = yield* checks(docsReferences);
		expect(findings.map((finding) => [finding.line, finding.subject])).toEqual([
			[5, "#teardown"],
			[6, "./removed.md"],
			[7, "../../elsewhere.md"],
			[8, "https://github.com/acme/tools/blob/main/docs/old.md"],
			[10, "images/diagram.png"],
			[11, "./archive.md"],
		]);
		expect(findings[0]?.message).toBe(
			'"#teardown" links to the heading #teardown, which docs/guide.md does not have. Link to a current heading; GitHub forms its anchor from the heading text.',
		);
		expect(findings[1]?.message).toBe(
			'"./removed.md" links to docs/removed.md, which does not exist. Link to the file\'s current path, or remove the link.',
		);
		expect(findings[2]?.message).toBe('"../../elsewhere.md" leaves the repository. Link to a file inside it, or use an absolute URL.');
		yield* writes(
			markdown("docs/removed.md", "# Removed"),
			markdown("docs/old.md", "# Old"),
			markdown("docs/guide.md", "# Guide", "", "## Set up once", "", "## Teardown", "", "[Start](#set-up-once) and [finish](#teardown)."),
		);
		expect(yield* checks(docsReferences)).toEqual([]);
	},
);

ruleKit.it(
	"a published package README links outside its package by absolute URL, because npm shows it without the repository",
	[
		repositoryHas(
			...docsWorkspace,
			markdown("docs/guide.md", "# Guide"),
			markdown("packages/lib/README.md", "# @acme/lib", "", "Read [the guide](../../docs/guide.md#guide) and [the source](src/repository.ts)."),
			markdown("packages/app/README.md", "# App", "", "Read [the guide](../../docs/guide.md)."),
		),
	],
	function* ({ checks }) {
		const findings = yield* checks(docsReferences);
		expect(findings).toEqual([
			{
				file: "packages/lib/README.md",
				line: 3,
				message:
					'"../../docs/guide.md#guide" leaves its package, and npm shows packages/lib/README.md without the repository around it. Use an absolute URL, such as https://github.com/acme/tools/blob/HEAD/docs/guide.md#guide.',
				subject: "../../docs/guide.md#guide",
			},
		]);
	},
);

ruleKit.it(
	"a document linked under another name, such as CLAUDE.md beside AGENTS.md, reports its findings once",
	[repositoryHas(markdown("AGENTS.md", "# Agents", "", "Read [the guide](docs/guide.md).")), repositoryLinks("CLAUDE.md", "AGENTS.md")],
	function* ({ checks }) {
		expect((yield* checks(docsReferences)).map((finding) => [finding.file, finding.subject])).toEqual([["AGENTS.md", "docs/guide.md"]]);
	},
);
