import { anything, defineConfig, external, fence, folders, modules, packages } from "../src/index.ts";

const undemonstrated = fence("game-keeps-out-of-cms").because("The game ships to players.").from(folders("game/src")).mayNotImport(packages("cms"));

const demonstrated = undemonstrated.demonstratedBy({ illegal: ["game/src/a.ts", "cms/src/b.ts"], legal: ["game/src/a.ts", external("effect")] });

export const configured = defineConfig({ rules: { "imports/fences": { options: { fences: [demonstrated] } } } });

// @ts-expect-error A fence takes effect only once its examples demonstrate it.
export const unproven = defineConfig({ rules: { "imports/fences": { options: { fences: [undemonstrated] } } } });

// @ts-expect-error An example starts in a file of the repository, not in an external module.
undemonstrated.demonstratedBy({ illegal: [external("effect"), "cms/src/b.ts"], legal: ["game/src/a.ts", "cms/src/b.ts"] });

// @ts-expect-error An example is an import, so it has at least two steps.
undemonstrated.demonstratedBy({ illegal: ["game/src/a.ts"], legal: ["game/src/a.ts", "cms/src/b.ts"] });

// @ts-expect-error A fence names its reason before what it fences.
fence("no-reason").from(folders("game/src"));

fence("reach")
	.because("Shown with a transitive target.")
	.from(folders("game/src"))
	.mayNotReach(anything.except(modules("effect")));
