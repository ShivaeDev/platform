import { RpcSerialization } from "effect/rpc";
import type { BrowserContext } from "playwright";

export interface LiveAppOptions {
	blockAdd: boolean;
	brokenNavigation: boolean;
	nonRpc: "none" | "Resync" | "Changed" | "notes.list";
}

export async function liveApp(context: BrowserContext, options: LiveAppOptions, drafted: () => void) {
	await context.exposeBinding("drafted", drafted);
	await context.route("http://browser-check.test/**", (route) =>
		options.brokenNavigation ? route.abort() : route.fulfill({ body: appHtml(options), contentType: "text/html" }),
	);
	await context.routeWebSocket("ws://browser-check.test/rpc", (socket) => {
		const parser = RpcSerialization.ndjson.makeUnsafe();
		function hint(tag: "Resync" | "Changed") {
			const value = tag === "Resync" ? { _tag: tag } : { _tag: tag, keys: [] };
			const encoded = parser.encode(options.nonRpc === tag ? value : { _tag: "Chunk", requestId: "live", values: [value] });
			if (encoded !== undefined) {
				socket.send(typeof encoded === "string" ? encoded : Buffer.from(encoded));
			}
		}
		socket.onMessage((message) => {
			if (String(message) === "created") {
				hint("Changed");
			}
			if (String(message) === "subscribe") {
				hint("Resync");
			}
		});
	});
}

function appHtml(options: LiveAppOptions) {
	return `<html><body>
<h1>Notes</h1>
<form><label>New note<input name="title"></label><button ${options.blockAdd ? "disabled" : ""}>Add note</button></form>
<button id="signout">Sign out</button><div id="notes"></div>
<script>
const socket = new WebSocket('ws://browser-check.test/rpc');
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
