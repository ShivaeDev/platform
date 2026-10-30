import type * as Atom from "effect/reactivity/Atom";
import { useSignOut } from "#client/useSignOut.ts";

export function SignOutControls({ action }: { readonly action: Atom.AtomResultFn<void, void> }) {
	const signOut = useSignOut(action, { signIn: "/sign-in" });
	return (
		<button onClick={signOut.dispatch} type="button">
			Sign out
		</button>
	);
}
