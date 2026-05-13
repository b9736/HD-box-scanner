/**
 * Generates a consistent HSL color based on a string (tag name).
 * This ensures the same tag always has the same color across the app.
 */
export const getTagColor = (tagName: string) => {
  let hash = 0;
  for (let i = 0; i < tagName.length; i++) {
    hash = tagName.charCodeAt(i) + ((hash << 5) - hash);
  }
  
  // Use HSL for better control over vibrancy and readability
  const h = Math.abs(hash % 360);
  const s = 70; // 70% saturation for vibrancy
  const l = 40; // 40% lightness for better contrast on dark backgrounds
  
  return {
    bg: `hsla(${h}, ${s}%, ${l}%, 0.15)`,
    activeBg: `hsla(${h}, ${s}%, ${l}%, 0.35)`,
    text: `hsl(${h}, ${s}%, ${l + 35}%)`,
    border: `hsla(${h}, ${s}%, ${l}%, 0.4)`
  };
};
