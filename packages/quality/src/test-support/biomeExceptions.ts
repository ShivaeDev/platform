import { writeFileSync } from "node:fs";
import { join } from "node:path";
import { formatTree } from "./qualityTree.ts";

export function parserWarning(root: string): string {
	const declared =
		'{ options: { declared: [{ includes: ["src/parse.ts"], reason: "The legacy parser returns untyped JSON.", rule: "lint/suspicious/noExplicitAny" }] } }';
	writeFileSync(
		join(root, "quality.config.ts"),
		`export default {\n\trules: {\n\t\t"suppressions/biome-overrides": ${declared},\n\t},\n\tsources: ["src"],\n};\n`,
	);
	return formatTree(root);
}

export function uncoveredParser(root: string): string {
	writeFileSync(join(root, "src/other.ts"), "export function other(text: string): any {\n\treturn JSON.parse(text);\n}\n");
	return root;
}
