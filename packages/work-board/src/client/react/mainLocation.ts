export interface MainLocation {
	readonly file: string;
	readonly projection: string;
	readonly route: string;
	readonly status: number;
	readonly title?: string | undefined;
	readonly view: string;
}

export const NOT_FOUND_PROJECTION = "not-found";

export const emptyMainLocation: MainLocation = { file: "", projection: "document", route: "", status: 200, view: "" };
