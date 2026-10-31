import { posix } from "node:path";
import { defineRule, type Finding } from "#rule.ts";
import { parse } from "./parse.ts";
import { secondNames } from "./secondNames.ts";

const BARREL_FILE = /^index\.tsx?$/u;

export const noBarrel = defineRule({
	check: ({ sources }) =>
		sources.flatMap((file) => {
			const findings: Finding[] = BARREL_FILE.test(posix.basename(file.path))
				? [{ file: file.path, message: "index.ts and index.tsx modules are banned. Name the module after its purpose and import it directly." }]
				: [];
			const source = parse(file);
			if (source !== undefined) {
				for (const { modules, node } of secondNames(source)) {
					findings.push({
						file: file.path,
						line: source.getLineAndCharacterOfPosition(node.getStart(source)).line + 1,
						message: `An exported alias, facade or forwarding function gives an import a second name.\nHelp: Import directly from ${modules.map((module) => `"${module}"`).join(", ")} and remove the second name.`,
					});
				}
			}
			return findings;
		}),
	description:
		"Name modules after their purpose; import values from their defining module instead of exporting aliases, facades or unchanged forwarding calls.",
	id: "structure/no-barrel",
});
