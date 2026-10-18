import { expect } from "vitest";
import { questionnaireSource } from "#test/questionnaire.ts";
import { responseFunctionStory } from "#test/responseFunctionStory.ts";

responseFunctionStory.it(
	"reads a rich packet with stable prompt/option identities without treating code examples as controls",
	[],
	({ questionTemplate }) => {
		const template = questionTemplate(`${questionnaireSource}\n\`\`\`markdown\n::::question{id="example"}\n\`\`\`\n`, "direction");
		expect(template.prompts.map((prompt) => [prompt.id, prompt.mode, prompt.options.map((option) => option.id)])).toEqual([
			["display", "one", ["latest", "history"]],
			["checks", "many", ["back", "reload"]],
		]);
		expect(template.context).toContain("```mermaid");
		expect(template.context).toContain('::::question{id="example"}');
		expect(template.context).not.toContain('::::question{id="display"');
	},
);
responseFunctionStory.it(
	"rejects ambiguous, nested and malformed controls rather than silently dropping part of a packet",
	[],
	({ questionTemplate }) => {
		for (const source of [
			questionnaireSource.replace('id="checks"', 'id="display"'),
			questionnaireSource.replace('id="history"', 'id="latest"'),
			questionnaireSource.replace('select="one"', 'select="all"'),
			questionnaireSource.replace('select="one"', 'select="one" default="latest"'),
			questionnaireSource.replace("### How should replies appear?", ':::question{id="nested"}\nNested\n:::'),
			`${questionnaireSource}\n::option[Unbound]{id="orphan"}\n`,
		]) {
			expect(() => questionTemplate(source, "direction")).toThrow();
		}
	},
);
responseFunctionStory.it("scopes question packets explicitly when a document has several open requests", [], ({ questionTemplate }) => {
	const source = questionnaireSource.replace(
		"---\n#",
		"  - id: other\n    kind: review\n    state: open\n    response_from: [maintainer]\n    reason: Other review\n    unblocks: [investigation.choices]\n---\n#",
	);
	expect(() => questionTemplate(source, "direction")).toThrow("request=");
	const explicit = source.replaceAll("::::question{", '::::question{request="direction" ');
	expect(questionTemplate(explicit, "direction").prompts).toHaveLength(2);
	expect(questionTemplate(explicit, "other").prompts).toHaveLength(0);
	expect(questionTemplate("# Ordinary Markdown", "direction").prompts).toHaveLength(0);
});
responseFunctionStory.it(
	"keeps reference links and images readable after the response is saved in another folder, and supports open text prompts",
	[],
	({ questionTemplate }) => {
		const source = `${questionnaireSource}\n::::question{id="next" select="text"}\nWhat is the **next action**? See [work][target] and ![screen](shots/first.png).\n::::\n\n[target]: ../task.md "Affected work"\n`;
		const template = questionTemplate(source, "direction", "proposals/design.md");
		expect(template.prompts[2]?.mode).toBe("text");
		expect(template.prompts[2]?.source).toContain("</proposals/shots/first.png>");
		expect(template.prompts[2]?.source).toContain("/task.md");
	},
);
responseFunctionStory.it(
	"normalizes derived template descriptions so CRLF sources produce the same browser preview and recorded body",
	[],
	({ questionTemplate }) => {
		expect(questionTemplate(questionnaireSource.replaceAll("\n", "\r\n"), "direction", "proposal.md")).toEqual(
			questionTemplate(questionnaireSource, "direction", "proposal.md"),
		);
	},
);
