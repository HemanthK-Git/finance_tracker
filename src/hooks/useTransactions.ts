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
      const deviceId = getDeviceId();
      const q = query(
        collection(db, "transactions"),
        where("device_id", "==", deviceId),
        orderBy("date", "desc")
      );
      const snapshot = await getDocs(q);
      return snapshot.docs.map(doc => ({
        id: doc.id,
        ...doc.data(),
        // Convert Firestore timestamps to string if needed, or keep as is
      })) as Transaction[];
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
