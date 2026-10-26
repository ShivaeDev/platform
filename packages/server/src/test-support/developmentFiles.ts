export const developmentFiles: Readonly<Record<string, string>> = {
	"package.json": JSON.stringify({
		imports: { "#runtime": { application: "./selected.mjs", default: "./unselected.mjs" } },
		type: "module",
	}),
	"runner.mjs": `import { runDevelopment } from "@shivaedev/server/development.ts";
runDevelopment({ server: "server.mjs", worker: "worker.mjs", conditions: ["application"] });`,
	"selected.mjs": 'export const label = "application";',
	"unselected.mjs": 'throw new Error("Development did not forward application conditions");',
	"vite.config.ts": `export default { server: { host: "127.0.0.1", port: 0 }, plugins: [{ name: "development-story",
configureServer(server) {
server.middlewares.use("/finish", (_request, response) => { response.end("finished"); setImmediate(() => process.exit(7)); });
server.httpServer.once("listening", () => console.log("APP_READY=vite:" + process.pid + ":http://127.0.0.1:" + server.httpServer.address().port));
} }] };`,
	...Object.fromEntries(
		["server", "worker"].map((kind) => [
			`${kind}.mjs`,
			`import { label } from "#runtime"; console.log("APP_READY=${kind}:" + process.pid + ":" + label); setInterval(() => {}, 1000);`,
		]),
	),
};
