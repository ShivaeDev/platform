import { Effect } from "effect";

export function narrated<TArgs extends readonly unknown[], A, E, R>(
	tell: (line: string) => void,
	line: string,
	act: (...args: TArgs) => Effect.Effect<A, E, R>,
) {
	return (...args: TArgs) =>
		Effect.suspend(() => {
			tell(line);
			return act(...args);
		});
}
