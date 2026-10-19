import { Buffer } from "node:buffer";
import type { BrowserWindow, IFetchInterceptor } from "happy-dom";
import { THEME_ROUTE } from "#server/page/initialTheme.ts";
import type { RawResponse } from "./board.ts";
import type { PageRequests } from "./browser.ts";
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

type Response = InstanceType<BrowserWindow["Response"]>;

// happy-dom closes its decompressing body stream on the decoder's "end" event without checking whether the
// reader already cancelled, so a client that stops reading after its last message throws an uncaught
// ERR_INVALID_STATE. Reading the encoded body to its end first keeps that close legal. A read that a closing
// page aborts hands back the original response, which already carries that abort for the page to see.
async function decodedBody(response: Response | null, window: BrowserWindow) {
	if (response === null || response.headers.get("content-encoding") === null) {
		return undefined;
	}
	const body = await response.arrayBuffer().catch(() => undefined);
	if (body === undefined) {
		return undefined;
	}
	const headers = new window.Headers(response.headers);
	headers.delete("content-encoding");
	headers.delete("content-length");
	return new window.Response(body, { headers, status: response.status, statusText: response.statusText });
}

export function pageFetch({
	path,
	pageRequests,
	mermaidRequests,
	streams,
	theme,
}: {
	readonly path: string;
	readonly pageRequests: PageRequests;
	readonly mermaidRequests: string[];
	readonly streams: RpcStream[];
	readonly theme: RawResponse;
}): IFetchInterceptor {
	return {
		afterAsyncResponse: async ({ request, response, window }) => {
			const decoded = await decodedBody(response, window);
			if (new URL(request.url).pathname === "/_board/react.js") {
				const root = window.document.documentElement;
				pageRequests.beforeReact = {
					dark: root.classList.contains("dark"),
					scheme: root.dataset.scheme,
					sidebar: root.dataset.sidebar,
					skeleton: window.document.querySelector("[data-board-react-root] > [data-board-skeleton] header") !== null,
				};
			}
			return (await rpcAfter(request, decoded ?? response, window, path, pageRequests, streams)) ?? decoded;
		},
		beforeAsyncRequest: async ({ request, window }) => {
			const requested = new URL(request.url).pathname;
			const native = await rpcBefore(request, window, path, pageRequests, streams);
			if (native !== undefined) {
				return native;
			}
			if (!requested.startsWith("/_board/mermaid/")) {
				return undefined;
			}
			mermaidRequests.push(request.url);
			return new window.Response(MERMAID_STUB, { headers: { "content-type": "text/javascript" } });
		},
		beforeSyncRequest: ({ request, window }) =>
			new URL(request.url).pathname === THEME_ROUTE
				? {
						body: Buffer.from(theme.body),
						headers: new window.Headers({ "content-type": "text/javascript" }),
						ok: theme.status === 200,
						redirected: false,
						status: theme.status,
						statusText: "OK",
						url: request.url,
					}
				: undefined,
	};
}
