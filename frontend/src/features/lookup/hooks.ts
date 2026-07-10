import { useQuery } from "@tanstack/react-query";
import { getBorrowerLookup, getLoanLookup } from "./api";

export function useLoanLookup() {
  return useQuery({ queryKey: ["lookup", "loans"], queryFn: getLoanLookup, staleTime: 60_000 });
}

export function useBorrowerLookup() {
  return useQuery({ queryKey: ["lookup", "borrowers"], queryFn: getBorrowerLookup, staleTime: 60_000 });
}
