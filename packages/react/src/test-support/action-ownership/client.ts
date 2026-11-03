import { Deferred, Effect, Layer } from "effect";
import * as Atom from "effect/reactivity/Atom";

export type CommandName = "Launch" | "Resume" | "Inspect";
export type Mode = "native" | "runtime";

export function ownershipClient() {
	const sent: { readonly command: CommandName; readonly input: string }[] = [];
	function command(name: CommandName) {
		const arrived = Deferred.makeUnsafe<void>();
		const finished = Deferred.makeUnsafe<void>();
		const answer = Deferred.makeUnsafe<string, string>();
		function run(input: string) {
			return Effect.gen(function* () {
				sent.push({ command: name, input });
				yield* Deferred.succeed(arrived, undefined);
				return yield* Deferred.await(answer);
			}).pipe(Effect.ensuring(Deferred.succeed(finished, undefined)));
		}
		return { answer, arrived, atom: Atom.fn<string>()(run), finished, run };
	}
	return {
		commands: { Inspect: command("Inspect"), Launch: command("Launch"), Resume: command("Resume") },
		runtime: Atom.runtime(Layer.empty),
		sent,
	};
}

export type OwnershipClient = ReturnType<typeof ownershipClient>;
