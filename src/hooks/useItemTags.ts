import { useState, useEffect } from 'react';
import { collection, query, onSnapshot, addDoc, serverTimestamp, where, getDocs, writeBatch, arrayRemove } from 'firebase/firestore';
import { db } from '../firebase';
import { useAuth } from '../contexts/AuthContext';

export const useItemTags = () => {
  const { user } = useAuth();
  const [tags, setTags] = useState<string[]>([]);
  const [tagCounts, setTagCounts] = useState<Record<string, number>>({});
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (!user) {
      setTags([]);
      setLoading(false);
      return;
    }

    let globalTags: string[] = [];

    const updateCombinedTags = (counts: Record<string, number>) => {
      const combined = new Set([...Object.keys(counts), ...globalTags]);
      setTags(Array.from(combined).sort());
      setTagCounts(counts);
      setLoading(false);
    };

    const unsubItems = onSnapshot(
      query(collection(db, "items"), where("uid", "==", user.uid)), 
      (snapshot) => {
        const counts: Record<string, number> = {};
        snapshot.docs.forEach(doc => {
          const data = doc.data();
          if (data.tags && Array.isArray(data.tags)) {
            data.tags.forEach(tag => {
              counts[tag] = (counts[tag] || 0) + 1;
            });
          }
        });
        updateCombinedTags(counts);
      }
    );

    const unsubGlobal = onSnapshot(
      query(collection(db, "item_tags"), where("uid", "==", user.uid)), 
      (snapshot) => {
        const tagsSet = new Set<string>();
        snapshot.docs.forEach(doc => {
          const data = doc.data();
          if (data.name) tagsSet.add(data.name);
        });
        globalTags = Array.from(tagsSet);
        // We don't need to trigger a full update here if counts haven't changed, 
        // but adding a new global tag should show up in the list with 0 count.
        setTags(prev => Array.from(new Set([...prev, ...globalTags])).sort());
      }
    );

    return () => {
      unsubItems();
      unsubGlobal();
    };
  }, [user]);

  const addTag = async (name: string) => {
    if (!user || !name.trim()) return;

    try {
      // Check if it already exists as a global tag
      const q = query(collection(db, "item_tags"), where("uid", "==", user.uid), where("name", "==", name.trim()));
      const snap = await getDocs(q);
      if (!snap.empty) return; // Already exists

      await addDoc(collection(db, "item_tags"), {
        name: name.trim(),
        uid: user.uid,
        createdAt: serverTimestamp()
      });
    } catch (err) {
      console.error("Error adding global tag:", err);
    }
  };

  const removeTag = async (name: string) => {
    if (!user) return;
    try {
      const batch = writeBatch(db);
      
      // 1. Remove from global suggestions
      const q = query(collection(db, "item_tags"), where("uid", "==", user.uid), where("name", "==", name));
      const snap = await getDocs(q);
      snap.docs.forEach(doc => batch.delete(doc.ref));
      
      // 2. Remove from all items that have this tag
      const itemsQ = query(collection(db, "items"), where("uid", "==", user.uid), where("tags", "array-contains", name));
      const itemsSnap = await getDocs(itemsQ);
      itemsSnap.docs.forEach(itemDoc => {
        batch.update(itemDoc.ref, {
          tags: arrayRemove(name)
        });
      });
      
      await batch.commit();
    } catch (err) {
      console.error("Error removing global tag:", err);
    }
  };

  const renameTag = async (oldName: string, newName: string) => {
    if (!user || !newName.trim() || oldName === newName) return;
    try {
      const batch = writeBatch(db);
      
      // 1. Update global suggestions
      const q = query(collection(db, "item_tags"), where("uid", "==", user.uid), where("name", "==", oldName));
      const snap = await getDocs(q);
      snap.docs.forEach(doc => {
        batch.update(doc.ref, { name: newName.trim() });
      });

      // 2. Update all items that have this tag
      const itemsQ = query(collection(db, "items"), where("uid", "==", user.uid), where("tags", "array-contains", oldName));
      const itemsSnap = await getDocs(itemsQ);
      itemsSnap.docs.forEach(itemDoc => {
        const currentTags = itemDoc.data().tags || [];
        const updatedTags = currentTags.map((t: string) => t === oldName ? newName.trim() : t);
        batch.update(itemDoc.ref, { tags: updatedTags });
      });
      
      await batch.commit();
    } catch (err) {
      console.error("Error renaming global tag:", err);
    }
  };

  return { tags, tagCounts, loading, addTag, removeTag, renameTag };
};
