// =============================================================================
// dsh-mini-games-lee — HOST half
// -----------------------------------------------------------------------------
// Pure UI plugin: this node half carries no host-side behavior at all.
//
// The empty `apply` is load-bearing. It is what the Loader activates for the
// row this bundle's cordis.patch.yml inserts, and it is what `plugin_manager`
// reports on. The browser half is a separate artifact: the host finds it
// through this package's manifest — `dsh.client.platform` opts the package in
// and `exports["./client"]` names the bundle (dist/client.js) — then serves it
// to the page as a module-table entry. Neither half imports the other.
//
// See ../README.md.
// =============================================================================

export function apply() {}
