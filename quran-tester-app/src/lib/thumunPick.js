function shuffleArray(values) {
  const arr = [...values]
  for (let i = arr.length - 1; i > 0; i -= 1) {
    const j = Math.floor(Math.random() * (i + 1))
    ;[arr[i], arr[j]] = [arr[j], arr[i]]
  }
  return arr
}

/** Reset the pick deck (call when filters/mode change). */
export function resetPickDeck(deckRef) {
  deckRef.current = []
}

/**
 * Fair random pick: cycle through all items once before any repeat.
 * Only skips consecutive duplicate when rebuilding the deck.
 */
export function pickNextThumun(items, deckRef, excludeId = null) {
  if (!items?.length) return null

  const byId = new Map(items.map(t => [t.id, t]))
  let deck = (deckRef.current || []).filter(id => byId.has(id))

  if (!deck.length) {
    let ids = items.map(t => t.id)
    if (excludeId != null && ids.length > 1) {
      ids = ids.filter(id => id !== excludeId)
    }
    deck = shuffleArray(ids)
  }

  const nextId = deck.shift()
  deckRef.current = deck
  return byId.get(nextId) || null
}

/** Remove a thumun from the remaining deck after manual selection. */
export function consumeFromPickDeck(deckRef, thumunId) {
  if (!thumunId) return
  deckRef.current = (deckRef.current || []).filter(id => id !== thumunId)
}
