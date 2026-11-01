import { createServer } from "node:http";
import { NodeHttpServer } from "@effect/platform-node";
import { Effect } from "effect";
import { HttpServerRequest, HttpServerResponse } from "effect/http";
import * as NetAddress from "effect/net/NetAddress";
import { RpcSerialization } from "effect/rpc";

export interface LiveAppOptions {
	blockAdd: boolean;
	brokenNavigation: boolean;
	nonRpc: "none" | "Resync" | "Changed" | "notes.list";
}

export const liveApp = Effect.fnUntraced(function* (options: LiveAppOptions) {
	const server = yield* NodeHttpServer.make(createServer, { host: "127.0.0.1", port: 0 });
	yield* server.serve(
		Effect.gen(function* () {
			const request = yield* HttpServerRequest.HttpServerRequest;
			if (request.url !== "/rpc") {
				return HttpServerResponse.html(appHtml(options));
			}
			const socket = yield* request.upgrade;
			const reader = yield* socket.reader;
			const writer = yield* socket.writer;
			const parser = RpcSerialization.ndjson.makeUnsafe();
			function hint(tag: "Resync" | "Changed") {
				const value = tag === "Resync" ? { _tag: tag } : { _tag: tag, keys: [] };
				const encoded = parser.encode(options.nonRpc === tag ? value : { _tag: "Chunk", requestId: "live", values: [value] });
				return encoded === undefined ? Effect.void : writer.write(encoded);
			}
			yield* reader.pull.pipe(
				Effect.flatMap((frames) =>
					Effect.forEach(frames, (frame) => {
						const message = typeof frame === "string" ? frame : Buffer.from(frame).toString();
						if (message === "created") {
							return hint("Changed");
						}
						if (message === "subscribe") {
							return hint("Resync");
						}
						return Effect.void;
					}),
				),
				Effect.forever,
				Effect.catchReason("SocketError", "SocketCloseError", () => Effect.void),
			);
			return HttpServerResponse.empty();
		}),
	);
	if (!NetAddress.isInetAddress(server.address)) {
		throw new Error("Expected a TCP listener");
	}
	return `http://127.0.0.1:${server.address.port}`;
});

function appHtml(options: LiveAppOptions) {
	return `<html><body>
<h1>Notes</h1>
<form><label>New note<input name="title"></label><button ${options.blockAdd ? "disabled" : ""}>Add note</button></form>
<button id="signout">Sign out</button><div id="notes"></div>
<script>
const socket = new WebSocket(location.origin.replace(/^http/, 'ws') + '/rpc');
socket.onopen = () => socket.send('subscribe');
document.querySelector('input').oninput = () => window.drafted();
document.querySelector('form').onsubmit = event => {
  event.preventDefault();
  localStorage.setItem('note', document.querySelector('input').value);
};
function signedOut() {
  socket.close();
  document.body.innerHTML = '<h1>Sign in</h1><div role="alert">Sign in to view your notes.</div>';
}
document.querySelector('#signout').onclick = () => {
  localStorage.setItem('signed-out', 'yes');
  signedOut();
};
window.onstorage = event => {
  if (event.key === 'signed-out') signedOut();
  if (event.key === 'note') socket.send('created');
};
socket.onmessage = event => {
  if (!event.data.includes('"Changed"')) return;
  socket.send(JSON.stringify(${options.nonRpc === "notes.list" ? "{ message: 'notes.list' }" : "{ _tag: 'Request', id: 'list', tag: 'notes.list', payload: {}, headers: [] }"}) + '\\n');
  const link = document.createElement('a');
  link.href = '/note';
  link.textContent = localStorage.getItem('note');
  document.querySelector('#notes').append(link);
};
</script></body></html>`;
}
