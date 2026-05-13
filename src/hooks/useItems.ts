import { useState, useEffect } from 'react';
import { collection, query, where, onSnapshot, addDoc, serverTimestamp, deleteDoc, doc, setDoc } from 'firebase/firestore';
import { db } from '../firebase';

export interface Item {
  id: string;
  name: string;
  quantity: number;
  boxId: string;
  imageUrl?: string;
  receiptUrl?: string;
  images?: string[];
  receipts?: string[];
  purchaseDate?: string;
  warrantyExpire?: string;
  description?: string;
  tags?: string[];
}

export const useItems = (boxId?: string) => {
  const [items, setItems] = useState<Item[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const q = boxId 
      ? query(collection(db, "items"), where("boxId", "==", boxId))
      : query(collection(db, "items"));
    
    const unsubscribe = onSnapshot(q, (snapshot) => {
      const itemData = snapshot.docs.map(doc => ({
        id: doc.id,
        ...doc.data()
      })) as Item[];
      setItems(itemData);
      setLoading(false);
    }, (error) => {
      console.error("Error fetching items:", error);
      setLoading(false);
    });

    return () => unsubscribe();
  }, [boxId]);

  const addItem = async (name: string, quantity: number = 1, overrideBoxId?: string, description?: string, tags: string[] = []) => {
    try {
      await addDoc(collection(db, "items"), {
        name,
        quantity,
        description: description || '',
        tags,
        boxId: overrideBoxId || boxId,
        createdAt: serverTimestamp(),
      });
    } catch (err) {
      console.error("Error adding item:", err);
      throw err;
    }
  };

  const removeItem = async (itemId: string) => {
    try {
      await deleteDoc(doc(db, "items", itemId));
    } catch (err) {
      console.error("Error removing item:", err);
      throw err;
    }
  };

  const updateItem = async (itemId: string, updates: Partial<Item>) => {
    try {
      await setDoc(doc(db, "items", itemId), {
        ...updates,
        updatedAt: serverTimestamp(),
      }, { merge: true });
    } catch (err) {
      console.error("Error updating item:", err);
      throw err;
    }
  };

  return { items, loading, addItem, removeItem, updateItem };
};
