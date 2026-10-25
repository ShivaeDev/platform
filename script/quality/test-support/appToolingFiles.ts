import { fileURLToPath } from "node:url";

export const starterModules = fileURLToPath(new URL("../../../examples/starter/node_modules", import.meta.url));

export const toolingFiles: Readonly<Record<string, string>> = {
	"index.html": '<html><body>Application shell<script type="module" src="/src/main.tsx"></script></body></html>',
	"package.json": '{ "type": "module", "imports": { "#*": "./src/*" } }',
	"serve.mjs": `import { createServer } from "vite";
const server = await createServer({ server: { port: 0 } });
await server.listen();
console.log("VITE_URL=" + server.resolvedUrls.local[0]);`,
	"src/application.dom.spec.ts": `import { expect } from "vitest";
import { storyKit } from "@shivaedev/test-story/server/storyKit.ts";
const screen = storyKit({ name: "application screen", stages: [], create: () => document.createElement("button"), verbs: (button) => ({
click: () => { button.onclick = () => { button.textContent = "Clicked"; }; button.click(); }, text: () => button.textContent,
}) });
screen.it("runs DOM stories", [], function* ({ click, text }) { click(); expect(text()).toBe("Clicked"); });`,
	"src/application.slow.spec.ts": 'throw new Error("Slow stories must be selected explicitly");',
	"src/main.tsx": 'import { createRoot } from "react-dom/client"; createRoot(document.body).render(<p>Application</p>);',
	"tsconfig.json": '{ "extends": "@shivaedev/quality/tsconfig/app.json", "include": ["src/main.tsx"] }',
	"vite.config.ts": `import { appViteConfig } from "@shivaedev/quality/appViteConfig.ts";
export default appViteConfig([{ name: "application", transformIndexHtml: (html: string) => html.replace("Application shell", "Application plugin") }], ["source"]);`,
	"vitest.config.ts": 'import { appTestConfig } from "@shivaedev/quality/appTestConfig.ts"; export default appTestConfig(["source"]);',
};
