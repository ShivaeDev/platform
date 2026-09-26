import { Browser, type BrowserWindow, type IFetchInterceptor } from "happy-dom";
import type { RunningBoard } from "./board.ts";

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

const ERROR_PAGE = "<p>An error page from a proxy</p>";

export interface MermaidControl {
	readonly calls: Array<string>;
	readonly configs: Array<{ readonly themeVariables: { readonly darkMode: boolean } }>;
	gate: Promise<void>;
}

export interface PageRequests {
	count: number;
	answered: number;
	gate: Promise<void>;
	failWith: number | "network" | undefined;
}

export interface LiveStream {
	readonly emit: (name: string) => void;
	readonly drop: () => void;
	readonly connect: () => void;
	readonly close: () => void;
}

export interface OpenPage {
	readonly window: BrowserWindow;
	readonly document: BrowserWindow["document"];
	readonly mermaid: MermaidControl;
	readonly mermaidRequests: ReadonlyArray<string>;
	readonly pageRequests: PageRequests;
	readonly streams: ReadonlyArray<LiveStream>;
	readonly prefer: (scheme: "light" | "dark") => void;
	readonly close: () => Promise<void>;
}

const eventNames = (buffer: string): { readonly names: ReadonlyArray<string>; readonly rest: string } => {
	const blocks = buffer.split("\n\n");
	const rest = blocks.pop() ?? "";
	return { names: blocks.map((block) => /^event: (.*)$/m.exec(block)?.[1] ?? "message"), rest };
};

const eventSourceOver = (window: BrowserWindow, streams: Array<LiveStream>) =>
	class ServerEvents extends window.EventTarget implements LiveStream {
		readonly url: string;
		#controller = new AbortController();

		constructor(url: string) {
			super();
			this.url = new URL(url, window.location.href).href;
			streams.push(this);
			this.connect();
		}

		connect() {
			this.#controller = new AbortController();
			void this.#read(this.#controller.signal).catch(() => undefined);
		}

		emit(name: string) {
			this.dispatchEvent(new window.Event(name));
		}

		drop() {
			this.#controller.abort();
			this.dispatchEvent(new window.Event("error"));
		}

		close() {
			this.#controller.abort();
		}

		async #read(signal: AbortSignal) {
			const body = (await fetch(this.url, { signal })).body;
			const reader = body?.pipeThrough(new TextDecoderStream()).getReader();
			let buffer = "";
			for (let chunk = await reader?.read(); chunk !== undefined && !chunk.done; chunk = await reader?.read()) {
				const { names, rest } = eventNames(buffer + chunk.value);
				buffer = rest;
				for (const name of names) {
					this.dispatchEvent(new window.Event(name));
				}
			}
		}
	};

const answer = async (pageRequests: PageRequests, window: BrowserWindow) => {
	pageRequests.count += 1;
	await pageRequests.gate;
	if (pageRequests.failWith === "network") {
		throw new TypeError("Failed to fetch");
	}
	return pageRequests.failWith === undefined
		? undefined
		: new window.Response(ERROR_PAGE, { status: pageRequests.failWith, headers: { "content-type": "text/html" } });
};

const interceptor = (path: string, pageRequests: PageRequests, mermaidRequests: Array<string>): IFetchInterceptor => ({
	beforeAsyncRequest: async ({ request, window }) => {
		const requested = new URL(request.url).pathname;
		if (requested === path) {
			return answer(pageRequests, window);
		}
		if (!requested.startsWith("/_board/mermaid/")) {
			return undefined;
		}
		mermaidRequests.push(request.url);
		return new window.Response(MERMAID_STUB, { headers: { "content-type": "text/javascript" } });
	},
	afterAsyncResponse: async ({ request }) => {
		if (new URL(request.url).pathname === path) {
			pageRequests.answered += 1;
		}
		return undefined;
	},
});

export const openPage = async (board: RunningBoard, path = "/", beforeScripts = async () => {}): Promise<OpenPage> => {
	const mermaidRequests: Array<string> = [];
	const pageRequests: PageRequests = { count: 0, answered: 0, gate: Promise.resolve(), failWith: undefined };
	const streams: Array<LiveStream> = [];
	const browser = new Browser({
		settings: {
			enableJavaScriptEvaluation: true,
			suppressInsecureJavaScriptEnvironmentWarning: true,
			fetch: { interceptor: interceptor(path, pageRequests, mermaidRequests) },
		},
	});
	const page = browser.newPage();
	const window = page.mainFrame.window;
	const mermaid: MermaidControl = { calls: [], configs: [], gate: Promise.resolve() };
	Object.assign(window, { mermaidStub: mermaid, EventSource: eventSourceOver(window, streams) });
	page.url = `${board.url}${path}`;
	const html = await (await fetch(`${board.url}${path}`)).text();
	await beforeScripts();
	page.content = html;
	const close = async () => {
		for (const stream of streams) {
			stream.close();
		}
		await browser.close();
	};
	const prefer = (scheme: "light" | "dark") => {
		browser.settings.device.prefersColorScheme = scheme;
		window.dispatchEvent(new window.Event("resize"));
	};
	return { window, document: window.document, mermaid, mermaidRequests, pageRequests, streams, prefer, close };
};

export const held = (): { readonly gate: Promise<void>; readonly release: () => void } => {
	const { promise, resolve } = Promise.withResolvers<void>();
	return { gate: promise, release: () => resolve() };
};
