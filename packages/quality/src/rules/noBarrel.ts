import { posix } from "node:path";
import { defineRule } from "#rule.ts";

const BARREL_FILE = /^index\.tsx?$/u;

export const noBarrel = defineRule({
	check: ({ sources }) =>
		sources
			.filter((file) => BARREL_FILE.test(posix.basename(file.path)))
			.map((file) => ({
				file: file.path,
				message: "index.ts and index.tsx modules are banned. Name the module after its purpose and import it directly.",
			})),
	description: "Name TypeScript modules after their purpose instead of index.ts or index.tsx.",
	id: "structure/no-barrel",
});
