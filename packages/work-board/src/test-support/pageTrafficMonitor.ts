export interface Answer {
	readonly tag: string;
	readonly value: unknown;
}

export class PageTraffic {
	readonly answers: Answer[] = [];
	readonly outstanding = new Map<string | number, string>();
	readonly released = new Set<string>();
	answersAtSettle = 0;
	requests = 0;
	#wake = Promise.withResolvers<void>();

	sent(data: string) {
		for (const message of lines(data)) {
			if (
				message._tag === "Request"
				&& (typeof message.id === "string" || typeof message.id === "number")
				&& typeof message.tag === "string"
				&& !message.tag.endsWith(".$changes")
			) {
				this.outstanding.set(message.id, message.tag);
				this.requests += 1;
			}
		}
		this.#bump();
	}

	received(data: string) {
		for (const message of lines(data)) {
			const tag =
				typeof message.requestId === "string" || typeof message.requestId === "number" ? this.outstanding.get(message.requestId) : undefined;
			if (message._tag === "Exit" && tag !== undefined && (typeof message.requestId === "string" || typeof message.requestId === "number")) {
				this.outstanding.delete(message.requestId);
				this.answers.push({ tag, value: message.exit?.value });
			}
		}
		this.#bump();
	}

	changed() {
		this.#bump();
	}

	activity() {
		return this.#wake.promise;
	}

	#bump() {
		this.#wake.resolve();
		this.#wake = Promise.withResolvers<void>();
	}
}

interface Message {
	readonly _tag?: unknown;
	readonly exit?: { readonly value?: unknown };
	readonly id?: unknown;
	readonly requestId?: unknown;
	readonly tag?: unknown;
}

function lines(data: string): readonly Message[] {
	return data
		.trim()
		.split("\n")
		.filter((line) => line !== "")
		.map((line): Message => JSON.parse(line));
}
