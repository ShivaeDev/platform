import { Browser, type BrowserWindow, type IFetchInterceptor } from "happy-dom";
import { type RunningBoard, rawGet } from "./board.ts";

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
	readonly calls: string[];
	readonly configs: Array<{ readonly themeVariables: { readonly darkMode: boolean } }>;
	gate: Promise<void>;
}

export interface PageRequests {
	answered: number;
	count: number;
	failWith: number | "network" | undefined;
	gate: Promise<void>;
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

const eventNames = (buffer: string): { readonly names: readonly string[]; readonly rest: string } => {
	const blocks = buffer.split("\n\n");
	const rest = blocks.pop() ?? "";
	return { names: blocks.map((block) => /^event: (.*)$/mu.exec(block)?.[1] ?? "message"), rest };
};

const eventSourceOver = (window: BrowserWindow, streams: LiveStream[]) =>
	class ServerEvents extends window.EventTarget implements LiveStream {
		readonly url: string;
		#controller = new window.AbortController();

		constructor(url: string) {
			super();
			this.url = new URL(url, window.location.href).href;
			streams.push(this);
			this.connect();
		}

		connect() {
			this.#controller = new window.AbortController();
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

		async #read(signal: InstanceType<BrowserWindow["AbortSignal"]>) {
			const body = (await window.fetch(this.url, { signal })).body;
			const reader = body?.getReader();
			const decoder = new TextDecoder();
			let buffer = "";
			for (let chunk = await reader?.read(); chunk !== undefined && !chunk.done; chunk = await reader?.read()) {
				const { names, rest } = eventNames(buffer + decoder.decode(chunk.value, { stream: true }));
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
		: new window.Response(ERROR_PAGE, { headers: { "content-type": "text/html" }, status: pageRequests.failWith });
};

const interceptor = (path: string, pageRequests: PageRequests, mermaidRequests: string[]): IFetchInterceptor => ({
	afterAsyncResponse: async ({ request }) => {
		if (new URL(request.url).pathname === path) {
			pageRequests.answered += 1;
		}
		return undefined;
	},
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
});

export const openPage = async (
	board: RunningBoard,
	path = "/",
	beforeScripts: (window: BrowserWindow) => void | Promise<void> = async () => {},
): Promise<OpenPage> => {
	const mermaidRequests: string[] = [];
	const pageRequests: PageRequests = { answered: 0, count: 0, failWith: undefined, gate: Promise.resolve() };
	const streams: LiveStream[] = [];
	const browser = new Browser({
		settings: {
			enableJavaScriptEvaluation: true,
			fetch: { interceptor: interceptor(path, pageRequests, mermaidRequests) },
			suppressInsecureJavaScriptEnvironmentWarning: true,
		},
	});
	const page = browser.newPage();
	const window = page.mainFrame.window;
	const mermaid: MermaidControl = { calls: [], configs: [], gate: Promise.resolve() };
	Object.assign(window, { EventSource: eventSourceOver(window, streams), mermaidStub: mermaid });
	page.url = `${board.url}${path}`;
	const html = (await rawGet(board, path)).body;
	await beforeScripts(window);
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
	return { close, document: window.document, mermaid, mermaidRequests, pageRequests, prefer, streams, window };
};

export const held = (): { readonly gate: Promise<void>; readonly release: () => void } => {
	const { promise, resolve } = Promise.withResolvers<void>();
	return { gate: promise, release: () => resolve() };
};
