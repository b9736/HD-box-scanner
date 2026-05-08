export const getWarrantyStatus = (dateStr: string) => {
  if (!dateStr) return null;
  const today = new Date();
  today.setHours(0, 0, 0, 0);
  const expire = new Date(dateStr);
  expire.setHours(0, 0, 0, 0);
  
  const diffTime = expire.getTime() - today.getTime();
  const diffDays = Math.ceil(diffTime / (1000 * 60 * 60 * 24));
  
  if (diffDays < 0) return { text: 'Expired', color: '#FF3B30', isExpired: true };
  if (diffDays === 0) return { text: 'Expires Today!', color: '#FF3B30', isExpired: true };
  if (diffDays <= 7) return { text: `${diffDays} days left`, color: '#FF9500' };
  return { text: `${diffDays} days left`, color: '#34C759' };
};
