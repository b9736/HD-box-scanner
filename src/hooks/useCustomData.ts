import { useState, useEffect } from 'react';
import { collection, query, where, onSnapshot, addDoc, deleteDoc, doc, getDocs } from 'firebase/firestore';
import { db } from '../firebase';
import { useAuth } from '../contexts/AuthContext';

export interface CustomLocation {
  id: string;
  name: string;
  uid: string;
}

export interface CustomGroup {
  id: string;
  name: string;
  uid: string;
}

export const useCustomData = () => {
  const { user } = useAuth();
  const [customLocations, setCustomLocations] = useState<CustomLocation[]>([]);
  const [customGroups, setCustomGroups] = useState<CustomGroup[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (!user) {
      setCustomLocations([]);
      setCustomGroups([]);
      setLoading(false);
      return;
    }

    setLoading(true);

    const qLocs = query(
      collection(db, "custom_locations"),
      where("uid", "==", user.uid)
    );

    const unsubscribeLocs = onSnapshot(qLocs, (snapshot) => {
      const locs = snapshot.docs.map(doc => ({
        id: doc.id,
        ...doc.data()
      })) as CustomLocation[];
      setCustomLocations(locs);
    }, (error) => {
      console.error("Error fetching custom locations:", error);
    });

    const qGroups = query(
      collection(db, "custom_groups"),
      where("uid", "==", user.uid)
    );

    const unsubscribeGroups = onSnapshot(qGroups, (snapshot) => {
      const grps = snapshot.docs.map(doc => ({
        id: doc.id,
        ...doc.data()
      })) as CustomGroup[];
      setCustomGroups(grps);
      setLoading(false);
    }, (error) => {
      console.error("Error fetching custom groups:", error);
      setLoading(false);
    });

    return () => {
      unsubscribeLocs();
      unsubscribeGroups();
    };
  }, [user]);

  const addCustomLocation = async (name: string) => {
    if (!user || !name.trim()) return;
    const trimmed = name.trim();
    // Prevent duplicates
    const existing = customLocations.some(loc => loc.name.toLowerCase() === trimmed.toLowerCase());
    if (existing) return;

    try {
      await addDoc(collection(db, "custom_locations"), {
        name: trimmed,
        uid: user.uid,
      });
    } catch (err) {
      console.error("Error adding custom location:", err);
      throw err;
    }
  };

  const deleteCustomLocation = async (id: string) => {
    try {
      await deleteDoc(doc(db, "custom_locations", id));
    } catch (err) {
      console.error("Error deleting custom location:", err);
      throw err;
    }
  };

  const deleteCustomLocationByName = async (name: string) => {
    if (!user) return;
    try {
      const q = query(
        collection(db, "custom_locations"),
        where("uid", "==", user.uid),
        where("name", "==", name)
      );
      const snap = await getDocs(q);
      const deletePromises = snap.docs.map(docSnap => deleteDoc(docSnap.ref));
      await Promise.all(deletePromises);
    } catch (err) {
      console.error("Error deleting custom location by name:", err);
      throw err;
    }
  };

  const addCustomGroup = async (name: string) => {
    if (!user || !name.trim()) return;
    const trimmed = name.trim();
    // Prevent duplicates
    const existing = customGroups.some(grp => grp.name.toLowerCase() === trimmed.toLowerCase());
    if (existing) return;

    try {
      await addDoc(collection(db, "custom_groups"), {
        name: trimmed,
        uid: user.uid,
      });
    } catch (err) {
      console.error("Error adding custom group:", err);
      throw err;
    }
  };

  const deleteCustomGroup = async (id: string) => {
    try {
      await deleteDoc(doc(db, "custom_groups", id));
    } catch (err) {
      console.error("Error deleting custom group:", err);
      throw err;
    }
  };

  const deleteCustomGroupByName = async (name: string) => {
    if (!user) return;
    try {
      const q = query(
        collection(db, "custom_groups"),
        where("uid", "==", user.uid),
        where("name", "==", name)
      );
      const snap = await getDocs(q);
      const deletePromises = snap.docs.map(docSnap => deleteDoc(docSnap.ref));
      await Promise.all(deletePromises);
    } catch (err) {
      console.error("Error deleting custom group by name:", err);
      throw err;
    }
  };

  return {
    customLocations,
    customGroups,
    loading,
    addCustomLocation,
    deleteCustomLocation,
    deleteCustomLocationByName,
    addCustomGroup,
    deleteCustomGroup,
    deleteCustomGroupByName
  };
};
