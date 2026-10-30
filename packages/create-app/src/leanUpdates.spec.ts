import { expect } from "vitest";
import { updates } from "#test/updates.ts";

updates.it("removes unused starter components and their chart dependency from an existing app", [], function* (app) {
	const manifest = app.starterFile("package.json");
	const previous = JSON.parse(manifest);
	app.setVersion("0.1.0");
	app.revise({
		"package.json": `${JSON.stringify({ ...previous, dependencies: { ...previous.dependencies, recharts: "catalog:" } }, null, "\t")}\n`,
		"src/client/ui/chart.tsx": "export const Chart = () => null;\n",
		"src/client/ui/tooltip.tsx": "export const Tooltip = () => null;\n",
	});
	expect((yield* app.create()).status).toBe(0);
	app.publish();
	app.setVersion("0.2.0");
	app.revise({ "package.json": manifest });
	app.removeFromStarter("src/client/ui/chart.tsx");
	app.removeFromStarter("src/client/ui/tooltip.tsx");
	const result = yield* app.update();
	expect(result.status, result.stderr).toBe(0);
	expect(app.exists("src/client/ui/chart.tsx")).toBe(false);
	expect(app.exists("src/client/ui/tooltip.tsx")).toBe(false);
	expect(JSON.parse(app.read("package.json")).dependencies).not.toHaveProperty("recharts");
});
