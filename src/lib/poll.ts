/**
 * `setInterval` that sits out while the tab is hidden and runs once as soon
 * as it is shown again. An admin tab left open in the background was polling
 * the keeper every 8 s and the health checks every 30 s for nobody; coming
 * back to it still shows data no older than before.
 *
 * Returns the cleanup.
 */
export function pollWhileVisible(fn: () => void, ms: number): () => void {
  const id = setInterval(() => {
    if (!document.hidden) fn()
  }, ms)
  const onVisibility = () => {
    if (!document.hidden) fn()
  }
  document.addEventListener("visibilitychange", onVisibility)
  return () => {
    clearInterval(id)
    document.removeEventListener("visibilitychange", onVisibility)
  }
}
