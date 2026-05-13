import { useState, useEffect } from 'react';
import { collection, query, onSnapshot, addDoc, serverTimestamp, setDoc, deleteDoc, doc, where } from 'firebase/firestore';
import { db } from '../firebase';
import { useAuth } from '../contexts/AuthContext';

export interface Box {
  id: string;
  name: string;
  room: string;
  tags: string[];
  createdAt: any;
  images?: string[];
  imageUrl?: string;
  uid: string;
  hasQRCode?: boolean;
}

export const useBoxes = () => {
  const { user } = useAuth();
  const [boxes, setBoxes] = useState<Box[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (!user) {
      setBoxes([]);
      setLoading(false);
      return;
    }

    setLoading(true);
    const q = query(
      collection(db, "boxes"), 
      where("uid", "==", user.uid)
    );
    
    const unsubscribe = onSnapshot(q, (snapshot) => {
      const boxData = snapshot.docs.map(doc => ({
        id: doc.id,
        ...doc.data()
      })) as Box[];
      
      // Sort in memory to avoid needing a composite index in Firestore
      boxData.sort((a, b) => {
        const dateA = a.createdAt?.toDate?.() || new Date(0);
        const dateB = b.createdAt?.toDate?.() || new Date(0);
        return dateB - dateA;
      });

      setBoxes(boxData);
      setLoading(false);
    }, (error) => {
      console.error("Error fetching boxes:", error);
      setLoading(false);
    });

    return () => unsubscribe();
  }, [user]);

  const createBox = async (name: string, room: string, tags: string[], hasQRCode: boolean = false) => {
    if (!user) throw new Error("User not authenticated");

    try {
      await addDoc(collection(db, "boxes"), {
        name,
        room,
        tags,
        uid: user.uid,
        hasQRCode,
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
