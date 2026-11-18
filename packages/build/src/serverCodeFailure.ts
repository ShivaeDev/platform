import { Effect, Option, Path } from "effect";
import { type Owner, ownerOf } from "#ownerOf.ts";

const displayed = Effect.fn("Build.displayed")(function* (id: string, root: string, owners: Map<string, Option.Option<Owner>>) {
	const path = yield* Path.Path;
	const relative = path.relative(root, id);
	if (path.isAbsolute(id) && !relative.startsWith("..") && !relative.split(path.sep).includes("node_modules")) {
		return relative;
	}
	const owner = yield* ownerOf(id, owners);
	return Option.match(owner, {
		onNone: () => id.replace(/^__vite-browser-external:/u, ""),
		onSome: ({ directory, name }) => `${name}/${path.relative(directory, id)}`,
	});
});

export const serverCodeFailure = Effect.fn("Build.serverCodeFailure")(function* (
	chain: readonly string[],
	reason: string,
	root: string,
	owners: Map<string, Option.Option<Owner>>,
) {
	const shown = yield* Effect.forEach(chain, (each) => displayed(each, root, owners));
	return [
		`Server code reached the browser bundle: ${shown.at(-1)} is ${reason}. The import chain from the client entry:`,
		...shown.map((each, index) => (index === 0 ? `  ${each}` : `  → ${each}`)),
		"The browser reaches a defined module through its generated client in src/generated and imports no server code.",
	].join("\n");
});
