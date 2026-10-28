import { Buffer } from "node:buffer";
import * as HttpStatus from "effect/http/HttpStatus";
import type { IFetchInterceptor } from "happy-dom";
import { THEME_ROUTE } from "#server/page/initialTheme.ts";
import type { RawResponse } from "./board.ts";
import type { PageRequests } from "./browser.ts";
import { decodedBody } from "./decodedBody.ts";
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

export function pageFetch({
	chunkRequests,
	path,
	pageRequests,
	mermaidRequests,
	streams,
	theme,
}: {
	readonly chunkRequests: string[];
	readonly path: string;
	readonly pageRequests: PageRequests;
	readonly mermaidRequests: string[];
	readonly streams: RpcStream[];
	readonly theme: RawResponse;
}): IFetchInterceptor {
	return {
		afterAsyncResponse: async ({ request, response, window }) => {
			const decoded = await decodedBody(response, window);
			return (await rpcAfter(request, decoded ?? response, window, path, pageRequests, streams)) ?? decoded;
		},
		beforeAsyncRequest: async ({ request, window }) => {
			const requested = new URL(request.url).pathname;
			const native = await rpcBefore(request, window, path, pageRequests, streams);
			if (native !== undefined) {
				return native;
			}
			if (requested.startsWith("/_board/react-assets/") && requested.endsWith(".js")) {
				chunkRequests.push(requested);
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
						ok: theme.status === HttpStatus.fromLiteral("OK"),
						redirected: false,
						status: theme.status,
						statusText: "OK",
						url: request.url,
					}
				: undefined,
	};
}
