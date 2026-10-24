import { Link } from "@tanstack/react-router";
import { Option } from "effect";
import * as AsyncResult from "effect/reactivity/AsyncResult";
import { useAction } from "@shivaedev/effect-react/client/resultState.ts";
import { Button } from "#client/ui/button.tsx";
import type { AuthActions } from "./auth.ts";

export function Home({ auth }: { readonly auth: AuthActions }) {
	const signOut = useAction(auth.signOut);
	return (
		<main className="mx-auto max-w-2xl space-y-4 px-4 py-12">
			<h1 className="font-semibold text-3xl">Your app</h1>
			<Link to="/sign-in">Sign in</Link>
			<Button disabled={signOut.pending} onClick={() => signOut.dispatch()} variant="outline">
				Sign out
			</Button>
			{Option.isSome(AsyncResult.error(signOut.result)) && <p role="alert">Could not sign out. Try again.</p>}
		</main>
	);
}
