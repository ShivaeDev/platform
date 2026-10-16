# One command to a running app

New applications should start with the same small, working example that Platform maintains and tests. A newcomer should not need to understand workspace dependency protocols or repository-specific configuration before seeing their application run.

The command writes only into an absent or empty folder, names the application, generates its local environment, installs its dependencies, formats its files and prints the development steps. The starter owns the application code, database preparation and published-version manifest; packaging takes a snapshot of that source. This package owns the generated app’s README and agent guidance. Maintainer documentation and verification metadata stay in the repository. Generated application code is a package artifact, never a second checked-in copy.

Preserving existing user files takes precedence over convenience. Real generated-app checks against npm and PostgreSQL take precedence over fast scaffolding tests. Keep the interface to the folder argument and normal CLI help and version output. Production configuration, deployment and releases belong to the application and maintainer.
