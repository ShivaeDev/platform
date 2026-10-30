import { Cause, Option, Predicate } from "effect";

export function describeValue(value: unknown): string {
	if (typeof value === "string") {
		return value;
	}
	if (value instanceof Error || (Predicate.hasProperty(value, "_tag") && Predicate.hasProperty(value, "message"))) {
		const name = Predicate.hasProperty(value, "_tag") ? String(value._tag) : value.name;
		return `${name}: ${String(value.message)}`;
	}
	if (Predicate.hasProperty(value, "_tag")) {
		return String(value._tag);
	}
	return String(value);
}

export function causeWords<E>(cause: Option.Option<Cause.Cause<E>>): string {
	return Option.match(cause, {
		onNone: () => "none",
		onSome: (found) => {
			if (Cause.hasDies(found)) {
				return `died with ${describeValue(Cause.squash(found))}`;
			}
			return Option.match(Cause.findErrorOption(found), {
				onNone: () => (Cause.hasInterrupts(found) ? "interrupted" : "empty"),
				onSome: (error) => `failed with ${describeValue(error)}`,
			});
		},
	});
}

export function dataWords<A>(data: Option.Option<A>): string {
	return Option.match(data, { onNone: () => "none", onSome: (value) => `present: ${describeValue(value)}` });
}

export function statusWords({ pending, refreshing }: { readonly pending: boolean; readonly refreshing: boolean }): string {
	if (refreshing) {
		return "refreshing";
	}
	return pending ? "loading" : "settled";
}

export function timesWords(count: number): string {
	return ["never", "once", "twice"][count] ?? `${count} times`;
}

export function countWords(count: number): string {
	return ["none", "one", "two"][count] ?? String(count);
}
