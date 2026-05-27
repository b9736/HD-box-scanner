import { useState, useEffect } from 'react';
import { collection, query, onSnapshot, addDoc, serverTimestamp, setDoc, deleteDoc, doc, where, getDocs } from 'firebase/firestore';
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
  inTrash?: boolean;
  deletedAt?: any;
}

export const useBoxes = () => {
  const { user } = useAuth();
  const [boxes, setBoxes] = useState<Box[]>([]);
  const [trashBoxes, setTrashBoxes] = useState<Box[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (!user) {
      setBoxes([]);
      setTrashBoxes([]);
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

      const activeBoxes = boxData.filter(b => !b.inTrash);
      const deletedBoxes = boxData.filter(b => b.inTrash);

      setBoxes(activeBoxes);
      setTrashBoxes(deletedBoxes);
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
      let nextId = "001";
      if (boxes.length > 0) {
        const numericIds = boxes
          .map(b => parseInt(b.id, 10))
          .filter(id => !isNaN(id));
        if (numericIds.length > 0) {
          const maxId = Math.max(...numericIds);
          nextId = String(maxId + 1).padStart(3, '0');
        }
      }

      await setDoc(doc(db, "boxes", nextId), {
        name,
        room,
        tags,
        uid: user.uid,
        hasQRCode,
        inTrash: false,
        createdAt: serverTimestamp(),
      });

      return nextId;
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
      await setDoc(doc(db, "boxes", id), {
        inTrash: true,
        deletedAt: serverTimestamp(),
      }, { merge: true });
    } catch (err) {
      console.error("Error soft-deleting box:", err);
      throw err;
    }
  };

  const restoreBox = async (id: string) => {
    try {
      await setDoc(doc(db, "boxes", id), {
        inTrash: false,
        deletedAt: null,
      }, { merge: true });
    } catch (err) {
      console.error("Error restoring box:", err);
      throw err;
    }
  };

  const deleteBoxPermanently = async (id: string) => {
    try {
      // Cascading deletion of items
      const itemsQuery = query(collection(db, "items"), where("boxId", "==", id));
      const itemsSnapshot = await getDocs(itemsQuery);
      await Promise.all(itemsSnapshot.docs.map(itemDoc => deleteDoc(itemDoc.ref)));

      // Delete box doc
      await deleteDoc(doc(db, "boxes", id));
    } catch (err) {
      console.error("Error permanently deleting box:", err);
      throw err;
    }
  };

  return { boxes, trashBoxes, loading, createBox, updateBox, deleteBox, restoreBox, deleteBoxPermanently };
};
