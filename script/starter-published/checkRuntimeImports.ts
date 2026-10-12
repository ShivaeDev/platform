import { join } from "node:path";
import { Effect, FileSystem } from "effect";
import { command } from "#package-check/io.ts";
import { type DocumentedImport, packageName } from "./imports.ts";

export const checkRuntimeImports = Effect.fn("Published.checkRuntimeImports")(function* (
	consumer: string,
	entries: readonly DocumentedImport[],
	versions: Readonly<Record<string, string>>,
) {
	const fs = yield* FileSystem.FileSystem;
	const probes = entries.filter((entry) => !entry.typeOnly);
	const tests = probes.map((entry) => {
		const name = packageName(entry.specifier);
		const label = `${name}@${versions[name]}: import ${entry.name ?? "*"} from ${entry.specifier} (${entry.source})`;
		return `test(${JSON.stringify(label)}, async () => {
  const entry = await import(${JSON.stringify(entry.specifier)});
  ${entry.name === undefined ? "" : `if (!(${JSON.stringify(entry.name)} in entry)) throw new Error(${JSON.stringify(`Missing published export: ${label}`)});`}
});`;
	});
	yield* fs.writeFileString(join(consumer, "documented-runtime.test.ts"), `import { test } from "vitest";\n${tests.join("\n")}\n`);
	yield* Effect.log(yield* command(consumer, "pnpm", ["exec", "vitest", "run", "documented-runtime.test.ts"]));
});
