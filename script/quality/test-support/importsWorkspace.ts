import { repositoryHas } from "./ruleKit.ts";

const exports = {
	"./*.ts": { default: "./dist/*.js", source: "./src/*.ts", types: "./dist/*.d.ts" },
	"./internal.ts": null,
	"./internal/*.ts": null,
};

export const importsWorkspace = repositoryHas(
	{ content: '{"private":true,"workspaces":["modules/*"]}', path: "package.json" },
	{
		content: JSON.stringify({ exports, imports: { "#*.ts": "./src/*.ts" }, name: "@example/orders", type: "module" }),
		path: "modules/orders/package.json",
	},
	{ content: JSON.stringify({ exports, name: "@example/prices", type: "module" }), path: "modules/prices/package.json" },
	{ content: "export const orders = {};", path: "modules/orders/src/orders.ts" },
	{ content: "export const internal = {};", path: "modules/orders/src/internal.ts" },
	{ content: "export const secret = {};", path: "modules/orders/src/internal/secret.ts" },
	{ content: "export const prices = {};", path: "modules/prices/src/prices.ts" },
	{ content: "export const internal = {};", path: "modules/prices/src/internal.ts" },
);
