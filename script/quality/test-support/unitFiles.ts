import type { SeedFile } from "#quality-fixtures/tree.ts";

export const ordersPackage: SeedFile = { content: '{"name":"@example/orders","type":"module"}', path: "package.json" };

export const pureOrders: SeedFile = {
	content: "export function total(amounts: readonly number[]): number {\n\treturn amounts.reduce((sum, amount) => sum + amount, 0);\n}\n",
	path: "src/orders.ts",
};

export const orders: SeedFile = {
	content: `import { writeFileSync } from "node:fs";\n${pureOrders.content}export function save(amounts: readonly number[]): void {\n\twriteFileSync("orders.json", JSON.stringify(amounts));\n}\n`,
	path: "src/orders.ts",
};

export function unitSpec(content: string): SeedFile {
	return { content, path: "src/orders.unit.test.ts" };
}
