import { readFileSync, writeFileSync } from "node:fs";

export function stubbornSupervisorChild(file: string, name: "daemon" | "board") {
	const source = readFileSync(file, "utf8");
	const install = `process.removeAllListeners("SIGTERM"); process.on("SIGTERM", () => console.log("${name} ignored SIGTERM"));`;
	writeFileSync(
		file,
		name === "daemon"
			? source.replace("NodeRuntime.runMain(main);", `NodeRuntime.runMain(main); if (process.argv[2] === "serve") { ${install} }`)
			: source
					.replace("import { NodeRuntime", 'import process from "node:process";\nimport { NodeRuntime')
					.replace("NodeRuntime.runMain);", `NodeRuntime.runMain); ${install}`),
	);
}
