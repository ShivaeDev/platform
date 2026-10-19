import { Clock, Effect, type Scope } from "effect";
import { Browser, type BrowserWindow } from "happy-dom";
import { THEME_ROUTE } from "#server/page/initialTheme.ts";
import { type RunningBoard, rawGet } from "./board.ts";
import { pageFetch } from "./pageFetch.ts";
import type { RpcStream } from "./RpcStream.ts";

export interface MermaidControl {
	readonly calls: string[];
	readonly configs: Array<{ readonly themeVariables: { readonly darkMode: boolean } }>;
	gate: Promise<void>;
}

export interface PageRequests {
	answered: number;
	beforeReact?: { readonly scheme: string | undefined; readonly dark: boolean; readonly sidebar: string | undefined; readonly skeleton: boolean };
	count: number;
	failWith: number | "network" | undefined;
	gate: Promise<void>;
	responseGate?: Promise<void> | undefined;
}

export interface LiveStream {
	readonly close: () => void;
	readonly connect: () => void;
	readonly drop: () => void;
	readonly emit: (name: string) => void;
}

export interface OpenPage {
	readonly close: () => Promise<void>;
	readonly document: BrowserWindow["document"];
	readonly mermaid: MermaidControl;
	readonly mermaidRequests: readonly string[];
	readonly pageRequests: PageRequests;
	readonly prefer: (scheme: "light" | "dark") => void;
	readonly streams: readonly LiveStream[];
	readonly window: BrowserWindow;
}

export const openPage = Effect.fn("Test.openPage")(function* (
	board: RunningBoard,
	path = "/",
	beforeScripts: (
		window: BrowserWindow,
		mermaid: MermaidControl,
	) => void | Promise<void> | Effect.Effect<void, unknown, Scope.Scope> = async (): Promise<void> => undefined,
) {
	const mermaidRequests: string[] = [];
	const pageRequests: PageRequests = { answered: 0, count: 0, failWith: undefined, gate: Promise.resolve() };
	const streams: RpcStream[] = [];
	const response = yield* rawGet(board, path);
	const resolved = new URL(response.location ?? path, board.url);
	const activePath = resolved.pathname + resolved.search;
	const html = response.location ? (yield* rawGet(board, activePath)).body : response.body;
	const theme = yield* rawGet(board, THEME_ROUTE);
	const browser = new Browser({
		settings: {
			enableJavaScriptEvaluation: true,
			fetch: { interceptor: pageFetch({ mermaidRequests, pageRequests, path: activePath, streams, theme }) },
			suppressInsecureJavaScriptEnvironmentWarning: true,
		},
	});
	const page = browser.newPage();
	const window = page.mainFrame.window;
	const mermaid: MermaidControl = { calls: [], configs: [], gate: Promise.resolve() };
	Object.assign(window, { mermaidStub: mermaid });
	page.url = resolved.href;
	yield* Effect.addFinalizer(() => Effect.promise(close));
	const prepared = beforeScripts(window, mermaid);
	if (Effect.isEffect(prepared)) {
		yield* prepared;
	} else {
		yield* Effect.promise(async () => prepared);
	}
	page.content = html;
	const deadline = (yield* Clock.currentTimeMillis) + 5000;
	while (
		!(
			window.document.documentElement.dataset.boardReady
			&& window.document.getElementById("doc")
			&& window.document.querySelector("#primary-navigation[data-inbox-count]")
		)
	) {
		if ((yield* Clock.currentTimeMillis) >= deadline) {
			throw new Error(
				`The React shell did not initialize: ${page.virtualConsolePrinter.readAsString()} · ${window.document.getElementById("doc")?.textContent}`,
			);
		}
		yield* Effect.sleep("10 millis");
	}

	async function close() {
		window.dispatchEvent(new window.Event("pagehide"));
		for (const stream of streams) {
			stream.close();
		}
		await browser.close();
	}
	function prefer(scheme: "light" | "dark") {
		browser.settings.device.prefersColorScheme = scheme;
		window.dispatchEvent(new window.Event("resize"));
	}
	return { close, document: window.document, mermaid, mermaidRequests, pageRequests, prefer, streams, window };
});

export function held(): { readonly gate: Promise<void>; readonly release: () => void } {
	const { promise, resolve } = Promise.withResolvers<void>();
	return { gate: promise, release: () => resolve() };
}
