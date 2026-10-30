import { outcomes } from "@shivaedev/test-story/server/outcomes.ts";
import { updates } from "#test/updates.ts";
import { AS_RELEASED, createdWith010, published010, starterAt010, starterAt020 } from "#test/updateTraits.ts";

updates.it(
	"update removes chart.tsx, tooltip.tsx and the recharts dependency that the 0.2.0 starter dropped",
	[
		starterAt010("ships chart.tsx, tooltip.tsx and the recharts dependency", {
			"package.json": (manifest) => manifest.replace('"dependencies": {', '"dependencies": {\n\t\t"recharts": "catalog:",'),
			"src/client/ui/chart.tsx": "export const Chart = () => null;\n",
			"src/client/ui/tooltip.tsx": "export const Tooltip = () => null;\n",
		}),
		createdWith010(),
		published010,
		starterAt020("drops them", { "package.json": AS_RELEASED, "src/client/ui/chart.tsx": null, "src/client/ui/tooltip.tsx": null }),
	],
	function* ({ dependsOn, exists, update }) {
		yield* outcomes({
			"depends on recharts": [dependsOn("recharts"), true],
			"src/client/ui/chart.tsx": [exists("src/client/ui/chart.tsx"), true],
			"src/client/ui/tooltip.tsx": [exists("src/client/ui/tooltip.tsx"), true],
		});

		yield* update();

		yield* outcomes({
			"depends on recharts": [dependsOn("recharts"), false],
			"src/client/ui/chart.tsx": [exists("src/client/ui/chart.tsx"), false],
			"src/client/ui/tooltip.tsx": [exists("src/client/ui/tooltip.tsx"), false],
		});
	},
);
