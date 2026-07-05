// The zustand-persist identity of the completed-daily-plays store.
// Lives in its own engine-free module so the Home screen
// (dailyWinsLite) can read the raw localStorage entry WITHOUT importing
// playsStore — which pulls in the whole game engine via bonusCards.
// Both playsStore (writer) and dailyWinsLite (reader) import from here,
// so the key and version can never silently drift apart again.
export const PLAYS_STORE_NAME = 'pokergrid:daily:plays:v1';
export const PLAYS_STORE_VERSION = 0;
