export type Endpoint =
	| { readonly kind: "file"; readonly path: string }
	| { readonly kind: "external"; readonly package: string; readonly specifier: string };
