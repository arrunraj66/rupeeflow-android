// Only coordinate players inside Arun One. Android's mix-with-others policy stays intact.
type Stop = () => void | Promise<void>;
const players = new Map<string, Stop>();
export function registerPlayback(id: string, stop: Stop): () => void {
  players.set(id, stop);
  return () => { if (players.get(id) === stop) players.delete(id); };
}
export function claimPlayback(id: string): void {
  players.forEach((stop, key) => {
    if (key !== id) { try { void Promise.resolve(stop()).catch(() => undefined); } catch {} }
  });
}
