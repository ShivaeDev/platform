export interface SignInLocation {
	readonly href: string;
	readonly state?: object | undefined;
}

export function signInSearch(location: SignInLocation): { readonly returnTo?: string } {
	const state = location.state;
	return state !== undefined && "__platformSignOut" in state && state.__platformSignOut === true ? {} : { returnTo: location.href };
}
