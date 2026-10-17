### Fixed

- `makePostgresTestLayer` keeps its administration connection alive until fixture cleanup, so an idle period cannot leave database finalizers waiting for a new pooled connection during scope closure.
