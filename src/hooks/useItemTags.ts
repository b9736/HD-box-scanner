import { useState, useEffect } from 'react';
import { collection, query, onSnapshot, addDoc, serverTimestamp, where, getDocs, writeBatch, updateDoc } from 'firebase/firestore';
import { db } from '../firebase';
import { useAuth } from '../contexts/AuthContext';

export const useItemTags = () => {
  const { user } = useAuth();
  const [tags, setTags] = useState<string[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (!user) {
      setTags([]);
      setLoading(false);
      return;
    }

    let itemTags: string[] = [];
    let globalTags: string[] = [];

    const updateCombinedTags = () => {
      const combined = new Set([...itemTags, ...globalTags]);
      setTags(Array.from(combined).sort());
      setLoading(false);
    };

    const unsubItems = onSnapshot(
      query(collection(db, "items"), where("uid", "==", user.uid)), 
      (snapshot) => {
        const tagsSet = new Set<string>();
        snapshot.docs.forEach(doc => {
          const data = doc.data();
          if (data.tags && Array.isArray(data.tags)) {
            data.tags.forEach(tag => tagsSet.add(tag));
          }
        });
        itemTags = Array.from(tagsSet);
        updateCombinedTags();
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
        updateCombinedTags();
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
      const q = query(collection(db, "item_tags"), where("uid", "==", user.uid), where("name", "==", name));
      const snap = await getDocs(q);
      const batch = writeBatch(db);
      snap.docs.forEach(doc => batch.delete(doc.ref));
      await batch.commit();
    } catch (err) {
      console.error("Error removing global tag:", err);
    }
  };

  const renameTag = async (oldName: string, newName: string) => {
    if (!user || !newName.trim() || oldName === newName) return;
    try {
      const q = query(collection(db, "item_tags"), where("uid", "==", user.uid), where("name", "==", oldName));
      const snap = await getDocs(q);
      const batch = writeBatch(db);
      snap.docs.forEach(doc => {
        batch.update(doc.ref, { name: newName.trim() });
      });
      await batch.commit();
    } catch (err) {
      console.error("Error renaming global tag:", err);
    }
  };

  return { tags, loading, addTag, removeTag, renameTag };
};
