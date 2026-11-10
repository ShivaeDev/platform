import { Effect, Queue } from "effect";
import { build, createServer, type InlineConfig, type Logger, type ViteDevServer } from "vite";
import { buildPlugin } from "#adapters/vitePlugin.ts";

// What reaches the browser over Vite's HMR socket: a page reload and the file whose change caused it, or the error overlay.
export type BrowserMessage = { readonly overlay: string } | { readonly reloadAfter: string };

function ignore() {
	return undefined;
}

function terminalOf(lines: string[]): Logger {
	return {
		clearScreen: ignore,
		error: (message) => {
			lines.push(message);
		},
		hasErrorLogged: () => false,
		hasWarned: false,
		info: ignore,
		warn: ignore,
		warnOnce: ignore,
	};
}

function configFor(root: string, terminal: string[], serverOnly: readonly string[]): InlineConfig {
	return {
		build: { minify: false, write: false },
		clearScreen: false,
		configFile: false,
		customLogger: terminalOf(terminal),
		logLevel: "warn",
		// Dependency discovery reloads the page once it has optimized what the first request found, which no story is about.
		optimizeDeps: { include: [], noDiscovery: true },
		plugins: [buildPlugin({ serverOnly })],
		resolve: { conditions: ["@shivaedev/source", "module", "browser", "development|production"] },
		root,
		server: { fs: { strict: false }, host: "127.0.0.1", port: 0 },
	};
}

function attempt<A>(start: () => Promise<A>) {
	return Effect.tryPromise({ catch: (cause) => ({ failed: cause instanceof Error ? cause.message : String(cause) }), try: start });
}

export const viteBuild = Effect.fn("BuildStory.viteBuild")(function* (root: string, serverOnly: readonly string[]) {
	const terminal: string[] = [];
	return yield* attempt(() => build(configFor(root, terminal, serverOnly))).pipe(
		Effect.as("built" as const),
		Effect.catch((failure) => Effect.succeed(failure)),
	);
});

function messageOf(data: unknown): BrowserMessage | undefined {
	const payload: { type?: string; err?: { message?: string }; triggeredBy?: string } = JSON.parse(String(data));
	if (payload.type === "full-reload") {
		return { reloadAfter: payload.triggeredBy ?? "" };
	}
	return payload.type === "error" ? { overlay: payload.err?.message ?? "" } : undefined;
}

export interface DevServer {
	readonly browser: Queue.Queue<BrowserMessage>;
	readonly server: ViteDevServer;
	readonly terminal: readonly string[];
	readonly url: string;
}

export const viteDevServer = Effect.fn("BuildStory.viteDevServer")(function* (root: string) {
	const terminal: string[] = [];
	const server = yield* Effect.acquireRelease(
		attempt(() => createServer(configFor(root, terminal, []))),
		(started) => Effect.promise(() => started.close()),
	);
	yield* attempt(() => server.listen());
	const address = server.httpServer?.address();
	const port = typeof address === "object" && address !== null ? address.port : 0;
	const url = `http://127.0.0.1:${port}`;
	const browser = yield* Queue.unbounded<BrowserMessage>();
	yield* Effect.acquireRelease(
		Effect.callback<WebSocket>((resume) => {
			const socket = new WebSocket(`ws://127.0.0.1:${port}/?token=${server.config.webSocketToken}`, "vite-hmr");
			socket.addEventListener("message", ({ data }) => {
				if (String(data).includes('"connected"')) {
					resume(Effect.succeed(socket));
					return;
				}
				const message = messageOf(data);
				if (message !== undefined) {
					Queue.offerUnsafe(browser, message);
				}
			});
		}),
		(socket) => Effect.sync(() => socket.close()),
	);
	const devServer: DevServer = { browser, server, terminal, url };
	return devServer;
});
