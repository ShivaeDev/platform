import type { SeedFile } from "#testing/adapters/tree.ts";

export const fakeRepository: readonly SeedFile[] = [
	{
		content: JSON.stringify({ imports: { "#edge": "./src/adapters/mail.ts", "#orders": "./src/orders.ts" }, name: "orders", type: "module" }),
		path: "package.json",
	},
	{
		content:
			'import { defineService } from "@shivaedev/service/adapters/defineService.ts"; export const orders = { total: () => 1 }; export const Orders = defineService({ id: "Orders", initialize: Effect.void, methods: () => orders, requires: [] });',
		path: "src/orders.ts",
	},
	{
		content:
			'import { defineService } from "@shivaedev/service/adapters/defineService.ts"; export const mail = { send: () => 1 }; export const Mail = defineService({ id: "Mail", initialize: Effect.void, methods: () => mail, requires: [] });',
		path: "src/adapters/mail.ts",
	},
	{ content: 'export { Orders, orders } from "./orders.ts";', path: "src/published.ts" },
];

export function fakeSpec(content: string): SeedFile {
	return { content, path: "src/orders.spec.ts" };
}
