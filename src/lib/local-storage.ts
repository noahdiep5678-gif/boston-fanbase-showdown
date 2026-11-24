// Native: back the global `localStorage` with expo-sqlite so sessions and saved games persist.
// The web build uses local-storage.web.ts, because browsers already provide localStorage.
import 'expo-sqlite/localStorage/install';
