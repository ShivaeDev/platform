import { TransformStream, type TransformStreamDefaultController } from "node:stream/web";
import { RpcSerialization } from "effect/rpc";
import type { FromServerEncoded } from "effect/rpc/RpcMessage";
import type { BrowserWindow } from "happy-dom";

export class RpcStream {
	blocked = false;
	#controller: TransformStreamDefaultController<Uint8Array> | undefined;
	#id: string | number = 0;
	close() {
		this.#controller?.terminate();
	}
	connect() {
		this.blocked = false;
	}
	drop() {
		this.blocked = true;
		this.#controller?.error(new Error("The subscription transport was dropped"));
	}
	emit(name: string) {
		if (name !== "change") {
			throw new Error(`Unsupported live event ${name}`);
		}
		if (!this.#controller) {
			throw new Error("The RPC stream has no connected reader");
		}
		const message: FromServerEncoded = { _tag: "Chunk", requestId: this.#id, values: [{ _tag: "Resync" }] };
		const encoded = RpcSerialization.ndjson.makeUnsafe().encode(message);
		if (encoded !== undefined) {
			this.#controller.enqueue(typeof encoded === "string" ? new TextEncoder().encode(encoded) : encoded);
		}
	}
	response(window: BrowserWindow, response: InstanceType<BrowserWindow["Response"]>, id: string | number) {
		const source = response.body;
		if (source === null) {
			return response;
		}
		this.#id = id;
		const relay = new TransformStream<Uint8Array, Uint8Array>({
			start: (controller) => {
				this.#controller = controller;
			},
		});
		void source.pipeTo(relay.writable).catch(() => undefined);
		return new window.Response(relay.readable, { headers: response.headers, status: response.status });
	}
}
