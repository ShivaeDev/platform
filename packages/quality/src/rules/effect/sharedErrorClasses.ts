import { Effect } from "effect";
import { type SharedErrorCatalog, sharedErrorCatalog } from "#adapters/sharedErrorCatalog.ts";
import { defineRule, type Finding, type SourceFile } from "#rule.ts";
import { taggedClasses } from "#rules/effect/errorTags.ts";
import { parse } from "#rules/parse.ts";
import { findingAt } from "#rules/stories/syntax.ts";

function declaresErrors(source: SourceFile): boolean {
	return /\bclass\b/u.test(source.text) && /TaggedError|_tag|@shivaedev\/errors/u.test(source.text);
}

function findings(file: SourceFile, catalog: SharedErrorCatalog): readonly Finding[] {
	const source = parse(file);
	if (source === undefined) {
		return [];
	}
	const classes = taggedClasses(source, (binding, member) =>
		catalog.tagOf(binding.module, binding.imported === "*" ? (member ?? "") : binding.imported),
	);
	return classes.flatMap(({ name, node, tag }) => {
		const shared = catalog.byTag.get(tag);
		return shared === undefined || (shared.path === file.path && shared.name === name)
			? []
			: [
					findingAt(
						source,
						node,
						`Tagged error ${name ?? "anonymous class"} reuses the shared tag "${tag}". Import ${shared.name} from "${shared.specifier}" and use that class instead.`,
					),
				];
	});
}

export const sharedErrorClasses = defineRule({
	check: (inputs) =>
		Effect.gen(function* () {
			const sources = inputs.sources.filter(declaresErrors);
			if (sources.length === 0) {
				return [];
			}
			const catalog = yield* sharedErrorCatalog({ ...inputs, sources });
			return catalog.byTag.size === 0 ? [] : sources.flatMap((file) => findings(file, catalog));
		}),
	description:
		"A tagged error with a tag exported by @shivaedev/errors must use that exported class. Import the shared class instead of declaring another error or subclass with its tag.",
	id: "effect/shared-error-classes",
	registrable: false,
});
