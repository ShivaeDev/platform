import { expect } from "vitest";
import { docsReferences } from "#rules/docs/references.ts";
import { docsWorkspace, guide, markdown } from "#test/docsRepository.ts";
import { repositoryHas, repositoryLinks, ruleStory } from "#test/ruleStory.ts";

const GONE = "Link to the file's current path, or remove the link.";

const LIBRARY_README = markdown("packages/lib/README.md", "# @acme/lib", "", "## Using it");

const BROKEN_LINKS = [
	{
		link: "Finish with [tear down](#teardown).",
		message:
			'"#teardown" links to the heading #teardown, which docs/guide.md does not have. Link to a current heading; GitHub forms its anchor from the heading text.',
		name: "a link to a heading the document does not have",
		subject: "#teardown",
	},
	{
		link: "Read [the old page](./removed.md).",
		message: `"./removed.md" links to docs/removed.md, which does not exist. ${GONE}`,
		name: "a link to a file that does not exist",
		subject: "./removed.md",
	},
	{
		link: "Compare [a sibling project](../../elsewhere.md).",
		message: '"../../elsewhere.md" leaves the repository. Link to a file inside it, or use an absolute URL.',
		name: "a link that leaves the repository",
		subject: "../../elsewhere.md",
	},
	{
		link: "See [the moved guide](https://github.com/acme/tools/blob/main/docs/old.md).",
		message: `"https://github.com/acme/tools/blob/main/docs/old.md" links to docs/old.md, which does not exist. ${GONE}`,
		name: "a GitHub link on a branch of this repository to a file that does not exist",
		subject: "https://github.com/acme/tools/blob/main/docs/old.md",
	},
	{
		link: '<img src="images/diagram.png" alt="Diagram">',
		message: `"images/diagram.png" links to docs/images/diagram.png, which does not exist. ${GONE}`,
		name: "an HTML image whose source does not exist",
		subject: "images/diagram.png",
	},
	{
		link: "[archive]: ./archive.md",
		message: `"./archive.md" links to docs/archive.md, which does not exist. ${GONE}`,
		name: "a link reference definition to a file that does not exist",
		subject: "./archive.md",
	},
];

const UNCHECKED_LINKS = [
	{ lines: ["Start [here](#set-up-once)."], name: "a link to a heading the document has" },
	{ lines: ["Read [the library](../packages/lib/README.md#using-it)."], name: "a link to a heading of another document" },
	{ lines: ["Compare [the web](https://example.com/guide)."], name: "a link to another site" },
	{ lines: ["See [its release](https://github.com/acme/tools/blob/v1.0.0/docs/old.md)."], name: "a GitHub link pinned to a release tag" },
	{ lines: ["See [its commit](https://github.com/acme/tools/blob/0123abc/docs/old.md)."], name: "a GitHub link pinned to a commit" },
	{ lines: ["Write `[a link](nowhere.md)` literally."], name: "a link written in inline code" },
	{ lines: ["```md", "[an example](example.md)", "```"], name: "a link inside a fenced code block" },
];

for (const { link, message, name, subject } of BROKEN_LINKS) {
	ruleStory.it(`docs/references reports ${name} at its line`, [repositoryHas(...docsWorkspace, LIBRARY_README, guide(link))], function* ({ check }) {
		const findings = yield* check(docsReferences);

		expect(findings).toEqual([{ file: "docs/guide.md", line: 5, message, subject }]);
	});
}

for (const { lines, name } of UNCHECKED_LINKS) {
	ruleStory.it(`docs/references accepts ${name}`, [repositoryHas(...docsWorkspace, LIBRARY_README, guide(...lines))], function* ({ check }) {
		expect(yield* check(docsReferences)).toEqual([]);
	});
}

ruleStory.it(
	"docs/references leaves the links of CHANGELOG.md unchecked, because a released entry keeps the links of its release",
	[repositoryHas(...docsWorkspace, markdown("CHANGELOG.md", "# Changelog", "", "- Moved [the guide](docs/old.md)."))],
	function* ({ check }) {
		expect(yield* check(docsReferences)).toEqual([]);
	},
);

ruleStory.it(
	"docs/references asks a published package README to link outside its package by absolute URL, because npm shows it without the repository",
	[
		repositoryHas(
			...docsWorkspace,
			markdown("docs/guide.md", "# Guide"),
			markdown("packages/lib/README.md", "# @acme/lib", "", "Read [the guide](../../docs/guide.md#guide)."),
		),
	],
	function* ({ check }) {
		const findings = yield* check(docsReferences);

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

ruleStory.it(
	"docs/references accepts a published package README that links to a file inside its package",
	[repositoryHas(...docsWorkspace, markdown("packages/lib/README.md", "# @acme/lib", "", "Read [the source](src/repository.ts)."))],
	function* ({ check }) {
		expect(yield* check(docsReferences)).toEqual([]);
	},
);

ruleStory.it(
	"docs/references accepts a private package README that links outside its package",
	[
		repositoryHas(
			...docsWorkspace,
			markdown("docs/guide.md", "# Guide"),
			markdown("packages/app/README.md", "# App", "", "Read [the guide](../../docs/guide.md)."),
		),
	],
	function* ({ check }) {
		expect(yield* check(docsReferences)).toEqual([]);
	},
);

ruleStory.it(
	"docs/references reports a broken link once when another name links to its document, such as CLAUDE.md beside AGENTS.md",
	[repositoryHas(markdown("AGENTS.md", "# Agents", "", "Read [the guide](docs/guide.md).")), repositoryLinks("CLAUDE.md", "AGENTS.md")],
	function* ({ check, locations }) {
		yield* check(docsReferences);

		expect(yield* locations()).toEqual(["AGENTS.md:3"]);
	},
);
