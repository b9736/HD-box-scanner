import { useState, useEffect } from 'react';
import { collection, query, orderBy, onSnapshot, addDoc, serverTimestamp, setDoc, deleteDoc, doc, where } from 'firebase/firestore';
import { db, auth } from '../firebase';

export interface Box {
  id: string;
  name: string;
  room: string;
  tags: string[];
  createdAt: any;
  images?: string[];
  imageUrl?: string;
  uid: string;
}

export const useBoxes = () => {
  const [boxes, setBoxes] = useState<Box[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const user = auth.currentUser;
    if (!user) {
      setBoxes([]);
      setLoading(false);
      return;
    }

    const q = query(
      collection(db, "boxes"), 
      where("uid", "==", user.uid),
      orderBy("createdAt", "desc")
    );
    
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
  }, [auth.currentUser]);

  const createBox = async (name: string, room: string, tags: string[]) => {
    const user = auth.currentUser;
    if (!user) throw new Error("User not authenticated");

    try {
      await addDoc(collection(db, "boxes"), {
        name,
        room,
        tags,
        uid: user.uid,
        createdAt: serverTimestamp(),
      });
    } catch (err) {
      console.error("Error creating box:", err);
      throw err;
    }
  };

  const updateBox = async (id: string, updates: Partial<Box>) => {
    try {
      await setDoc(doc(db, "boxes", id), {
        ...updates,
        updatedAt: serverTimestamp(),
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
