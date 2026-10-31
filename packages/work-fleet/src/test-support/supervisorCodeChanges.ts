import { mkdirSync, readFileSync, renameSync, symlinkSync, writeFileSync } from "node:fs";
import { dirname, join } from "node:path";

export function supervisorCodeChanges(daemonFile: string, root: string) {
	const directory = dirname(daemonFile);
	const response = join(directory, "fixtureStatus.ts");
	const merged = Array.from({ length: 15 }, (_, index) => join(directory, `fixtureMerge${index}.ts`));
	for (const file of merged) {
		writeFileSync(file, 'export const revision = "original";\n');
	}
	const imports = merged.map((file) => `import "./${file.slice(directory.length + 1)}";`).join("\n");
	writeFileSync(response, `${imports}\nexport const status = 204;\n`);
	writeFileSync(
		daemonFile,
		`import { status } from "./fixtureStatus.ts";\n${readFileSync(daemonFile, "utf8").replace('HttpStatus.fromLiteral("NoContent")', "status")}`,
	);
	const unrelated = join(root, "unloaded/src");
	mkdirSync(unrelated, { recursive: true });
	writeFileSync(join(unrelated, "code.ts"), 'export const revision = "original";\n');
	writeFileSync(join(unrelated, "../package.json"), JSON.stringify({ name: "@shivaedev/unloaded-fixture" }));
	const manifest = join(root, "fleet/package.json");
	const pkg = JSON.parse(readFileSync(manifest, "utf8"));
	pkg.dependencies["@shivaedev/unloaded-fixture"] = "0.0.0";
	writeFileSync(manifest, JSON.stringify(pkg));
	const link = join(root, "fleet/node_modules/@shivaedev/unloaded-fixture");
	symlinkSync(dirname(unrelated), link);
	return {
		burst: () => {
			for (const file of merged) {
				writeFileSync(`${file}.next`, 'export const revision = "merged";\n');
				renameSync(`${file}.next`, file);
			}
			writeFileSync(response, readFileSync(response, "utf8").replace("204", "201"));
		},
		loaded: () => writeFileSync(response, readFileSync(response, "utf8").replace("204", "201")),
		unrelated: () => {
			writeFileSync(join(unrelated, "code.ts"), 'export const revision = "changed";\n');
			symlinkSync(dirname(unrelated), `${link}.next`);
			renameSync(`${link}.next`, link);
		},
	};
}
