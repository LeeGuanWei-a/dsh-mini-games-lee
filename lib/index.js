// =============================================================================
// dsh-mini-games — host-resident plugin, NODE half
// -----------------------------------------------------------------------------
// Pure UI plugin: this node half carries no host-side behavior. The empty
// apply exists so the row activates in the host composition / Loader; the
// browser half ships via exports["./client"] and is discovered through the
// package.json `dsh.client` declaration (same pattern as @deepseek-ai
// dsh-client-ui-*). See ../README.md.
// =============================================================================

export function apply() {}
