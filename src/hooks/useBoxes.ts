import { useState, useEffect } from 'react';
import { collection, query, orderBy, onSnapshot, addDoc, serverTimestamp, setDoc, deleteDoc, doc } from 'firebase/firestore';
import { db } from '../firebase';

export interface Box {
  id: string;
  name: string;
  room: string;
  tags: string[];
  createdAt: any;
}

export const useBoxes = () => {
  const [boxes, setBoxes] = useState<Box[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const q = query(collection(db, "boxes"), orderBy("createdAt", "desc"));
    
    const unsubscribe = onSnapshot(q, (snapshot) => {
      const boxData = snapshot.docs.map(doc => ({
        id: doc.id,
        ...doc.data()
      })) as Box[];
      setBoxes(boxData);
      setLoading(false);
    }, (error) => {
      console.error("Error fetching boxes:", error);
      setLoading(false);
    });

    return () => unsubscribe();
  }, []);

  const createBox = async (name: string, room: string, tags: string[]) => {
    try {
      await addDoc(collection(db, "boxes"), {
        name,
        room,
        tags,
        createdAt: serverTimestamp(),
      });
    } catch (err) {
      console.error("Error creating box:", err);
      throw err;
    }
  };

  const updateBox = async (id: string, name: string, room: string, tags: string[], imageUrl?: string) => {
    try {
      await setDoc(doc(db, "boxes", id), {
        name,
        room,
        tags,
        ...(imageUrl && { imageUrl }),
      }, { merge: true });
    } catch (err) {
      console.error("Error updating box:", err);
      throw err;
    }
  };

  const deleteBox = async (id: string) => {
    try {
      await deleteDoc(doc(db, "boxes", id));
    } catch (err) {
      console.error("Error deleting box:", err);
      throw err;
    }
  };

  return { boxes, loading, createBox, updateBox, deleteBox };
};
