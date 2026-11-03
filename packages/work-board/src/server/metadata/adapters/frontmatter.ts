import { Effect } from "effect";
import { isMap, isSeq, parseDocument } from "yaml";
import { BadRequest } from "@shivaedev/errors/taxonomy.ts";

function header(source: string) {
	const opening = /^\uFEFF?---[ \t]*\r?\n/u.exec(source);
	const remainder = source.slice(opening?.[0].length ?? 0);
	const closing = opening && /^---[ \t]*\r?$/mu.exec(remainder);
	if (opening && !closing) {
		throw new Error("Unterminated frontmatter.");
	}
	const document = parseDocument(closing ? remainder.slice(0, closing.index) : "{}\n");
	if (document.errors.length > 0 || document.warnings.length > 0 || !isMap(document.contents)) {
		throw new Error("Frontmatter must be a valid YAML mapping.");
	}
	const end = closing ? opening[0].length + closing.index + closing[0].length : 0;
	return {
		body: source.slice(end + (closing && source[end] === "\n" ? 1 : 0)),
		document,
		newline: opening?.[0].endsWith("\r\n") ? "\r\n" : "\n",
		opening: opening?.[0] ?? "---\n",
	};
}

function invalid(cause: unknown) {
	return new BadRequest({ message: cause instanceof Error ? cause.message : "Invalid frontmatter." });
}

export function metadataValues(source: string): Effect.Effect<Readonly<Record<string, unknown>>, BadRequest> {
	return Effect.try({ catch: invalid, try: () => header(source).document.toJS({ maxAliasCount: 50 }) });
}

function edit(source: string, update: (document: ReturnType<typeof header>["document"]) => void) {
	return Effect.try({
		catch: invalid,
		try: () => {
			const { body, document, newline, opening } = header(source);
			update(document);
			return `${opening}${document.toString({ lineWidth: 0 }).replace(/\n/gu, newline)}---${newline}${body}`;
		},
	});
}

export function patchMetadata(source: string, fields: Readonly<Record<string, unknown>>) {
	return edit(source, (document) => {
		for (const [key, value] of Object.entries(fields)) {
			document.set(key, value);
		}
	});
}

export function closeDecision(source: string, request: string, nextAction?: string) {
	return edit(source, (document) => {
		const attention = document.get("attention", true);
		const matches = isSeq(attention) ? attention.items.filter((item) => isMap(item) && item.get("id") === request) : [];
		const selected = matches[0];
		if (document.get("kind") !== "question" || matches.length !== 1 || !isMap(selected) || selected.get("kind") !== "decision") {
			throw new Error("The decision request is missing or ambiguous.");
		}
		selected.set("state", "closed");
		if (isSeq(attention) && attention.items.every((item) => isMap(item) && item.get("state") === "closed")) {
			document.set("status", "done");
		}
		if (nextAction !== undefined) {
			document.set("next_action", nextAction);
		}
	});
}
