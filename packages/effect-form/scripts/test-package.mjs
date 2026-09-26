import { execFileSync } from "node:child_process";
import { mkdtemp, readFile, rm, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";

const packageRoot = dirname(dirname(fileURLToPath(import.meta.url)));
const repositoryRoot = dirname(dirname(packageRoot));
const temporaryDirectory = await mkdtemp(join(tmpdir(), "effect-form-consumer-"));
const tarball = join(temporaryDirectory, "effect-form.tgz");

const execute = (command, arguments_, cwd = temporaryDirectory) =>
	execFileSync(command, arguments_, {
		cwd,
		encoding: "utf8",
		stdio: ["ignore", "pipe", "inherit"],
	});

try {
	execute("pnpm", ["pack", "--out", tarball], packageRoot);

	const contents = execute("tar", ["-tzf", tarball]).trim().split("\n");
	for (const required of [
		"package/dist/index.js",
		"package/dist/react.js",
		"package/dist/react.d.ts",
		"package/dist/index.d.ts",
		"package/dist/index.d.ts.map",
		"package/src/index.ts",
		"package/CHANGELOG.md",
		"package/README.md",
	]) {
		if (!contents.includes(required)) {
			throw new Error(`Packed package is missing ${required}`);
		}
	}
	if (contents.some((path) => path.startsWith("package/test/"))) {
		throw new Error("Packed package unexpectedly contains its test suite");
	}

	const manifest = JSON.parse(await readFile(join(packageRoot, "package.json"), "utf8"));
	await writeFile(
		join(temporaryDirectory, "package.json"),
		`${JSON.stringify(
			{
				name: "effect-form-consumer",
				private: true,
				type: "module",
				dependencies: {
					"@effect/atom-react": manifest.devDependencies["@effect/atom-react"],
					"@types/react": manifest.devDependencies["@types/react"],
					react: manifest.devDependencies.react,
					"@shivaedev/effect-form": `file:${tarball}`,
					"@types/node": manifest.devDependencies["@types/node"],
					effect: manifest.devDependencies.effect,
					vitest: manifest.devDependencies.vitest,
				},
			},
			null,
			2,
		)}\n`,
	);
	await writeFile(join(temporaryDirectory, "pnpm-workspace.yaml"), await readFile(join(repositoryRoot, "pnpm-workspace.yaml"), "utf8"));
	await writeFile(
		join(temporaryDirectory, "tsconfig.json"),
		`${JSON.stringify(
			{
				compilerOptions: {
					lib: ["ESNext"],
					module: "ESNext",
					moduleResolution: "Bundler",
					noEmit: true,
					skipLibCheck: true,
					strict: true,
					target: "ESNext",
					types: ["node"],
					verbatimModuleSyntax: true,
				},
				include: ["index.ts"],
			},
			null,
			2,
		)}\n`,
	);
	await writeFile(
		join(temporaryDirectory, "tsconfig.nodenext.json"),
		`${JSON.stringify(
			{
				extends: "./tsconfig.json",
				compilerOptions: {
					module: "NodeNext",
					moduleResolution: "NodeNext",
				},
			},
			null,
			2,
		)}\n`,
	);
	await writeFile(
		join(temporaryDirectory, "index.ts"),
		`import { Effect, Layer, Schema } from "effect";
import * as Atom from "effect/unstable/reactivity/Atom";
import { make, type Form } from "@shivaedev/effect-form";
import { useField, useSubmit } from "@shivaedev/effect-form/react";
const schema = Schema.Struct({ count: Schema.NumberFromString });
const form = make(schema, {
  initialValues: { count: "1" },
  runtime: Atom.runtime(Layer.empty),
  onSubmit: (values) => {
    const count: number = values.count;
    return Effect.succeed(count);
  },
});
const encoded: string = form.field("count").value;
void encoded;
void (form satisfies Form<typeof schema.fields, number, never, never>);
// @ts-expect-error Field names come from the schema.
form.field("missing");
// @ts-expect-error Editing accepts encoded values.
form.change("count", 1);
function Consumer() {
  const field = useField(form, "count");
  const value: string = field.value;
  const submit = useSubmit(form);
  const run: () => void = submit.run;
  void value;
  void run;
  // @ts-expect-error React field values retain the encoded type.
  field.onChange(12);
  return null;
}
void Consumer;
`,
	);

	execute("pnpm", ["install", "--ignore-scripts", "--frozen-lockfile=false", "--store-dir", join(repositoryRoot, ".pnpm-store")]);
	execute(join(packageRoot, "node_modules/.bin/tsc"), ["--project", "tsconfig.json"]);
	execute(join(packageRoot, "node_modules/.bin/tsc"), ["--project", "tsconfig.nodenext.json"]);
	execute(join(packageRoot, "node_modules/.bin/tsc6"), ["--project", "tsconfig.json"]);
	execute("node", ["--input-type=module", "--eval", "await import('@shivaedev/effect-form'); await import('@shivaedev/effect-form/react')"]);
} finally {
	await rm(temporaryDirectory, { force: true, recursive: true });
}
