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
  orderBy,
  Timestamp,
  serverTimestamp
} from "firebase/firestore";
import { getDeviceId } from "@/lib/constants";
import { toast } from "sonner";

export type Transaction = {
  id: string;
  device_id: string;
  amount: number;
  type: "income" | "expense";
  category: string;
  date: string;
  note: string | null;
  created_at: any;
  updated_at: any;
};

export type TransactionInput = {
  amount: number;
  type: "income" | "expense";
  category: string;
  date: string;
  note?: string | null;
};

const KEY = ["transactions"];

export function useTransactions() {
  return useQuery({
    queryKey: KEY,
    queryFn: async () => {
      try {
        const deviceId = getDeviceId();
        // Removed orderBy here because it requires a composite index which causes slow loading/errors
        const q = query(
          collection(db, "transactions"),
          where("device_id", "==", deviceId)
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
  return useMutation({
    mutationFn: async ({ id, input }: { id?: string; input: TransactionInput }) => {
      const deviceId = getDeviceId();
      if (id) {
        const docRef = doc(db, "transactions", id);
        await updateDoc(docRef, { 
          ...input, 
          updated_at: serverTimestamp() 
        });
      } else {
        await addDoc(collection(db, "transactions"), {
          ...input,
          device_id: deviceId,
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
