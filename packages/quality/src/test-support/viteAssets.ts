import type { SeedFile } from "#testing/adapters/tree.ts";

export const viteAssets: readonly SeedFile[] = [
	{ content: '{"compilerOptions":{"module":"ESNext","moduleResolution":"Bundler"},"include":["src"]}', path: "tsconfig.json" },
	{
		content: JSON.stringify({
			exports: {
				"./reader/*.wasm": "./dist/reader/*.wasm",
				"./reader/reader.wasm": "./dist/reader/reader.wasm",
				"./worker.js": "./dist/worker.js",
			},
			name: "@demo/assets",
			version: "1.0.0",
		}),
		path: "node_modules/@demo/assets/package.json",
	},
	{ content: "wasm asset", path: "node_modules/@demo/assets/dist/reader/reader.wasm" },
	{ content: "export const worker = true;", path: "node_modules/@demo/assets/dist/worker.js" },
	{ content: "private asset", path: "node_modules/@demo/assets/dist/private.wasm" },
	{ content: "relative asset", path: "src/reader.wasm" },
];
