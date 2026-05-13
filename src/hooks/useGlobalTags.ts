import { useState, useEffect } from 'react';
import { collection, query, onSnapshot, where } from 'firebase/firestore';
import { db, auth } from '../firebase';

/**
 * Hook to fetch all unique tags used across the CURRENT user's boxes.
 * Useful for providing tag suggestions and quick-selection.
 */
export const useGlobalTags = () => {
  const [tags, setTags] = useState<string[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const user = auth.currentUser;
    if (!user) {
      setTags([]);
      setLoading(false);
      return;
    }

    const q = query(collection(db, "boxes"), where("uid", "==", user.uid));
    const unsubscribe = onSnapshot(q, (snapshot) => {
      const allTags = new Set<string>();
      snapshot.docs.forEach(doc => {
        const data = doc.data();
        if (data.tags && Array.isArray(data.tags)) {
          data.tags.forEach(tag => allTags.add(tag));
        }
      });
      setTags(Array.from(allTags).sort());
      setLoading(false);
    }, (err) => {
      console.error("useGlobalTags error:", err);
      setLoading(false);
    });

    return () => unsubscribe();
  }, [auth.currentUser]);

  return { tags, loading };
};
