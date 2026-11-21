// Modules the generator refuses before it reads an operation: one outside src, one not exported and two in one file.
export const MISPLACED_MODULES: Readonly<Record<string, string>> = {
	"lib/outside.ts": `import { defineModule } from "@shivaedev/contract/defineModule.ts";

export const Outside = defineModule({ name: "outside", operations: [], wire: {} });
`,
	"src/modules/refused/hidden.ts": `import { defineModule } from "@shivaedev/contract/defineModule.ts";

const Hidden = defineModule({ name: "hidden", operations: [], wire: {} });
`,
	"src/modules/refused/twice.ts": `import { defineModule } from "@shivaedev/contract/defineModule.ts";

export const First = defineModule({ name: "first", operations: [], wire: {} });
export const Second = defineModule({ name: "second", operations: [], wire: {} });
`,
};
