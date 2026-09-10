// Per-game localStorage leaderboards.
//
// Every game owns its own key: dsh.minigames.records.<gameId> — so switching
// games never mixes scores. Entries are { value, meta, at }:
//   value — the ranked number (score, length, elapsed seconds, …)
//   meta  — human-readable detail shown after the value
//   at    — timestamp, used to highlight the round that just ended
const RECORDS_PREFIX = 'dsh.minigames.records.v1.'

function recordsKey(gameId) {
  return RECORDS_PREFIX + String(gameId)
}

export function loadRecords(gameId) {
  try {
    if (typeof localStorage === 'undefined') return []
    const raw = localStorage.getItem(recordsKey(gameId))
    if (!raw) return []
    const arr = JSON.parse(raw)
    if (!Array.isArray(arr)) return []
    return arr.filter(r => r && typeof r.value === 'number').slice(0, 10)
  } catch (err) {
    return []
  }
}

export function saveRecords(gameId, list) {
  try {
    if (typeof localStorage === 'undefined') return
    localStorage.setItem(recordsKey(gameId), JSON.stringify(list.slice(0, 10)))
  } catch (err) {}
}

export function pushRecord(gameId, entry) {
  const list = loadRecords(gameId)
  list.unshift(entry)
  const trimmed = list.slice(0, 10)
  saveRecords(gameId, trimmed)
  return trimmed
}

export function pushRecords(gameId, entry) {
  return pushRecord(gameId, entry)
}

// order: 'desc' (higher is better, default) | 'asc' (lower is better, e.g. time)
export function sortRecords(list, order) {
  return list.slice().sort((a, b) => {
    const diff = (b.value || 0) - (a.value || 0)
    const ranked = order === 'asc' ? -diff : diff
    return ranked || ((b.at || 0) - (a.at || 0))
  })
}

export function nowTs() {
  return typeof Date !== 'undefined' ? Date.now() : 0
}
