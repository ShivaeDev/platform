import { Effect } from "effect";
import { isNode } from "yaml";
import { BadRequest } from "@shivaedev/errors/taxonomy.ts";
import type { MetadataDocument } from "#server/metadata/model.ts";
import { metadataParse } from "#server/metadata/parse.ts";
import { sourceHeader } from "#server/migration/sourceHeader.ts";

export function validateFiles(
	files: readonly { readonly file: string; readonly source: string }[],
): Effect.Effect<readonly MetadataDocument[], BadRequest> {
	const documents = files.map(({ file, source }) => ({ file, parsed: metadataParse(source), source }));
	const problems = documents.flatMap(({ file, parsed, source }) =>
		parsed.diagnostics.map((problem) => {
			const field = problem.field ?? "frontmatter";
			const header = sourceHeader(source);
			const node = header?.doc.get(field, true);
			const value = header && isNode(node) && node.range ? source.slice(header.offset + node.range[0], header.offset + node.range[1]) : "<missing>";
			return `${file}: ${field}: ${value}: ${problem.message}`;
		}),
	);
	return problems.length > 0
		? Effect.fail(new BadRequest({ message: `Cannot migrate Board; no files changed.\n${problems.join("\n")}` }))
		: Effect.succeed(documents);
}
