export interface UpOptions {
	readonly boardDir: string;
	readonly boardPort: number;
	readonly config?: string | undefined;
	readonly daemonPort: number;
	readonly home?: string | undefined;
	readonly maintainer: string;
	readonly responses: boolean;
}

export function processArguments(name: "daemon" | "board", options: UpOptions) {
	return name === "daemon"
		? ["serve", options.boardDir, "--port", String(options.daemonPort), ...(options.config === undefined ? [] : ["--config", options.config])]
		: [
				options.boardDir,
				"--port",
				String(options.boardPort),
				"--fleet-port",
				String(options.daemonPort),
				"--maintainer",
				options.maintainer,
				...(options.home === undefined ? [] : ["--home", options.home]),
				...(options.responses ? ["--responses"] : []),
			];
}
