# @shivaedev/platform

The ShivaeDev framework for Effect applications in one dependency. Platform holds no code of its own: it depends on every runtime piece of the framework, and an application imports each piece by its own name.

## Why you want this

An Effect application built on this framework uses many packages that are released and tested together. Listing them one by one and keeping their versions aligned is busywork that drifts. Depend on platform instead and import what you need from the piece that owns it:

```ts
import { appHost } from "@shivaedev/server/appHost.ts";
import { Authenticated } from "@shivaedev/identity/middleware.ts";
import { NotFound } from "@shivaedev/errors/taxonomy.ts";
```

## Using it

### How the shell works

Platform is a dependency shell. Its manifest lists every runtime piece at the versions released together, and it exports nothing but its `package.json`. An application never imports `@shivaedev/platform/...`; it imports a module from the piece that owns it, by that piece's name, exactly as a library does. One upgrade of platform moves every piece at once.

pnpm installs a dependency's dependencies out of an application's reach unless the application hoists them, so an application on platform hoists the `@shivaedev` scope. Without that setting the pieces are installed, but type checking cannot resolve an import of any piece the application does not list itself.

### Set up an application

Add `@shivaedev/platform` to `dependencies`, add `@shivaedev/test-story` and `@shivaedev/quality` to `devDependencies`, and hoist the scope in `pnpm-workspace.yaml`:

```yaml
publicHoistPattern: ["@shivaedev/*"]
```

The application lists no piece beside platform, and no test piece beside `@shivaedev/test-story`, which brings `@shivaedev/test` and `@shivaedev/test-sql`. Quality checks this: `manifests/application` asks for the hoist setting and names any duplicate entry to remove, and `imports/manifest` and Biome's undeclared-dependency check accept an application's imports of the pieces its entry points bring. `create-app` writes this setup for a new application and `create-app update` brings an existing one to it.

Platform forwards the pieces' peer dependencies as optional peers. Install the ones the pieces you use need, such as `effect`, `react`, `react-dom`, `pg`, `pg-boss` and `better-auth`; the starter lists them.

Only applications depend on platform. A library, or an application published for others to run with `pnpm dlx` or a global install, cannot rely on the hoist setting of the workspace that installs it, so it declares each piece it imports directly.

### Which package owns which job

The framework guide's [application path](https://github.com/ShivaeDev/platform/blob/main/docs/framework/README.md#the-application-path) names the package that owns each job and where its boundary lies. Platform depends on every runtime package there; the test packages reach an application through its `@shivaedev/test-story` development dependency.
