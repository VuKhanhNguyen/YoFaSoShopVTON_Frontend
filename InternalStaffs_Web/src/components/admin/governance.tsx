"use client";

import { useEffect, useState, useTransition } from "react";
import {
  CheckCircle2,
  Info,
  KeyRound,
  Loader2,
  LockKeyhole,
  Pencil,
  Plus,
  RefreshCw,
  Search,
  ShieldAlert,
  ShieldCheck,
  Trash2,
  Undo2,
  Unlock,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogTitle, DialogDescription } from "@/components/ui/dialog";
import { ConfirmDialog } from "@/components/ui/confirm-dialog";
import {
  approveStock,
  STAFF_ROLE_LABELS,
  type AdminStaff,
  type AuditEntry,
  type StaffRole,
} from "@/lib/admin";
import { vnd } from "@/lib/pos";
import { api, ApiError } from "@/lib/api";
import { pushToast } from "@/lib/feedback";
import { vnLabel } from "@/lib/vietnamese-labels";
import { Badge, Field, PageHeading, SubTabs, TablePagination, inputClass } from "./shared";

type View = "shift" | "stock" | "staff" | "logs";

export interface RealShift {
  shiftId: string;
  cashierId: string;
  cashierName: string;
  openedAt: string;
  closedAt?: string;
  openingCash: number;
  countedCash?: number;
  status: string;
  note?: string;
}

export interface RealMovement {
  movementId: string;
  variantId: string;
  productName: string;
  size: string;
  color: string;
  type: string;
  delta: number;
  beforeStock: number;
  afterStock: number;
  referenceId?: string;
  reason?: string;
  performerId?: string;
  performerName?: string;
  createdAt: string;
}

export interface RealStaffUser {
  userId: string;
  username: string;
  fullName: string;
  phone: string;
  email: string;
  gender: string;
  status: "HOAT_DONG" | "KHOA_TAM_THOI" | string;
  roles: Array<{ roleId: string; name: string; label: string }>;
  address?: string;
}

const ROLE_OPTIONS = [
  { id: "VT003", role: "ROLE_STAFF_CASHIER", label: "Thu ngân bán lẻ POS" },
  { id: "VT004", role: "ROLE_STAFF_WAREHOUSE", label: "Nhân viên kho / điều phối" },
  { id: "VT005", role: "ROLE_STAFF_SHIPPER", label: "Nhân viên giao vận nội bộ" },
  { id: "VT001", role: "ROLE_SHOP_ADMIN", label: "Chủ shop / Quản trị viên" },
];

export function Governance({
  logs,
  log,
}: {
  staff?: AdminStaff[];
  setStaff?: (staff: AdminStaff[]) => void;
  logs: AuditEntry[];
  log: (action: string, reason: string) => void;
}) {
  const [view, setView] = useState<View>("shift");
  const [shift, setShift] = useState("CHO_DUYET");
  const [stock, setStock] = useState(8);
  const [stockApproved, setStockApproved] = useState(false);
  const [recount, setRecount] = useState(false);
  const [reason, setReason] = useState("");
  const [search, setSearch] = useState("");

  // Real MySQL Staff state
  const [staffList, setStaffList] = useState<RealStaffUser[]>([]);
  const [loadingStaff, setLoadingStaff] = useState(false);
  const [staffSearch, setStaffSearch] = useState("");
  const [staffPage, setStaffPage] = useState(1);
  const STAFF_PAGE_SIZE = 10;
  const [staffDetailModal, setStaffDetailModal] = useState<RealStaffUser | null>(null);

  // Real MySQL Shifts state
  const [shifts, setShifts] = useState<RealShift[]>([]);
  const [loadingShifts, setLoadingShifts] = useState(false);
  const [shiftPage, setShiftPage] = useState(1);
  const SHIFT_PAGE_SIZE = 10;
  const [shiftFilter, setShiftFilter] = useState("ALL");
  const [shiftDetailModal, setShiftDetailModal] = useState<RealShift | null>(null);
  const [approvingShift, setApprovingShift] = useState(false);
  const [rejectingShift, setRejectingShift] = useState(false);

  // Real MySQL Inventory Movements state
  const [movements, setMovements] = useState<RealMovement[]>([]);
  const [loadingMovements, setLoadingMovements] = useState(false);
  const [movementPage, setMovementPage] = useState(1);
  const MOVEMENT_PAGE_SIZE = 10;
  const [movementSearch, setMovementSearch] = useState("");
  const [movementTypeFilter, setMovementTypeFilter] = useState("ALL");
  const [movementDetailModal, setMovementDetailModal] = useState<RealMovement | null>(null);

  // Audit Logs state
  const [logPage, setLogPage] = useState(1);
  const LOG_PAGE_SIZE = 10;
  const [logDetailModal, setLogDetailModal] = useState<AuditEntry | null>(null);

  // CRUD Modals
  const [addModalOpen, setAddModalOpen] = useState(false);
  const [editTarget, setEditTarget] = useState<RealStaffUser | null>(null);
  const [deleteTarget, setDeleteTarget] = useState<RealStaffUser | null>(null);
  const [statusTarget, setStatusTarget] = useState<RealStaffUser | null>(null);
  const [otpResetTarget, setOtpResetTarget] = useState<RealStaffUser | null>(null);

  // Form states for Add Staff
  const [newUsername, setNewUsername] = useState("");
  const [newPassword, setNewPassword] = useState("");
  const [newFullName, setNewFullName] = useState("");
  const [newPhone, setNewPhone] = useState("");
  const [newEmail, setNewEmail] = useState("");
  const [newRoleId, setNewRoleId] = useState("VT003");
  const [formError, setFormError] = useState("");
  const [submitting, setSubmitting] = useState(false);

  // Form states for Edit Staff
  const [editFullName, setEditFullName] = useState("");
  const [editPhone, setEditPhone] = useState("");
  const [editEmail, setEditEmail] = useState("");
  const [editGender, setEditGender] = useState("NAM");
  const [editRoleId, setEditRoleId] = useState("VT003");

  // OTP Reset Password states for Staff
  const [otpRequestId, setOtpRequestId] = useState("");
  const [otpSent, setOtpSent] = useState(false);
  const [otpCode, setOtpCode] = useState("");
  const [staffNewPassword, setStaffNewPassword] = useState("");
  const [staffConfirmPassword, setStaffConfirmPassword] = useState("");
  const [otpCooldown, setOtpCooldown] = useState(0);
  const [otpResetError, setOtpResetError] = useState("");
  const [resettingPassword, startResetTransition] = useTransition();

  // Load Real Staff from MySQL
  const loadStaff = async () => {
    setLoadingStaff(true);
    try {
      const data = await api<RealStaffUser[]>("/admin/users?role=STAFF");
      if (Array.isArray(data)) {
        setStaffList(data);
      }
    } catch (err) {
      console.warn("Could not load real staff, fallback to mock:", err);
    } finally {
      setLoadingStaff(false);
    }
  };

  // Load Real Shifts from MySQL
  const loadShifts = async () => {
    setLoadingShifts(true);
    try {
      const data = await api<RealShift[]>("/admin/shifts");
      if (Array.isArray(data)) setShifts(data);
    } catch (err) {
      console.warn("Could not load real shifts:", err);
    } finally {
      setLoadingShifts(false);
    }
  };

  // Load Real Inventory Movements from MySQL
  const loadMovements = async () => {
    setLoadingMovements(true);
    try {
      const data = await api<RealMovement[]>("/admin/inventory/movements");
      if (Array.isArray(data)) setMovements(data);
    } catch (err) {
      console.warn("Could not load real inventory movements:", err);
    } finally {
      setLoadingMovements(false);
    }
  };

  // Approve Shift
  const handleApproveShift = async (s: RealShift) => {
    setApprovingShift(true);
    try {
      await api(`/admin/shifts/${s.shiftId}/approve`, "POST", {});
      pushToast({
        tone: "success",
        title: `Đã duyệt đóng ca ${s.shiftId} của thu ngân ${s.cashierName}!`,
        detail: `Tiền mặt nộp két: ${vnd(s.countedCash ?? s.openingCash)}`,
      });
      log(`Duyệt kết ca ${s.shiftId}`, `Thu ngân: ${s.cashierName}`);
      await loadShifts();
      if (shiftDetailModal?.shiftId === s.shiftId) {
        setShiftDetailModal(null);
      }
    } catch (err: unknown) {
      pushToast({
        tone: "error",
        title: "Phê duyệt kết ca thất bại",
        detail: err instanceof Error ? err.message : "Có lỗi xảy ra khi duyệt ca",
      });
    } finally {
      setApprovingShift(false);
    }
  };

  // Reject / Request Recount Shift
  const handleRejectShift = async (s: RealShift) => {
    setRejectingShift(true);
    try {
      await api(`/admin/shifts/${s.shiftId}/reject`, "POST", {});
      pushToast({
        tone: "warning",
        title: `Đã yêu cầu đếm lại ca ${s.shiftId}!`,
        detail: "Ca làm việc đã được mở lại để thu ngân kiểm đếm lại sổ tiền mặt.",
      });
      log(`Yêu cầu đếm lại ca ${s.shiftId}`, `Thu ngân: ${s.cashierName}`);
      await loadShifts();
      if (shiftDetailModal?.shiftId === s.shiftId) {
        setShiftDetailModal(null);
      }
    } catch (err: unknown) {
      pushToast({
        tone: "error",
        title: "Yêu cầu đếm lại thất bại",
        detail: err instanceof Error ? err.message : "Có lỗi xảy ra",
      });
    } finally {
      setRejectingShift(false);
    }
  };

  useEffect(() => {
    let active = true;
    api<RealStaffUser[]>("/admin/users?role=STAFF")
      .then((data) => {
        if (active && Array.isArray(data)) setStaffList(data);
      })
      .catch((err) => {
        console.warn("Could not load real staff:", err);
      });

    api<RealShift[]>("/admin/shifts")
      .then((data) => {
        if (active && Array.isArray(data)) setShifts(data);
      })
      .catch((err) => {
        console.warn("Could not load real shifts:", err);
      });

    api<RealMovement[]>("/admin/inventory/movements")
      .then((data) => {
        if (active && Array.isArray(data)) setMovements(data);
      })
      .catch((err) => {
        console.warn("Could not load real inventory movements:", err);
      });

    return () => {
      active = false;
    };
  }, []);

  // OTP Cooldown
  useEffect(() => {
    if (otpCooldown <= 0) return;
    const t = setInterval(() => setOtpCooldown((c) => c - 1), 1000);
    return () => clearInterval(t);
  }, [otpCooldown]);

  // Create Staff
  const handleCreateStaff = async (e: React.FormEvent) => {
    e.preventDefault();
    setFormError("");
    if (newPassword.length < 10) {
      setFormError("Mật khẩu khởi tạo phải có tối thiểu 10 ký tự.");
      return;
    }
    setSubmitting(true);
    try {
      await api("/admin/users", "POST", {
        account: {
          username: newUsername.trim(),
          password: newPassword,
          fullName: newFullName.trim(),
          phone: newPhone.trim(),
          email: newEmail.trim(),
        },
        roleIds: [newRoleId],
      });
      log(`Thêm nhân sự mới @${newUsername}`, `Vai trò ${newRoleId}`);
      setAddModalOpen(false);
      // Reset form
      setNewUsername("");
      setNewPassword("");
      setNewFullName("");
      setNewPhone("");
      setNewEmail("");
      await loadStaff();
    } catch (err: unknown) {
      setFormError(err instanceof ApiError ? err.message : "Thêm nhân viên thất bại.");
    } finally {
      setSubmitting(false);
    }
  };

  // Edit Staff Profile & Roles
  const handleEditStaff = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!editTarget) return;
    setFormError("");
    setSubmitting(true);
    try {
      // 1. Update personal info
      await api(`/admin/users/${editTarget.userId}`, "PATCH", {
        fullName: editFullName.trim(),
        email: editEmail.trim(),
        phone: editPhone.trim(),
        gender: editGender,
      });

      // 2. Update role
      await api(`/admin/users/${editTarget.userId}/roles`, "PUT", {
        roleIds: [editRoleId],
      });

      log(`Cập nhật hồ sơ nhân sự @${editTarget.username}`, `Cập nhật thông tin & vai trò`);
      setEditTarget(null);
      await loadStaff();
    } catch (err: unknown) {
      setFormError(err instanceof ApiError ? err.message : "Cập nhật nhân viên thất bại.");
    } finally {
      setSubmitting(false);
    }
  };

  // Toggle Staff Lock/Unlock Status
  const handleToggleStatus = async () => {
    if (!statusTarget) return;
    setSubmitting(true);
    const nextStatus = statusTarget.status === "HOAT_DONG" ? "KHOA_TAM_THOI" : "HOAT_DONG";
    try {
      await api(`/admin/users/${statusTarget.userId}/status`, "PATCH", {
        status: nextStatus,
      });
      log(
        `${nextStatus === "KHOA_TAM_THOI" ? "Khóa" : "Mở khóa"} tài khoản nhân sự @${statusTarget.username}`,
        `Cập nhật trạng thái người dùng ${statusTarget.userId}`
      );
      setStatusTarget(null);
      await loadStaff();
    } catch (err) {
      console.error("Lỗi cập nhật trạng thái nhân sự:", err);
    } finally {
      setSubmitting(false);
    }
  };

  // Delete Staff
  const handleDeleteStaff = async () => {
    if (!deleteTarget) return;
    setSubmitting(true);
    try {
      const res = await api<{ deleted: boolean; message?: string }>(
        `/admin/users/${deleteTarget.userId}`,
        "DELETE"
      );
      log(`Xóa nhân sự @${deleteTarget.username}`, res.message || "Xóa tài khoản khỏi hệ thống");
      setDeleteTarget(null);
      await loadStaff();
    } catch (err: unknown) {
      console.error("Lỗi xóa nhân sự:", err);
    } finally {
      setSubmitting(false);
    }
  };

  // Step 1: Send OTP for staff password reset
  const handleSendStaffOtp = async () => {
    if (!otpResetTarget) return;
    setOtpResetError("");
    try {
      const res = await api<{ requestId: string }>("/auth/forgot-password", "POST", {
        email: otpResetTarget.email,
      });
      setOtpRequestId(res.requestId);
      setOtpSent(true);
      setOtpCooldown(60);
    } catch (err: unknown) {
      setOtpResetError(err instanceof ApiError ? err.message : "Không thể gửi OTP về email nhân viên.");
    }
  };

  // Step 2: Admin enters OTP and sets new password for staff
  const handleConfirmStaffPasswordReset = () => {
    if (!otpResetTarget) return;
    setOtpResetError("");
    if (!otpCode.trim() || otpCode.trim().length !== 6) {
      setOtpResetError("Vui lòng nhập đúng mã OTP 6 chữ số.");
      return;
    }
    if (staffNewPassword.length < 10) {
      setOtpResetError("Mật khẩu mới phải có tối thiểu 10 ký tự.");
      return;
    }
    if (staffNewPassword !== staffConfirmPassword) {
      setOtpResetError("Mật khẩu xác nhận không khớp.");
      return;
    }

    startResetTransition(async () => {
      try {
        await api("/auth/reset-password", "POST", {
          requestId: otpRequestId,
          email: otpResetTarget.email,
          otp: otpCode.trim(),
          newPassword: staffNewPassword,
        });
        log(
          `Đổi mật khẩu thành công cho nhân sự @${otpResetTarget.username}`,
          "Đổi mật khẩu qua xác thực OTP email"
        );
        pushToast({
          tone: "success",
          title: `Đã đổi mật khẩu cho nhân sự ${otpResetTarget.fullName}!`,
          detail: "Nhân viên có thể dùng mật khẩu mới để đăng nhập ngay.",
        });
        setOtpResetTarget(null);
        setOtpSent(false);
        setOtpCode("");
        setStaffNewPassword("");
        setStaffConfirmPassword("");
      } catch (err: unknown) {
        setOtpResetError(err instanceof ApiError ? err.message : "Mã OTP không chính xác hoặc đã hết hạn.");
      }
    });
  };

  const filteredStaff = staffList.filter((s) =>
    `${s.username} ${s.fullName} ${s.phone} ${s.email}`
      .toLowerCase()
      .includes(staffSearch.toLowerCase())
  );
  const totalStaffPages = Math.max(1, Math.ceil(filteredStaff.length / STAFF_PAGE_SIZE));
  const safeStaffPage = Math.min(staffPage, totalStaffPages);
  const paginatedStaff = filteredStaff.slice(
    (safeStaffPage - 1) * STAFF_PAGE_SIZE,
    safeStaffPage * STAFF_PAGE_SIZE
  );

  const filteredShifts = shifts.filter((s) => {
    return shiftFilter === "ALL" || s.status === shiftFilter;
  });
  const totalShiftPages = Math.max(1, Math.ceil(filteredShifts.length / SHIFT_PAGE_SIZE));
  const safeShiftPage = Math.min(shiftPage, totalShiftPages);
  const paginatedShifts = filteredShifts.slice(
    (safeShiftPage - 1) * SHIFT_PAGE_SIZE,
    safeShiftPage * SHIFT_PAGE_SIZE
  );

  const filteredMovements = movements.filter((m) => {
    const matchType = movementTypeFilter === "ALL" || m.type === movementTypeFilter;
    const matchSearch = `${m.productName} ${m.color} ${m.size} ${m.reason || ""} ${m.referenceId || ""} ${m.performerName || ""}`
      .toLowerCase()
      .includes(movementSearch.toLowerCase());
    return matchType && matchSearch;
  });
  const totalMovementPages = Math.max(1, Math.ceil(filteredMovements.length / MOVEMENT_PAGE_SIZE));
  const safeMovementPage = Math.min(movementPage, totalMovementPages);
  const paginatedMovements = filteredMovements.slice(
    (safeMovementPage - 1) * MOVEMENT_PAGE_SIZE,
    safeMovementPage * MOVEMENT_PAGE_SIZE
  );

  const filteredLogs = logs.filter((l) =>
    `${l.actor} ${l.action} ${l.reason}`.toLowerCase().includes(search.toLowerCase())
  );
  const totalLogPages = Math.max(1, Math.ceil(filteredLogs.length / LOG_PAGE_SIZE));
  const safeLogPage = Math.min(logPage, totalLogPages);
  const paginatedLogs = filteredLogs.slice(
    (safeLogPage - 1) * LOG_PAGE_SIZE,
    safeLogPage * LOG_PAGE_SIZE
  );

  return (
    <>
      <PageHeading
        eyebrow="Governance · Approvals & Audit"
        title="Phê duyệt vận hành & phân quyền hệ thống"
        detail="Đối soát kết ca POS, kiểm kê kho, quản trị sổ nhân sự RBAC và nhật ký kiểm toán"
      />

      <SubTabs
        tabs={[
          { key: "shift", label: "Duyệt kết ca POS" },
          { key: "stock", label: "Duyệt kiểm kê kho" },
          { key: "staff", label: "Nhân sự & RBAC" },
          { key: "logs", label: "Nhật ký kiểm toán" },
        ]}
        active={view}
        setActive={setView}
      />

      {/* VIEW 1: SHIFT */}
      {view === "shift" && (
        <>
          <div className="mb-4 flex flex-wrap items-center justify-between gap-3">
            <div>
              <h2 className="font-semibold">Duyệt kết ca POS & Đối soát dòng tiền</h2>
              <p className="mt-1 text-xs text-muted-foreground">
                Quản lý các ca làm việc của thu ngân tại quầy, kiểm tra số tiền đếm thực tế so với sổ cái.
              </p>
            </div>
            <div className="flex items-center gap-2">
              <Button variant="outline" size="sm" onClick={loadShifts} disabled={loadingShifts}>
                <RefreshCw className={`mr-1.5 h-3.5 w-3.5 ${loadingShifts ? "animate-spin" : ""}`} />
                Làm mới dữ liệu
              </Button>
            </div>
          </div>

          <div className="mb-4 flex flex-wrap items-center gap-3">
            <select
              aria-label="Lọc theo trạng thái ca"
              className={inputClass}
              value={shiftFilter}
              onChange={(e) => {
                setShiftFilter(e.target.value);
                setShiftPage(1);
              }}
            >
              <option value="ALL">Tất cả trạng thái ca</option>
              <option value="DA_DONG_CHO_DUYET">Chờ phê duyệt kết ca</option>
              <option value="DA_DUYET">Đã phê duyệt</option>
              <option value="DANG_MO">Đang mở (đang phục vụ)</option>
            </select>
          </div>

          <div className="overflow-x-auto rounded-md border border-border bg-surface">
            <table className="admin-table">
              <thead>
                <tr>
                  <th>Mã ca</th>
                  <th>Thu ngân</th>
                  <th>Thời gian mở ca</th>
                  <th>Thời gian đóng ca</th>
                  <th>Tiền đầu ca</th>
                  <th>Tiền đếm thực tế</th>
                  <th>Trạng thái</th>
                  <th>Thao tác</th>
                </tr>
              </thead>
              <tbody>
                {paginatedShifts.map((s) => {
                  const isPending = s.status === "DA_DONG_CHO_DUYET";
                  const isApproved = s.status === "DA_DUYET";
                  return (
                    <tr
                      key={s.shiftId}
                      className="cursor-pointer transition-colors hover:bg-muted/30"
                      onClick={() => setShiftDetailModal(s)}
                    >
                      <td className="font-mono text-xs font-bold text-accent-hover">
                        {s.shiftId}
                      </td>
                      <td>
                        <p className="font-semibold">{s.cashierName}</p>
                        <p className="mt-0.5 font-mono text-xs text-muted-foreground">{s.cashierId}</p>
                      </td>
                      <td className="font-mono text-xs">
                        {s.openedAt ? s.openedAt.replace("T", " ") : "—"}
                      </td>
                      <td className="font-mono text-xs">
                        {s.closedAt ? s.closedAt.replace("T", " ") : "Chưa đóng ca"}
                      </td>
                      <td className="font-mono">{vnd(s.openingCash)}</td>
                      <td className="font-mono">
                        {s.countedCash != null ? vnd(s.countedCash) : "—"}
                      </td>
                      <td>
                        <Badge
                          tone={
                            isApproved
                              ? "success"
                              : isPending
                              ? "warning"
                              : "neutral"
                          }
                        >
                          {vnLabel(s.status)}
                        </Badge>
                      </td>
                      <td>
                        <div className="flex items-center gap-1.5" onClick={(e) => e.stopPropagation()}>
                          <Button
                            variant="ghost"
                            size="icon"
                            className="h-8 w-8 rounded-full bg-blue-50 text-blue-600 hover:bg-blue-100 hover:text-blue-700 dark:bg-blue-950/40 dark:text-blue-400"
                            title="Xem chi tiết đối soát kết ca"
                            onClick={() => setShiftDetailModal(s)}
                          >
                            <Info className="h-4 w-4" />
                          </Button>
                          {isPending && (
                            <div className="flex flex-col gap-2">
                              <Button
                                variant="success"
                                size="sm"
                                className="h-8 text-xs"
                                disabled={approvingShift}
                                onClick={() => handleApproveShift(s)}
                              >
                                <ShieldCheck className="mr-1 h-3.5 w-3.5" />
                                Duyệt ca
                              </Button>
                              <Button
                                variant="outline"
                                size="sm"
                                className="h-8 text-xs"
                                disabled={rejectingShift}
                                onClick={() => handleRejectShift(s)}
                              >
                                <Undo2 className="mr-1 h-3.5 w-3.5" />
                                Đếm lại
                              </Button>
                            </div>
                          )}
                        </div>
                      </td>
                    </tr>
                  );
                })}
                {filteredShifts.length === 0 && (
                  <tr>
                    <td colSpan={8} className="py-8 text-center text-muted-foreground">
                      {loadingShifts ? "Đang tải dữ liệu ca làm việc..." : "Không có ca làm việc nào phù hợp."}
                    </td>
                  </tr>
                )}
              </tbody>
            </table>
          </div>

          <TablePagination
            page={safeShiftPage}
            totalPages={totalShiftPages}
            totalItems={filteredShifts.length}
            pageSize={SHIFT_PAGE_SIZE}
            onPageChange={setShiftPage}
            unit="ca làm việc"
          />
          <p className="mt-3 text-xs text-muted-foreground">
            Hiển thị {filteredShifts.length} ca làm việc · Dữ liệu đồng bộ trực tiếp từ bảng <code>CaLamViecThuNgan</code>.
          </p>
        </>
      )}

      {/* VIEW 2: STOCK MOVEMENTS & AUDIT */}
      {view === "stock" && (
        <>
          <div className="mb-4 flex flex-wrap items-center justify-between gap-3">
            <div>
              <h2 className="font-semibold">Duyệt kiểm kê kho & Lịch sử biến động tồn</h2>
              <p className="mt-1 text-xs text-muted-foreground">
                Theo dõi toàn bộ lịch sử xuất - nhập - kiểm kê - hao hụt tồn kho sản phẩm.
              </p>
            </div>
            <div className="flex items-center gap-2">
              <Button variant="outline" size="sm" onClick={loadMovements} disabled={loadingMovements}>
                <RefreshCw className={`mr-1.5 h-3.5 w-3.5 ${loadingMovements ? "animate-spin" : ""}`} />
                Làm mới dữ liệu
              </Button>
            </div>
          </div>

          <div className="mb-4 grid gap-3 sm:grid-cols-[minmax(0,1fr)_200px]">
            <div className="relative">
              <Search className="absolute left-3 top-3 h-4 w-4 text-muted-foreground" />
              <input
                aria-label="Tìm kiếm biến động"
                className={`${inputClass} pl-9`}
                placeholder="Tìm theo tên SP, màu, size, lý do, người thực hiện..."
                value={movementSearch}
                onChange={(e) => {
                  setMovementSearch(e.target.value);
                  setMovementPage(1);
                }}
              />
            </div>
            <select
              aria-label="Lọc loại biến động"
              className={inputClass}
              value={movementTypeFilter}
              onChange={(e) => {
                setMovementTypeFilter(e.target.value);
                setMovementPage(1);
              }}
            >
              <option value="ALL">Tất cả loại biến động</option>
              <option value="KIEM_KE">Kiểm kê cân bằng kho</option>
              <option value="NHAP_HANG">Nhập kho bổ sung</option>
              <option value="BAN_HANG">Bán hàng (POS / Online)</option>
              <option value="TRA_HANG">Trả hàng hoàn kho</option>
              <option value="XUAT_HUY">Xuất hủy hư hỏng</option>
            </select>
          </div>

          <div className="overflow-x-auto rounded-md border border-border bg-surface">
            <table className="admin-table">
              <thead>
                <tr>
                  <th>Thời gian</th>
                  <th>Mã / Sản phẩm</th>
                  <th>Phân loại</th>
                  <th>Loại biến động</th>
                  <th>Số lượng</th>
                  <th>Tồn trước → sau</th>
                  <th>Người thực hiện</th>
                  <th>Lý do / Tham chiếu</th>
                  <th>Chi tiết</th>
                </tr>
              </thead>
              <tbody>
                {paginatedMovements.map((m) => (
                  <tr
                    key={m.movementId}
                    className="cursor-pointer transition-colors hover:bg-muted/30"
                    onClick={() => setMovementDetailModal(m)}
                  >
                    <td className="font-mono text-xs text-muted-foreground">
                      {m.createdAt ? m.createdAt.replace("T", " ") : "—"}
                    </td>
                    <td>
                      <p className="font-semibold text-foreground">{m.productName}</p>
                      <p className="mt-0.5 font-mono text-[10px] text-muted-foreground">{m.movementId}</p>
                    </td>
                    <td>
                      <Badge tone="neutral">
                        {m.color} · Size {m.size}
                      </Badge>
                    </td>
                    <td>
                      <Badge
                        tone={
                          m.type === "KIEM_KE"
                            ? "info"
                            : m.type === "NHAP_HANG" || m.type === "TRA_HANG"
                            ? "success"
                            : "warning"
                        }
                      >
                        {vnLabel(m.type)}
                      </Badge>
                    </td>
                    <td className="font-mono font-bold">
                      <span className={m.delta > 0 ? "text-success" : m.delta < 0 ? "text-destructive" : ""}>
                        {m.delta > 0 ? `+${m.delta}` : m.delta}
                      </span>
                    </td>
                    <td className="font-mono text-xs">
                      {m.beforeStock} → <strong className="text-foreground">{m.afterStock}</strong>
                    </td>
                    <td className="text-xs">{m.performerName || m.performerId || "Hệ thống"}</td>
                    <td className="max-w-[200px] truncate text-xs text-muted-foreground" title={m.reason || m.referenceId}>
                      {m.reason || m.referenceId || "—"}
                    </td>
                    <td>
                      <Button
                        variant="ghost"
                        size="icon"
                        className="h-8 w-8 rounded-full bg-blue-50 text-blue-600 hover:bg-blue-100 hover:text-blue-700 dark:bg-blue-950/40 dark:text-blue-400"
                        title="Xem chi tiết biến động"
                        onClick={(e) => {
                          e.stopPropagation();
                          setMovementDetailModal(m);
                        }}
                      >
                        <Info className="h-4 w-4" />
                      </Button>
                    </td>
                  </tr>
                ))}
                {filteredMovements.length === 0 && (
                  <tr>
                    <td colSpan={9} className="py-8 text-center text-muted-foreground">
                      {loadingMovements ? "Đang tải dữ liệu biến động kho..." : "Không có lịch sử biến động phù hợp."}
                    </td>
                  </tr>
                )}
              </tbody>
            </table>
          </div>

          <TablePagination
            page={safeMovementPage}
            totalPages={totalMovementPages}
            totalItems={filteredMovements.length}
            pageSize={MOVEMENT_PAGE_SIZE}
            onPageChange={setMovementPage}
            unit="bản ghi"
          />
          <p className="mt-3 text-xs text-muted-foreground">
            Hiển thị {filteredMovements.length} bản ghi biến động · Dữ liệu đồng bộ trực tiếp từ bảng <code>BienDongKho</code>.
          </p>
        </>
      )}

      {/* VIEW 3: STAFF & RBAC (Real CRUD + OTP Password Reset) */}
      {view === "staff" && (
        <>
          <div className="mb-4 flex flex-wrap items-center justify-between gap-3">
            <div>
              <h2 className="font-semibold">Quản lý nhân sự & Phân quyền RBAC</h2>
              <p className="mt-1 text-xs text-muted-foreground">
                Quản trị viên có toàn quyền Thêm, Sửa thông tin cá nhân, Khóa/Mở, Xóa nhân viên và Đổi mật khẩu dùm qua mã xác thực OTP.
              </p>
            </div>
            <div className="flex gap-2">
              <Button variant="outline" size="sm" onClick={loadStaff} disabled={loadingStaff}>
                <RefreshCw className={`mr-1.5 h-3.5 w-3.5 ${loadingStaff ? "animate-spin" : ""}`} />
                Làm mới
              </Button>
              <Button
                onClick={() => {
                  setFormError("");
                  setAddModalOpen(true);
                }}
              >
                <Plus />
                Thêm tài khoản nhân viên
              </Button>
            </div>
          </div>

          <div className="mb-4 max-w-md">
            <div className="relative">
              <Search className="absolute left-3 top-3 h-4 w-4 text-muted-foreground" />
              <input
                aria-label="Tìm nhân viên"
                className={`${inputClass} pl-9`}
                placeholder="Tìm nhân viên theo tên, email, SĐT, username..."
                value={staffSearch}
                onChange={(e) => {
                  setStaffSearch(e.target.value);
                  setStaffPage(1);
                }}
              />
            </div>
          </div>

          <div className="overflow-x-auto rounded-md border border-border bg-surface">
            <table className="admin-table">
              <thead>
                <tr>
                  <th>Tên đăng nhập / Mã</th>
                  <th>Họ tên & Email</th>
                  <th>Số điện thoại</th>
                  <th>Vai trò (RBAC)</th>
                  <th>Địa chỉ liên hệ</th>
                  <th>Trạng thái</th>
                  <th>Thao tác quản trị</th>
                </tr>
              </thead>
              <tbody>
                {paginatedStaff.map((s) => {
                  const isLocked = s.status === "KHOA_TAM_THOI";
                  const primaryRole = s.roles?.[0]?.name || "ROLE_STAFF_CASHIER";
                  const roleLabel = s.roles?.[0]?.label || STAFF_ROLE_LABELS[primaryRole as StaffRole] || primaryRole;

                  return (
                    <tr
                      key={s.userId}
                      className="cursor-pointer transition-colors hover:bg-muted/30"
                      onClick={() => setStaffDetailModal(s)}
                    >
                      <td>
                        <strong className="font-mono text-xs text-accent-hover">@{s.username}</strong>
                        <p className="mt-0.5 font-mono text-[10px] text-muted-foreground">{s.userId}</p>
                      </td>
                      <td>
                        <p className="font-semibold text-foreground">{s.fullName}</p>
                        <p className="mt-0.5 font-mono text-xs text-muted-foreground">{s.email}</p>
                      </td>
                      <td className="font-mono text-xs">{s.phone}</td>
                      <td>
                        <div className="w-40">
                          <Badge tone="info">{roleLabel}</Badge>
                        </div>
                      </td>
                      <td className="max-w-[180px] truncate text-xs" title={s.address}>
                        {s.address || "Chưa có địa chỉ"}
                      </td>
                      <td>
                        <Badge tone={isLocked ? "danger" : "success"}>
                          {vnLabel(isLocked ? "KHOA_TAM_THOI" : "HOAT_DONG")}
                        </Badge>
                      </td>
                      <td>
                        <div className="flex flex-col gap-1.5 items-start" onClick={(e) => e.stopPropagation()}>
                          {/* Hàng 1: Icon Cây bút - Ổ khóa - Thùng rác */}
                          <div className="flex items-center gap-1">
                            <Button
                              variant="ghost"
                              size="icon"
                              className="h-8 w-8 text-foreground hover:bg-muted"
                              title="Chỉnh sửa thông tin nhân viên"
                              onClick={() => {
                                setFormError("");
                                setEditTarget(s);
                                setEditFullName(s.fullName);
                                setEditPhone(s.phone);
                                setEditEmail(s.email);
                                setEditGender(s.gender || "NAM");
                                setEditRoleId(s.roles?.[0]?.roleId || "VT003");
                              }}
                            >
                              <Pencil className="h-4 w-4" />
                            </Button>

                            <Button
                              variant="ghost"
                              size="icon"
                              className="h-8 w-8"
                              aria-label={isLocked ? "Mở khóa nhân viên" : "Khóa tài khoản nhân viên"}
                              title={isLocked ? "Mở khóa tài khoản" : "Khóa tài khoản"}
                              onClick={() => setStatusTarget(s)}
                            >
                              {isLocked ? (
                                <Unlock className="h-4 w-4 text-success" />
                              ) : (
                                <LockKeyhole className="h-4 w-4 text-warning" />
                              )}
                            </Button>

                            <Button
                              variant="ghost"
                              size="icon"
                              className="h-8 w-8 text-destructive hover:bg-danger-subtle"
                              aria-label={`Xóa nhân viên ${s.fullName}`}
                              title="Xóa tài khoản nhân viên"
                              onClick={() => setDeleteTarget(s)}
                            >
                              <Trash2 className="h-4 w-4" />
                            </Button>
                          </div>

                          {/* Hàng 2: Button "Đổi mật khẩu" có icon chìa khóa nằm dưới */}
                          <Button
                            variant="outline"
                            size="sm"
                            className="h-7 px-2 text-xs gap-1 border-accent/40 text-accent-hover hover:bg-accent-subtle"
                            title="Đổi mật khẩu dùm nhân viên (xác thực qua OTP)"
                            onClick={() => {
                              setOtpResetError("");
                              setOtpSent(false);
                              setOtpCode("");
                              setStaffNewPassword("");
                              setStaffConfirmPassword("");
                              setOtpResetTarget(s);
                            }}
                          >
                            <KeyRound className="h-3 w-3" />
                            Đổi mật khẩu
                          </Button>
                        </div>
                      </td>
                    </tr>
                  );
                })}
                {filteredStaff.length === 0 && (
                  <tr>
                    <td colSpan={7} className="py-8 text-center text-muted-foreground">
                      {loadingStaff ? "Đang tải dữ liệu từ máy chủ..." : "Không có nhân viên phù hợp."}
                    </td>
                  </tr>
                )}
              </tbody>
            </table>
          </div>
          <TablePagination
            page={safeStaffPage}
            totalPages={totalStaffPages}
            totalItems={filteredStaff.length}
            pageSize={STAFF_PAGE_SIZE}
            onPageChange={setStaffPage}
            unit="nhân viên"
          />
          <p className="mt-3 text-xs text-muted-foreground">
            Hiển thị {filteredStaff.length} tài khoản nhân viên · Mật khẩu được mã hóa một chiều bằng BCrypt và tuyệt đối không bao giờ hiển thị trực quan trong bất kỳ bảng nào.
          </p>
        </>
      )}

      {/* VIEW 4: AUDIT LOGS */}
      {view === "logs" && (
        <>
          <div className="relative mb-4 max-w-md">
            <Search className="absolute left-3 top-3 h-4 w-4 text-muted-foreground" />
            <input
              aria-label="Tìm nhật ký"
              className={`${inputClass} pl-9`}
              placeholder="Nhân viên, hành động, mã đơn…"
              value={search}
              onChange={(e) => {
                setSearch(e.target.value);
                setLogPage(1);
              }}
            />
          </div>
          <div className="overflow-x-auto rounded-md border border-border bg-surface">
            <table className="admin-table">
              <thead>
                <tr>
                  <th>Thời gian</th>
                  <th>Nhân viên</th>
                  <th>Hành động trọng yếu</th>
                  <th>Lý do / Chi tiết</th>
                  <th>Xem</th>
                </tr>
              </thead>
              <tbody>
                {paginatedLogs.map((l) => (
                  <tr
                    key={l.id}
                    className="cursor-pointer transition-colors hover:bg-muted/30"
                    onClick={() => setLogDetailModal(l)}
                  >
                    <td className="font-mono text-xs">{l.time}</td>
                    <td className="text-xs">{l.actor}</td>
                    <td className="font-semibold">{l.action}</td>
                    <td className="max-w-xs truncate text-xs text-muted-foreground">{l.reason}</td>
                    <td>
                      <Button
                        variant="ghost"
                        size="icon"
                        className="h-7 w-7 rounded-full bg-blue-50 text-blue-600 hover:bg-blue-100 dark:bg-blue-950/40"
                        title="Xem chi tiết sự kiện audit"
                        onClick={(e) => {
                          e.stopPropagation();
                          setLogDetailModal(l);
                        }}
                      >
                        <Info className="h-3.5 w-3.5" />
                      </Button>
                    </td>
                  </tr>
                ))}
                {filteredLogs.length === 0 && (
                  <tr>
                    <td colSpan={5} className="py-8 text-center text-muted-foreground">
                      Không tìm thấy sự kiện kiểm toán phù hợp.
                    </td>
                  </tr>
                )}
              </tbody>
            </table>
          </div>
          <TablePagination
            page={safeLogPage}
            totalPages={totalLogPages}
            totalItems={filteredLogs.length}
            pageSize={LOG_PAGE_SIZE}
            onPageChange={setLogPage}
            unit="sự kiện"
          />
          <p className="mt-3 text-xs text-muted-foreground">
            {filteredLogs.length} sự kiện kiểm toán hệ thống.
          </p>
        </>
      )}

      {/* MODAL 1: CREATE STAFF */}
      {addModalOpen && (
        <Dialog open onOpenChange={setAddModalOpen}>
          <DialogContent className="max-w-lg">
            <DialogTitle>Thêm tài khoản nhân viên mới</DialogTitle>
            <DialogDescription>
              Tạo hồ sơ và cấp quyền phân hệ.
            </DialogDescription>
            <form onSubmit={handleCreateStaff} className="space-y-4 pt-2">
              {formError && (
                <div className="rounded-lg border border-destructive/30 bg-danger-subtle p-3 text-xs text-destructive flex items-center gap-2">
                  <ShieldAlert className="h-4 w-4 shrink-0" />
                  <span>{formError}</span>
                </div>
              )}
              <div className="grid gap-3 sm:grid-cols-2">
                <Field label="Tên đăng nhập (4-15 ký tự)">
                  <input
                    required
                    pattern="[A-Za-z][A-Za-z0-9]{3,14}"
                    placeholder="vd: staffhuong"
                    className={inputClass}
                    value={newUsername}
                    onChange={(e) => setNewUsername(e.target.value.toLowerCase().replace(/[^a-z0-9]/g, ""))}
                  />
                </Field>
                <Field label="Mật khẩu khởi tạo (≥10 ký tự)">
                  <input
                    required
                    type="password"
                    placeholder="Mật khẩu ban đầu"
                    className={inputClass}
                    value={newPassword}
                    onChange={(e) => setNewPassword(e.target.value)}
                  />
                </Field>
                <Field label="Họ và tên">
                  <input
                    required
                    placeholder="Nguyễn Văn A"
                    className={inputClass}
                    value={newFullName}
                    onChange={(e) => setNewFullName(e.target.value)}
                  />
                </Field>
                <Field label="Số điện thoại liên hệ">
                  <input
                    required
                    type="tel"
                    placeholder="090xxxxxxx"
                    className={inputClass}
                    value={newPhone}
                    onChange={(e) => setNewPhone(e.target.value)}
                  />
                </Field>
                <Field label="Email nhân sự">
                  <input
                    required
                    type="email"
                    placeholder="staff@yofaso.vn"
                    className={inputClass}
                    value={newEmail}
                    onChange={(e) => setNewEmail(e.target.value)}
                  />
                </Field>
                <Field label="Vai trò phân công">
                  <select
                    className={inputClass}
                    value={newRoleId}
                    onChange={(e) => setNewRoleId(e.target.value)}
                  >
                    {ROLE_OPTIONS.map((r) => (
                      <option key={r.id} value={r.id}>
                        {r.label}
                      </option>
                    ))}
                  </select>
                </Field>
              </div>
              <div className="flex justify-end gap-2 pt-3">
                <Button type="button" variant="outline" onClick={() => setAddModalOpen(false)}>
                  Hủy bỏ
                </Button>
                <Button type="submit" disabled={submitting}>
                  {submitting && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
                  Tạo tài khoản nhân viên
                </Button>
              </div>
            </form>
          </DialogContent>
        </Dialog>
      )}

      {/* MODAL 2: EDIT STAFF */}
      {editTarget && (
        <Dialog open onOpenChange={(open) => !open && setEditTarget(null)}>
          <DialogContent className="max-w-lg">
            <DialogTitle>Chỉnh sửa thông tin nhân viên @{editTarget.username}</DialogTitle>
            <DialogDescription>
              Admin có thể cập nhật thông tin cá nhân và vai trò phân quyền dùm nhân viên.
            </DialogDescription>
            <form onSubmit={handleEditStaff} className="space-y-4 pt-2">
              {formError && (
                <div className="rounded-lg border border-destructive/30 bg-danger-subtle p-3 text-xs text-destructive flex items-center gap-2">
                  <ShieldAlert className="h-4 w-4 shrink-0" />
                  <span>{formError}</span>
                </div>
              )}
              <div className="grid gap-3 sm:grid-cols-2">
                <Field label="Họ và tên">
                  <input
                    required
                    className={inputClass}
                    value={editFullName}
                    onChange={(e) => setEditFullName(e.target.value)}
                  />
                </Field>
                <Field label="Số điện thoại">
                  <input
                    required
                    type="tel"
                    className={inputClass}
                    value={editPhone}
                    onChange={(e) => setEditPhone(e.target.value)}
                  />
                </Field>
                <Field label="Email">
                  <input
                    required
                    type="email"
                    className={inputClass}
                    value={editEmail}
                    onChange={(e) => setEditEmail(e.target.value)}
                  />
                </Field>
                <Field label="Giới tính">
                  <select
                    className={inputClass}
                    value={editGender}
                    onChange={(e) => setEditGender(e.target.value)}
                  >
                    <option value="NAM">Nam</option>
                    <option value="NU">Nữ</option>
                    <option value="KHAC">Khác</option>
                  </select>
                </Field>
                <div className="sm:col-span-2">
                  <Field label="Vai trò phân quyền hệ thống">
                    <select
                      className={inputClass}
                      value={editRoleId}
                      onChange={(e) => setEditRoleId(e.target.value)}
                    >
                      {ROLE_OPTIONS.map((r) => (
                        <option key={r.id} value={r.id}>
                          {r.label} ({r.role})
                        </option>
                      ))}
                    </select>
                  </Field>
                </div>
              </div>
              <div className="flex justify-end gap-2 pt-3">
                <Button type="button" variant="outline" onClick={() => setEditTarget(null)}>
                  Hủy bỏ
                </Button>
                <Button type="submit" disabled={submitting}>
                  {submitting && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
                  Lưu thay đổi
                </Button>
              </div>
            </form>
          </DialogContent>
        </Dialog>
      )}

      {/* MODAL 3: ADMIN RESETS PASSWORD FOR STAFF WITH OTP */}
      {otpResetTarget && (
        <Dialog open onOpenChange={(open) => !open && setOtpResetTarget(null)}>
          <DialogContent className="max-w-lg">
            <DialogTitle className="flex items-center gap-2">
              <KeyRound className="h-5 w-5 text-accent-hover" />
              Đổi mật khẩu cho nhân sự @{otpResetTarget.username}
            </DialogTitle>
            <DialogDescription>
              Hệ thống bắt buộc xác thực mã OTP gửi về email nhân sự (<code>{otpResetTarget.email}</code>) để đảm bảo an toàn truy cập.
            </DialogDescription>

            <div className="space-y-4 pt-2">
              {otpResetError && (
                <div className="rounded-lg border border-destructive/30 bg-danger-subtle p-3 text-xs text-destructive flex items-center gap-2">
                  <ShieldAlert className="h-4 w-4 shrink-0" />
                  <span>{otpResetError}</span>
                </div>
              )}

              {!otpSent ? (
                <div className="rounded-xl border border-border bg-surface-muted/50 p-4 space-y-3">
                  <p className="text-xs text-muted-foreground leading-relaxed">
                    Nhân viên <strong>{otpResetTarget.fullName}</strong> quên mật khẩu? Bấm nút bên dưới để gửi mã OTP 6 số xác thực đến hộp thư của nhân viên.
                  </p>
                  <Button
                    type="button"
                    variant="outline"
                    disabled={otpCooldown > 0}
                    onClick={handleSendStaffOtp}
                    className="border-accent text-accent-hover hover:bg-accent-subtle"
                  >
                    {otpCooldown > 0
                      ? `Chờ gửi lại (${otpCooldown}s)`
                      : `Gửi mã OTP đến ${otpResetTarget.email}`}
                  </Button>
                </div>
              ) : (
                <div className="space-y-3">
                  <div className="rounded-lg bg-success-subtle border border-success/30 p-3 text-xs text-success flex items-center gap-2">
                    <CheckCircle2 className="h-4 w-4 shrink-0" />
                    <span>Mã OTP đã được gửi đến {otpResetTarget.email}. Hãy yêu cầu nhân viên đọc mã 6 số.</span>
                  </div>

                  <Field label="Mã OTP 6 chữ số (từ email nhân viên)">
                    <input
                      maxLength={6}
                      placeholder="123456"
                      className={`${inputClass} font-mono text-center text-base font-bold tracking-widest`}
                      value={otpCode}
                      onChange={(e) => setOtpCode(e.target.value.replace(/\D/g, ""))}
                    />
                  </Field>

                  <div className="grid gap-3 sm:grid-cols-2">
                    <Field label="Mật khẩu mới (≥10 ký tự)">
                      <input
                        type="password"
                        placeholder="Mật khẩu mới"
                        className={inputClass}
                        value={staffNewPassword}
                        onChange={(e) => setStaffNewPassword(e.target.value)}
                      />
                    </Field>
                    <Field label="Xác nhận mật khẩu">
                      <input
                        type="password"
                        placeholder="Nhập lại mật khẩu"
                        className={inputClass}
                        value={staffConfirmPassword}
                        onChange={(e) => setStaffConfirmPassword(e.target.value)}
                      />
                    </Field>
                  </div>

                  <div className="flex flex-wrap items-center justify-between gap-2 pt-3">
                    <Button
                      type="button"
                      variant="ghost"
                      size="sm"
                      disabled={otpCooldown > 0}
                      onClick={handleSendStaffOtp}
                      className="text-xs text-muted-foreground"
                    >
                      {otpCooldown > 0 ? `Gửi lại OTP (${otpCooldown}s)` : "Chưa nhận được mã? Gửi lại"}
                    </Button>
                    <div className="flex gap-2">
                      <Button type="button" variant="outline" onClick={() => setOtpResetTarget(null)}>
                        Hủy bỏ
                      </Button>
                      <Button
                        type="button"
                        disabled={resettingPassword || !otpCode || !staffNewPassword}
                        onClick={handleConfirmStaffPasswordReset}
                      >
                        {resettingPassword && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
                        Cập nhật mật khẩu
                      </Button>
                    </div>
                  </div>
                </div>
              )}
            </div>
          </DialogContent>
        </Dialog>
      )}

      {/* CONFIRM DIALOG: LOCK / UNLOCK STAFF */}
      {statusTarget && (
        <ConfirmDialog
          open={Boolean(statusTarget)}
          title={
            statusTarget.status === "HOAT_DONG"
              ? `Xác nhận khóa tài khoản nhân viên?`
              : `Xác nhận mở khóa tài khoản nhân viên?`
          }
          description={
            statusTarget.status === "HOAT_DONG" ? (
              <span>
                Nhân viên <strong>{statusTarget.fullName}</strong> (@{statusTarget.username}) sẽ bị khóa quyền truy cập cổng POS/Kho/Vận chuyển.
              </span>
            ) : (
              <span>
                Kích hoạt lại trạng thái hoạt động cho nhân viên <strong>{statusTarget.fullName}</strong> (@{statusTarget.username}).
              </span>
            )
          }
          tone={statusTarget.status === "HOAT_DONG" ? "warning" : "success"}
          confirmLabel={statusTarget.status === "HOAT_DONG" ? "Khóa tài khoản" : "Mở khóa tài khoản"}
          loading={submitting}
          onConfirm={handleToggleStatus}
          onClose={() => setStatusTarget(null)}
        />
      )}

      {/* CONFIRM DIALOG: DELETE STAFF */}
      {deleteTarget && (
        <ConfirmDialog
          open={Boolean(deleteTarget)}
          title={`Xác nhận xóa nhân sự @${deleteTarget.username}?`}
          description={
            <span>
              Hành động này sẽ xóa hoặc khóa bảo toàn hồ sơ nhân sự của <strong>{deleteTarget.fullName}</strong>. Nếu nhân viên đã từng tạo đơn hàng hoặc ca làm việc, hệ thống sẽ tự động khóa để bảo toàn dữ liệu lịch sử đối soát.
            </span>
          }
          tone="danger"
          confirmLabel="Xác nhận xóa / khóa"
          loading={submitting}
          onConfirm={handleDeleteStaff}
          onClose={() => setDeleteTarget(null)}
        />
      )}

      {recount && (
        <Dialog open onOpenChange={setRecount}>
          <DialogContent>
            <DialogTitle>Yêu cầu đếm lại CA000001</DialogTitle>
            <DialogDescription>Ghi rõ nội dung thu ngân cần kiểm tra lại.</DialogDescription>
            <Field label="Lý do">
              <textarea
                className={`${inputClass} h-24 py-2`}
                value={reason}
                onChange={(e) => setReason(e.target.value)}
              />
            </Field>
            <Button
              disabled={!reason.trim()}
              onClick={() => {
                setRecount(false);
                setShift("YEU_CAU_DEM_LAI");
                log("Yêu cầu đếm lại CA000001", reason);
              }}
            >
              Gửi yêu cầu
            </Button>
          </DialogContent>
        </Dialog>
      )}

      {/* MODAL: STAFF DETAIL */}
      {staffDetailModal && (
        <Dialog open onOpenChange={(open) => !open && setStaffDetailModal(null)}>
          <DialogContent className="max-w-lg">
            <DialogTitle>Hồ sơ nhân sự: {staffDetailModal.fullName}</DialogTitle>
            <DialogDescription>
              Thông tin chi tiết tài khoản nhân sự và phân quyền hệ thống nội bộ.
            </DialogDescription>
            <div className="grid gap-3 pt-2 text-sm sm:grid-cols-2">
              <div className="rounded-lg border border-border bg-muted/20 p-3">
                <p className="text-xs text-muted-foreground">Mã nhân viên</p>
                <p className="font-mono font-bold text-foreground">{staffDetailModal.userId}</p>
              </div>
              <div className="rounded-lg border border-border bg-muted/20 p-3">
                <p className="text-xs text-muted-foreground">Tên đăng nhập</p>
                <p className="font-mono font-bold text-accent">@{staffDetailModal.username}</p>
              </div>
              <div className="rounded-lg border border-border bg-muted/20 p-3">
                <p className="text-xs text-muted-foreground">Họ và tên</p>
                <p className="font-semibold text-foreground">{staffDetailModal.fullName}</p>
              </div>
              <div className="rounded-lg border border-border bg-muted/20 p-3">
                <p className="text-xs text-muted-foreground">Số điện thoại</p>
                <p className="font-mono text-foreground">{staffDetailModal.phone || "—"}</p>
              </div>
              <div className="rounded-lg border border-border bg-muted/20 p-3">
                <p className="text-xs text-muted-foreground">Email nội bộ</p>
                <p className="font-mono text-foreground truncate">{staffDetailModal.email || "—"}</p>
              </div>
              <div className="rounded-lg border border-border bg-muted/20 p-3">
                <p className="text-xs text-muted-foreground">Giới tính</p>
                <p className="font-semibold text-foreground">{staffDetailModal.gender === "NU" ? "Nữ" : "Nam"}</p>
              </div>
              <div className="rounded-lg border border-border bg-muted/20 p-3 sm:col-span-2">
                <p className="text-xs text-muted-foreground">Vai trò & Phân quyền RBAC</p>
                <div className="mt-1 flex flex-wrap gap-1.5">
                  {staffDetailModal.roles?.map((r) => (
                    <Badge key={r.roleId} tone="info">
                      {r.label || r.name} ({r.roleId})
                    </Badge>
                  ))}
                </div>
              </div>
              <div className="rounded-lg border border-border bg-muted/20 p-3 sm:col-span-2">
                <p className="text-xs text-muted-foreground">Địa chỉ liên hệ</p>
                <p className="text-foreground">{staffDetailModal.address || "Chưa thiết lập"}</p>
              </div>
              <div className="rounded-lg border border-border bg-muted/20 p-3 sm:col-span-2">
                <p className="text-xs text-muted-foreground">Trạng thái tài khoản</p>
                <div className="mt-1">
                  <Badge tone={staffDetailModal.status === "KHOA_TAM_THOI" ? "danger" : "success"}>
                    {staffDetailModal.status === "KHOA_TAM_THOI" ? "Đã khóa tạm thời" : "Đang hoạt động"}
                  </Badge>
                </div>
              </div>
            </div>
            <div className="flex justify-end pt-3">
              <Button variant="outline" onClick={() => setStaffDetailModal(null)}>
                Đóng
              </Button>
            </div>
          </DialogContent>
        </Dialog>
      )}

      {/* MODAL: SHIFT DETAIL */}
      {shiftDetailModal && (
        <Dialog open onOpenChange={(open) => !open && setShiftDetailModal(null)}>
          <DialogContent className="max-w-lg">
            <DialogTitle>Chi tiết ca làm việc: {shiftDetailModal.shiftId}</DialogTitle>
            <DialogDescription>
              Thông tin kiểm đếm tiền mặt và đối soát ca làm việc thu ngân tại quầy.
            </DialogDescription>
            <div className="grid gap-3 pt-2 text-sm sm:grid-cols-2">
              <div className="rounded-lg border border-border bg-muted/20 p-3">
                <p className="text-xs text-muted-foreground">Mã ca làm việc</p>
                <p className="font-mono font-bold text-accent">{shiftDetailModal.shiftId}</p>
              </div>
              <div className="rounded-lg border border-border bg-muted/20 p-3">
                <p className="text-xs text-muted-foreground">Thu ngân phụ trách</p>
                <p className="font-semibold text-foreground">{shiftDetailModal.cashierName}</p>
                <p className="font-mono text-xs text-muted-foreground">{shiftDetailModal.cashierId}</p>
              </div>
              <div className="rounded-lg border border-border bg-muted/20 p-3">
                <p className="text-xs text-muted-foreground">Thời gian mở ca</p>
                <p className="font-mono text-xs text-foreground">{shiftDetailModal.openedAt?.replace("T", " ") || "—"}</p>
              </div>
              <div className="rounded-lg border border-border bg-muted/20 p-3">
                <p className="text-xs text-muted-foreground">Thời gian đóng ca</p>
                <p className="font-mono text-xs text-foreground">{shiftDetailModal.closedAt?.replace("T", " ") || "Chưa đóng ca"}</p>
              </div>
              <div className="rounded-lg border border-border bg-muted/20 p-3">
                <p className="text-xs text-muted-foreground">Tiền mặt đầu ca</p>
                <p className="font-mono font-bold text-foreground">{vnd(shiftDetailModal.openingCash)}</p>
              </div>
              <div className="rounded-lg border border-border bg-muted/20 p-3">
                <p className="text-xs text-muted-foreground">Tiền mặt đếm thực tế</p>
                <p className="font-mono font-bold text-foreground">
                  {shiftDetailModal.countedCash != null ? vnd(shiftDetailModal.countedCash) : "Chưa kiểm đếm"}
                </p>
              </div>
              <div className="rounded-lg border border-border bg-muted/20 p-3">
                <p className="text-xs text-muted-foreground">Trạng thái ca</p>
                <div className="mt-1">
                  <Badge tone={shiftDetailModal.status === "DA_DUYET" ? "success" : shiftDetailModal.status === "DA_DONG_CHO_DUYET" ? "warning" : "neutral"}>
                    {vnLabel(shiftDetailModal.status)}
                  </Badge>
                </div>
              </div>
              <div className="rounded-lg border border-border bg-muted/20 p-3">
                <p className="text-xs text-muted-foreground">Chênh lệch tiền mặt</p>
                <p className="font-mono font-bold text-foreground">
                  {shiftDetailModal.countedCash != null ? vnd(shiftDetailModal.countedCash - shiftDetailModal.openingCash) : "0 đ"}
                </p>
              </div>
              {shiftDetailModal.note && (
                <div className="rounded-lg border border-border bg-muted/20 p-3 sm:col-span-2">
                  <p className="text-xs text-muted-foreground">Ghi chú giải trình của thu ngân</p>
                  <p className="text-foreground">{shiftDetailModal.note}</p>
                </div>
              )}
            </div>
            <div className="flex justify-between items-center pt-3">
              <div className="flex gap-2">
                {shiftDetailModal.status === "DA_DONG_CHO_DUYET" && (
                  <>
                    <Button
                      variant="success"
                      size="sm"
                      disabled={approvingShift}
                      onClick={() => handleApproveShift(shiftDetailModal)}
                    >
                      <ShieldCheck className="mr-1 h-3.5 w-3.5" />
                      Duyệt đóng ca
                    </Button>
                    <Button
                      variant="outline"
                      size="sm"
                      disabled={rejectingShift}
                      onClick={() => handleRejectShift(shiftDetailModal)}
                    >
                      <Undo2 className="mr-1 h-3.5 w-3.5" />
                      Yêu cầu đếm lại
                    </Button>
                  </>
                )}
              </div>
              <Button variant="outline" onClick={() => setShiftDetailModal(null)}>
                Đóng
              </Button>
            </div>
          </DialogContent>
        </Dialog>
      )}

      {/* MODAL: MOVEMENT DETAIL */}
      {movementDetailModal && (
        <Dialog open onOpenChange={(open) => !open && setMovementDetailModal(null)}>
          <DialogContent className="max-w-lg">
            <DialogTitle>Chi tiết biến động kho: {movementDetailModal.movementId}</DialogTitle>
            <DialogDescription>
              Dữ liệu biến động tồn kho chi tiết ghi nhận trong cơ sở dữ liệu.
            </DialogDescription>
            <div className="grid gap-3 pt-2 text-sm sm:grid-cols-2">
              <div className="rounded-lg border border-border bg-muted/20 p-3">
                <p className="text-xs text-muted-foreground">Mã biến động</p>
                <p className="font-mono font-bold text-accent">{movementDetailModal.movementId}</p>
              </div>
              <div className="rounded-lg border border-border bg-muted/20 p-3">
                <p className="text-xs text-muted-foreground">Thời gian thực hiện</p>
                <p className="font-mono text-xs text-foreground">{movementDetailModal.createdAt?.replace("T", " ") || "—"}</p>
              </div>
              <div className="rounded-lg border border-border bg-muted/20 p-3 sm:col-span-2">
                <p className="text-xs text-muted-foreground">Sản phẩm & Biến thể</p>
                <p className="font-semibold text-foreground">{movementDetailModal.productName}</p>
                <div className="mt-1 flex items-center gap-2">
                  <Badge tone="neutral">Màu {movementDetailModal.color}</Badge>
                  <Badge tone="neutral">Size {movementDetailModal.size}</Badge>
                  <span className="font-mono text-xs text-muted-foreground">{movementDetailModal.variantId}</span>
                </div>
              </div>
              <div className="rounded-lg border border-border bg-muted/20 p-3">
                <p className="text-xs text-muted-foreground">Loại biến động</p>
                <div className="mt-1">
                  <Badge tone="info">{vnLabel(movementDetailModal.type)}</Badge>
                </div>
              </div>
              <div className="rounded-lg border border-border bg-muted/20 p-3">
                <p className="text-xs text-muted-foreground">Số lượng thay đổi</p>
                <p className="font-mono font-bold text-lg">
                  <span className={movementDetailModal.delta > 0 ? "text-success" : movementDetailModal.delta < 0 ? "text-destructive" : ""}>
                    {movementDetailModal.delta > 0 ? `+${movementDetailModal.delta}` : movementDetailModal.delta}
                  </span>
                </p>
              </div>
              <div className="rounded-lg border border-border bg-muted/20 p-3">
                <p className="text-xs text-muted-foreground">Tồn trước biến động</p>
                <p className="font-mono font-bold text-foreground">{movementDetailModal.beforeStock}</p>
              </div>
              <div className="rounded-lg border border-border bg-muted/20 p-3">
                <p className="text-xs text-muted-foreground">Tồn sau biến động</p>
                <p className="font-mono font-bold text-foreground text-success">{movementDetailModal.afterStock}</p>
              </div>
              <div className="rounded-lg border border-border bg-muted/20 p-3">
                <p className="text-xs text-muted-foreground">Người thực hiện</p>
                <p className="font-semibold text-foreground">{movementDetailModal.performerName || movementDetailModal.performerId || "Hệ thống"}</p>
              </div>
              <div className="rounded-lg border border-border bg-muted/20 p-3">
                <p className="text-xs text-muted-foreground">Mã chứng từ / Đơn tham chiếu</p>
                <p className="font-mono text-foreground">{movementDetailModal.referenceId || "—"}</p>
              </div>
              {movementDetailModal.reason && (
                <div className="rounded-lg border border-border bg-muted/20 p-3 sm:col-span-2">
                  <p className="text-xs text-muted-foreground">Lý do / Giải trình</p>
                  <p className="text-foreground">{movementDetailModal.reason}</p>
                </div>
              )}
            </div>
            <div className="flex justify-end pt-3">
              <Button variant="outline" onClick={() => setMovementDetailModal(null)}>
                Đóng
              </Button>
            </div>
          </DialogContent>
        </Dialog>
      )}

      {/* MODAL: AUDIT LOG DETAIL */}
      {logDetailModal && (
        <Dialog open onOpenChange={(open) => !open && setLogDetailModal(null)}>
          <DialogContent className="max-w-lg">
            <DialogTitle>Sự kiện kiểm toán #{logDetailModal.id}</DialogTitle>
            <DialogDescription>
              Chi tiết nhật ký kiểm toán hành vi trọng yếu của hệ thống.
            </DialogDescription>
            <div className="space-y-3 pt-2 text-sm">
              <div className="rounded-lg border border-border bg-muted/20 p-3">
                <p className="text-xs text-muted-foreground">Thời gian ghi nhận</p>
                <p className="font-mono font-bold text-foreground">{logDetailModal.time}</p>
              </div>
              <div className="rounded-lg border border-border bg-muted/20 p-3">
                <p className="text-xs text-muted-foreground">Tài khoản thực hiện (Actor)</p>
                <p className="font-semibold text-foreground">{logDetailModal.actor}</p>
              </div>
              <div className="rounded-lg border border-border bg-muted/20 p-3">
                <p className="text-xs text-muted-foreground">Hành động trọng yếu (Action)</p>
                <p className="font-semibold text-accent">{logDetailModal.action}</p>
              </div>
              <div className="rounded-lg border border-border bg-muted/20 p-3">
                <p className="text-xs text-muted-foreground">Lý do / Nội dung chi tiết</p>
                <p className="text-foreground">{logDetailModal.reason}</p>
              </div>
            </div>
            <div className="flex justify-end pt-3">
              <Button variant="outline" onClick={() => setLogDetailModal(null)}>
                Đóng
              </Button>
            </div>
          </DialogContent>
        </Dialog>
      )}
    </>
  );
}
