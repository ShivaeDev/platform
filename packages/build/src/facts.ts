// What the type checker says about a module, as plain data: the adapter reads it from a program, the core decides from it.

export interface ImportFact {
	readonly local: string;
	// The imported name: an export name, "default" or "*".
	readonly name: string;
	readonly specifier: string;
	// The file the import resolves to, so a specifier written in another package can be rewritten for the project.
	readonly target: string | undefined;
	readonly typeOnly: boolean;
	readonly writtenIn: string;
}

export type CodePart = string | ImportFact;

export interface DeclaredClass {
	readonly className: string;
	readonly exportName: string | undefined;
	readonly file: string;
}

export type Primitive = "BigInt" | "Boolean" | "Date" | "DateTimeUtc" | "Null" | "Number" | "String" | "Undefined" | "Void";

export interface Field {
	readonly form: WireForm;
	readonly mutable: boolean;
	readonly name: string;
	readonly optional: boolean;
}

export type WireForm =
	| { readonly form: "primitive"; readonly primitive: Primitive }
	| { readonly form: "literals"; readonly values: readonly (string | number)[] }
	| { readonly form: "array"; readonly item: WireForm; readonly mutable: boolean }
	| { readonly form: "tuple"; readonly elements: readonly WireForm[]; readonly mutable: boolean }
	| { readonly form: "struct"; readonly fields: readonly Field[] }
	| { readonly form: "record"; readonly value: WireForm; readonly mutable: boolean }
	| { readonly form: "union"; readonly members: readonly WireForm[] }
	| { readonly form: "nullOr"; readonly inner: WireForm }
	| { readonly form: "option"; readonly inner: WireForm }
	| { readonly form: "class"; readonly declared: DeclaredClass };

export type Failure =
	| { readonly kind: "retryable" }
	| { readonly kind: "class"; readonly declared: DeclaredClass; readonly tag: string }
	| { readonly kind: "unexported"; readonly tag: string; readonly text: string }
	| { readonly kind: "untagged"; readonly text: string };

export interface OperationFacts {
	readonly failures: readonly Failure[];
	readonly invalidates: readonly CodePart[] | undefined;
	readonly kind: "command" | "query";
	readonly name: string;
	readonly payload: readonly CodePart[] | undefined;
	readonly reads: readonly CodePart[] | undefined;
	readonly readsCollections: readonly CodePart[] | undefined;
	readonly success: WireForm | undefined;
}

export interface ModuleFacts {
	readonly exportName: string;
	readonly file: string;
	readonly keyScope: readonly CodePart[] | undefined;
	readonly middleware: readonly CodePart[] | undefined;
	readonly name: string;
	readonly operations: readonly OperationFacts[];
	readonly refusals: readonly string[];
	readonly subject: readonly CodePart[] | undefined;
}
