import { Browser, type BrowserWindow, type IFetchInterceptor } from "happy-dom";
import { type RunningBoard, rawGet } from "./board.ts";
import type { RpcStream } from "./RpcStream.ts";
import { rpcAfter, rpcBefore } from "./rpcFetch.ts";

const MERMAID_STUB = `
const control = globalThis.mermaidStub;
export default {
  initialize: (config) => control.configs.push(config),
  render: async (id, source) => {
    control.calls.push(source);
    const dark = control.configs.at(-1).themeVariables.darkMode;
    await control.gate;
    if (source.includes("broken")) throw new Error("Parse error in the diagram");
    return { svg: '<svg data-source="' + encodeURIComponent(source.trim()) + '" data-dark="' + dark + '"></svg>' };
  },
};
`;

export interface MermaidControl {
	readonly calls: string[];
	readonly configs: Array<{ readonly themeVariables: { readonly darkMode: boolean } }>;
	gate: Promise<void>;
}

export interface PageRequests {
	answered: number;
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

function interceptor(path: string, pageRequests: PageRequests, mermaidRequests: string[], streams: RpcStream[]): IFetchInterceptor {
	return {
		afterAsyncResponse: async ({ request, response, window }) => {
			const native = await rpcAfter(request, response, window, path, pageRequests, streams);
			if (native !== undefined) {
				return native;
			}
			if (new URL(request.url).pathname === path) {
				pageRequests.answered += 1;
			}
			return undefined;
		},
		beforeAsyncRequest: async ({ request, window }) => {
			const requested = new URL(request.url).pathname;
			const native = await rpcBefore(request, window, path, pageRequests, streams);
			if (native !== undefined) {
				return native;
			}
			if (requested === path) {
				return rpcBefore(request, window, path, pageRequests, streams, true);
			}
			if (!requested.startsWith("/_board/mermaid/")) {
				return undefined;
			}
			mermaidRequests.push(request.url);
			return new window.Response(MERMAID_STUB, { headers: { "content-type": "text/javascript" } });
		},
	};
}

export async function openPage(
	board: RunningBoard,
	path = "/",
	beforeScripts: (window: BrowserWindow) => void | Promise<void> = async (): Promise<void> => undefined,
): Promise<OpenPage> {
	const mermaidRequests: string[] = [];
	const pageRequests: PageRequests = { answered: 0, count: 0, failWith: undefined, gate: Promise.resolve() };
	const streams: RpcStream[] = [];
	const browser = new Browser({
		settings: {
			enableJavaScriptEvaluation: true,
			fetch: { interceptor: interceptor(path, pageRequests, mermaidRequests, streams) },
			suppressInsecureJavaScriptEnvironmentWarning: true,
		},
	});
	const page = browser.newPage();
	const window = page.mainFrame.window;
	const mermaid: MermaidControl = { calls: [], configs: [], gate: Promise.resolve() };
	Object.assign(window, { mermaidStub: mermaid });
	page.url = `${board.url}${path}`;
	const html = (await rawGet(board, path)).body;
	await beforeScripts(window);
	page.content = html;
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
}

export function held(): { readonly gate: Promise<void>; readonly release: () => void } {
	const { promise, resolve } = Promise.withResolvers<void>();
	return { gate: promise, release: () => resolve() };
}
