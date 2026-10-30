import { Effect } from "effect";
import { isDocument } from "#docs/isDocument.ts";
import { codeSpans, type MarkdownLine, markdownLines } from "#docs/markdownLines.ts";
import { defineRule, type Finding, type RuleInputs } from "#rule.ts";

const SHELL_LANGUAGES: ReadonlySet<string> = new Set(["", "bash", "console", "sh", "shell", "zsh"]);

const INSTALL = /\b(?:(?:pnpm|npm|yarn|bun)\s+(?:add|install|i|dlx|exec|create|x)|npx|bunx)\s+(?<rest>[^;&|]+)/gu;

const VERSIONED = /^(?<name>@?[^@\s]+)@(?<version>[\d*<=>^~].*)$/u;

function commandsIn(line: MarkdownLine): readonly string[] {
	if (line.kind === "code") {
		return SHELL_LANGUAGES.has(line.language) ? [line.text] : [];
	}
	return line.kind === "prose" ? codeSpans(line.text) : [];
}

function versioned(command: string): readonly string[] {
	return [...command.matchAll(INSTALL)].flatMap((match) =>
		(match.groups?.rest ?? "").split(/\s+/u).filter((token) => !token.startsWith("-") && VERSIONED.test(token)),
	);
}

function findingsIn(file: string, text: string): readonly Finding[] {
	return markdownLines(text).flatMap((line) =>
		commandsIn(line)
			.flatMap(versioned)
			.map((token) => ({
				file,
				line: line.number,
				message: `"${token}" pins a version in an install command. Name the package alone, ${VERSIONED.exec(token)?.groups?.name}: its manifest's version ranges decide what installs, and a version written in documentation goes stale with the next release.`,
				subject: token,
			})),
	);
}

const unversionedInstalls = Effect.fn("Docs.unversionedInstalls")(function* (inputs: RuleInputs) {
	const findings = yield* Effect.forEach(inputs.files.filter(isDocument), (file) =>
		Effect.map(
			Effect.promise(() => inputs.readText(file)),
			(text) => (text === undefined ? [] : findingsIn(file, text)),
		),
	);
	return findings.flat();
});

export const docsUnversionedInstalls = defineRule({
	check: unversionedInstalls,
	description:
		"Install commands in Markdown name packages without versions, so documentation never tells a reader to install a release it has already left behind.",
	id: "docs/unversioned-installs",
});
