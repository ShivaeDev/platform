import type { BrowserWindow } from "happy-dom";

type Response = InstanceType<BrowserWindow["Response"]>;

// happy-dom always sends its own Accept-Encoding, so a page cannot ask the Board for identity bodies. It closes its decompressing body stream on the decoder's "end" event without checking whether the
// reader already cancelled, so a client that stops reading after its last message throws an uncaught
// ERR_INVALID_STATE. Reading the encoded body to its end first keeps that close legal. A read that a closing
// page aborts hands back the original response, which already carries that abort for the page to see.
export async function decodedBody(response: Response | null, window: BrowserWindow) {
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
