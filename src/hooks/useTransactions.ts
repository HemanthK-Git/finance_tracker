import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
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
  created_at: string;
  updated_at: string;
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
      const { data, error } = await supabase
        .from("transactions")
        .select("*")
        .eq("device_id", deviceId)
        .order("date", { ascending: false })
        .order("created_at", { ascending: false });
      if (error) throw error;
      return (data ?? []) as Transaction[];
    },
  });
}

export function useUpsertTransaction() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async ({ id, input }: { id?: string; input: TransactionInput }) => {
      const deviceId = getDeviceId();
      if (id) {
        const { error } = await supabase
          .from("transactions")
          .update({ ...input })
          .eq("id", id)
          .eq("device_id", deviceId);
        if (error) throw error;
      } else {
        const { error } = await supabase
          .from("transactions")
          .insert({ ...input, device_id: deviceId });
        if (error) throw error;
      }
    },
    onSuccess: (_d, vars) => {
      qc.invalidateQueries({ queryKey: KEY });
      toast.success(vars.id ? "Transaction updated" : "Transaction added");
    },
    onError: (e: any) => toast.error(e.message ?? "Failed to save"),
  });
}

export function useDeleteTransaction() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (id: string) => {
      const { error } = await supabase.from("transactions").delete().eq("id", id);
      if (error) throw error;
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: KEY });
      toast.success("Transaction deleted");
    },
    onError: (e: any) => toast.error(e.message ?? "Failed to delete"),
  });
}
