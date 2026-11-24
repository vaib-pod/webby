// Presets contain only fields accepted by validatePatch; selection is derived,
// so manual edits and Reset cannot leave a stale preset label.
const preset = (id, name, fontScale, lineHeight, contrastMode, reduceMotion) => Object.freeze({
  id, name, patch:Object.freeze({enabled:true, fontScale, lineHeight, contrastMode,
    darkMode:false, reduceMotion, focusAssist:true})
});
export const PRESETS = Object.freeze([
  preset('low-vision', 'Low Vision', 1.45, 1.9, 'high', true),
  preset('calm', 'Calm Mode', 1.15, 1.75, 'normal', true)
]);
export function matchingPreset(profile) {
  return PRESETS.find(item => Object.entries(item.patch).every(([key,value]) => profile?.[key] === value)) ?? null;
}
