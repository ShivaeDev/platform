import { ReadableStream, type ReadableStreamDefaultController, type ReadableStreamDefaultReader } from "node:stream/web";
import { RpcSerialization } from "effect/unstable/rpc";
import type { FromServerEncoded } from "effect/unstable/rpc/RpcMessage";
import type { BrowserWindow } from "happy-dom";

export class RpcStream {
	blocked = false;
	#reader: ReadableStreamDefaultReader<Uint8Array> | undefined;
	#controller: ReadableStreamDefaultController<Uint8Array> | undefined;
	#fail: ((error: Error) => void) | undefined;
	#id: string | number = 0;
	close() {
		void this.#reader?.cancel().catch(() => undefined);
	}
	connect() {
		this.blocked = false;
	}
	drop() {
		this.blocked = true;
		this.#fail?.(new Error("The subscription transport was dropped"));
		this.close();
	}
	emit(name: string) {
		if (name !== "change") {
			return;
		}
		const message: FromServerEncoded = { _tag: "Chunk", requestId: this.#id, values: [{ _tag: "Resync" }] };
		const encoded = RpcSerialization.ndjson.makeUnsafe().encode(message);
		if (encoded !== undefined) {
			this.#controller?.enqueue(typeof encoded === "string" ? new TextEncoder().encode(encoded) : encoded);
		}
	}
	response(window: BrowserWindow, response: InstanceType<BrowserWindow["Response"]>, id: string | number) {
		const source = response.body;
		if (source === null) {
			return response;
		}
		const reader = source.getReader();
		this.#reader = reader;
		this.#id = id;
		let ended = false;
		const pump = async () => {
			try {
				for (;;) {
					const next = await reader.read();
					if (ended) {
						return;
					}
					if (next.done) {
						ended = true;
						this.#controller?.close();
						return;
					}
					this.#controller?.enqueue(next.value);
				}
			} catch (error) {
				if (!ended) {
					ended = true;
					this.#controller?.error(error);
				}
			}
		};
		const body = new ReadableStream<Uint8Array>({
			cancel: () => {
				ended = true;
				return reader.cancel();
			},
			start: (controller) => {
				this.#controller = controller;
				this.#fail = (error) => {
					if (!ended) {
						ended = true;
						controller.error(error);
					}
				};

				void pump();
			},
		});
		return new window.Response(body, { headers: response.headers, status: response.status });
	}
}
