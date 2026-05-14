import { useState, useEffect } from 'react';
import { collection, query, where, onSnapshot, addDoc, serverTimestamp, deleteDoc, doc, setDoc } from 'firebase/firestore';
import { db } from '../firebase';
import { useAuth } from '../contexts/AuthContext';

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
  uid: string;
  createdAt?: any;
}

export const useItems = (boxId?: string) => {
  const { user } = useAuth();
  const [items, setItems] = useState<Item[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (!user) {
      setItems([]);
      setLoading(false);
      return;
    }

    setLoading(true);
    let q;
    if (boxId) {
      q = query(
        collection(db, "items"), 
        where("uid", "==", user.uid),
        where("boxId", "==", boxId)
      );
    } else {
      q = query(
        collection(db, "items"), 
        where("uid", "==", user.uid)
      );
    }
    
    const unsubscribe = onSnapshot(q, (snapshot) => {
      const itemData = snapshot.docs.map(doc => ({
        id: doc.id,
        ...doc.data()
      })) as Item[];
      
      // Sort in memory to avoid needing a composite index
      itemData.sort((a, b) => {
        const dateA = a.createdAt?.toDate?.() || new Date(0);
        const dateB = b.createdAt?.toDate?.() || new Date(0);
        return dateB - dateA;
      });

      setItems(itemData);
      setLoading(false);
    }, (error) => {
      console.error("Error fetching items:", error);
      setLoading(false);
    });

    return () => unsubscribe();
  }, [boxId, user]);

  const addItem = async (
    name: string, 
    quantity: number = 1, 
    overrideBoxId?: string, 
    description?: string, 
    tags: string[] = [],
    images: string[] = [],
    receipts: string[] = [],
    purchaseDate: string = '',
    warrantyExpire: string = ''
  ) => {
    if (!user) throw new Error("User not authenticated");

    try {
      const docRef = await addDoc(collection(db, "items"), {
        name,
        quantity,
        description: description || '',
        tags,
        boxId: overrideBoxId || boxId || '',
        images,
        receipts,
        imageUrl: images[0] || '',
        receiptUrl: receipts[0] || '',
        purchaseDate,
        warrantyExpire,
        uid: user.uid,
        createdAt: serverTimestamp(),
      });
      return docRef.id;
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
