// Single source of truth: this mirrors `version` from package.json.
// Bump it there and the title bar (and any other UI surface)
// will pick it up automatically after a rebuild.

import pkg from "../package.json";

export const VERSION: string = pkg.version;