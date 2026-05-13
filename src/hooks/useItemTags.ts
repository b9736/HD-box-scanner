import { useState, useEffect } from 'react';
import { collection, query, onSnapshot, addDoc, serverTimestamp, where } from 'firebase/firestore';
import { db, auth } from '../firebase';

export const useItemTags = () => {
  const [tags, setTags] = useState<string[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const user = auth.currentUser;
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
  }, [auth.currentUser]);

  const addTag = async (name: string) => {
    const user = auth.currentUser;
    if (!user) return;

    try {
      await addDoc(collection(db, "item_tags"), {
        name: name.trim(),
        uid: user.uid,
        createdAt: serverTimestamp()
      });
    } catch (err) {
      console.error("Error adding global tag:", err);
    }
  };

  return { tags, loading, addTag };
};
