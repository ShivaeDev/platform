export interface SignInLocation {
	readonly href: string;
	readonly state?: { readonly __platformSignOut?: boolean } | undefined;
}

export function signInSearch(location: SignInLocation): { readonly returnTo?: string } {
	return location.state?.__platformSignOut === true ? {} : { returnTo: location.href };
}
