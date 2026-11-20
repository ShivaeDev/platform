import { defineRule } from "#rule.ts";
import { parse } from "#rules/parse.ts";
import { nestedDefinitions } from "#rules/react/nestedDefinitions.ts";

const COMPONENT_REPAIR =
	"React sees a new component type on every call of the function around it, so the subtree remounts and loses its state. Move it to module level and pass what it reads as props.";

const HOOK_REPAIR = "Every call of the function around it makes a new hook. Move it to module level and pass what it reads as arguments.";

export const nestedComponents = defineRule({
	check: ({ sources }) =>
		sources.flatMap((file) => {
			const source = parse(file);
			return source === undefined
				? []
				: nestedDefinitions(source).map(({ hook, name }) => ({
						file: file.path,
						line: source.getLineAndCharacterOfPosition(name.getStart(source)).line + 1,
						message: hook
							? `Hook ${name.text} is defined inside another function. ${HOOK_REPAIR}`
							: `Component ${name.text} is defined inside another function. ${COMPONENT_REPAIR}`,
					}));
		}),
	description: `Components and hooks are defined at module level. A component is a PascalCase function or class that returns JSX (directly, in a branch or an array, through a const that holds it, from a callback such as the one given to .map, or through createElement), or one that the same function renders as an element, passes as a JSX attribute value or gives to createElement; a hook is a function named use followed by a capital letter or digit. ${COMPONENT_REPAIR} A PascalCase key whose function returns no JSX, such as a failure handler keyed by an error tag, is not a component.`,
	id: "react/nested-components",
	registrable: false,
});
