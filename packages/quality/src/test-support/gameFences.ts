import { fence } from "#imports/fence.ts";
import { anyOf, external, folders, modules, packages, scopes } from "#imports/fences/selectors.ts";

export const gameFences = {
	cmsStaysOffDisk: fence("cms-stays-off-disk")
		.because("The CMS stores through the database, never the file system.")
		.from(packages("cms"))
		.mayNotImport(modules("node:fs"))
		.demonstratedBy({ illegal: ["packages/cms/src/a.ts", external("fs/promises")], legal: ["packages/cms/src/a.ts", external("node:path")] }),
	coreNeedsNoAuth: fence("core-needs-no-auth")
		.because("The core runs without the auth packages installed.")
		.from(folders("packages/core/src"))
		.mayNotImport(anyOf(modules("better-auth", "hast", "@demo/kit"), scopes("@trpc")))
		.demonstratedBy({ illegal: ["packages/core/src/a.ts", external("better-auth/client")], legal: ["packages/core/src/a.ts", external("effect")] }),
	gameKeepsOutOfCms: fence("game-keeps-out-of-cms")
		.because("The game ships to players; the CMS is for contributors.")
		.from(folders("packages/game/src"))
		.mayNotImport(packages("cms"))
		.demonstratedBy({
			illegal: ["packages/game/src/a.ts", "packages/cms/src/b.ts"],
			legal: ["packages/game/src/a.ts", "packages/simulation/src/b.ts"],
		}),
	gameNeverReachesCms: fence("game-never-reaches-cms")
		.because("Nothing the game loads may pull the CMS in.")
		.from(folders("packages/game/src"))
		.mayNotReach(packages("@demo/cms"))
		.demonstratedBy({
			illegal: ["packages/game/src/a.ts", "packages/simulation/src/b.ts", "packages/cms/src/c.ts"],
			legal: ["packages/game/src/a.ts", "packages/simulation/src/b.ts"],
		}),
	gameSpeaksCards: fence("game-speaks-cards")
		.because("The game uses the card words of the vocabulary only.")
		.from(folders("packages/game/src"))
		.mayImportOnly("cards", "session")
		.of(packages("vocabulary"))
		.demonstratedBy({
			illegal: ["packages/game/src/a.ts", "packages/vocabulary/src/voyage/b.ts"],
			legal: ["packages/game/src/a.ts", "packages/vocabulary/src/cards.ts"],
		}),
};
