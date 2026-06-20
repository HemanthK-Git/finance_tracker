import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { db } from "@/lib/firebase";
import { 
  collection, 
  query, 
  where, 
  getDocs, 
  addDoc, 
  updateDoc, 
  deleteDoc, 
  doc,
  serverTimestamp
} from "firebase/firestore";
import { useAuth } from "./useAuth";
import { toast } from "sonner";

export type Transaction = {
  id: string;
  user_id: string;
  amount: number;
  type: "income" | "expense";
  category: string;
  date: string;
  time?: string | null;
  note: string | null;
  created_at: any;
  updated_at: any;
};

export type TransactionInput = {
  amount: number;
  type: "income" | "expense";
  category: string;
  date: string;
  time?: string | null;
  note?: string | null;
};

const KEY = ["transactions"];

export function useTransactions() {
  const { user } = useAuth();

  return useQuery({
    queryKey: [...KEY, user?.uid],
    enabled: !!user,
    queryFn: async () => {
      try {
        if (!user) return [];
        const q = query(
          collection(db, "transactions"),
          where("user_id", "==", user.uid)
        );
        const snapshot = await getDocs(q);
        const data = snapshot.docs.map(doc => {
          const d = doc.data();
          return {
            id: doc.id,
            ...d,
            created_at: d.created_at?.toDate?.()?.toISOString() || new Date().toISOString(),
            updated_at: d.updated_at?.toDate?.()?.toISOString() || new Date().toISOString(),
          } as Transaction;
        });

        // Sort by date descending locally to avoid the index requirement
        return data.sort((a, b) => new Date(b.date).getTime() - new Date(a.date).getTime());
      } catch (error: any) {
        console.error("Firestore query error:", error);
        throw error;
      }
    },
  });
}

export function useUpsertTransaction() {
  const qc = useQueryClient();
  const { user } = useAuth();

  return useMutation({
    mutationFn: async ({ id, input }: { id?: string; input: TransactionInput }) => {
      if (!user) throw new Error("Must be logged in");
      
      if (id) {
        const docRef = doc(db, "transactions", id);
        await updateDoc(docRef, { 
          ...input, 
          updated_at: serverTimestamp() 
        });
      } else {
        await addDoc(collection(db, "transactions"), {
          ...input,
          user_id: user.uid,
          created_at: serverTimestamp(),
          updated_at: serverTimestamp()
        });
      }
    },
    onSuccess: (_d, vars) => {
      qc.invalidateQueries({ queryKey: KEY });
      toast.success(vars.id ? "Transaction updated" : "Transaction added");
    },
    onError: (e: any) => {
      console.error(e);
      toast.error(e.message ?? "Failed to save");
    },
  });
}

export function useDeleteTransaction() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (id: string) => {
      await deleteDoc(doc(db, "transactions", id));
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: KEY });
      toast.success("Transaction deleted");
    },
    onError: (e: any) => toast.error(e.message ?? "Failed to delete"),
  });
}
