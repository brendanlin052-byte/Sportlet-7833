import { useMutation } from "@tanstack/react-query";
import { orpc } from "../lib/api";
export function useCreateResetLink() {
  return useMutation(orpc.accountManagement.createResetLink.mutationOptions());
}
export function useResetPassword() {
  return useMutation(orpc.accountManagement.resetPassword.mutationOptions());
}