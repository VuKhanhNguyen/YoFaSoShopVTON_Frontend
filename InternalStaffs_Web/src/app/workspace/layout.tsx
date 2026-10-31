import { StaffShell } from "@/components/StaffShell";
export default function Layout({ children }: { children: React.ReactNode }) {
  return <StaffShell>{children}</StaffShell>;
}
