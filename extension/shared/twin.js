import {getEffectiveProfile,getColourPreference} from './storage.js';

// Read-only local integration boundary: user-confirmed presentation preferences.
// No inference engine, clinical category, plate answers or assessment history.
export async function getAccessibilityTwin(hostname) {
  const [profile,colourPreference]=await Promise.all([getEffectiveProfile(hostname),getColourPreference()]);
  return {version:1,profile,colourPreference};
}
