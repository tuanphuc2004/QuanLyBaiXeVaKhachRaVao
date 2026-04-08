import React, { useCallback, useEffect, useState } from "react";
import { Navigate } from "react-router-dom";
import { Shield, UserCog } from "lucide-react";
import { authApi, type UserAccount, type UserRole } from "../api/authApi";
import { useConfirm } from "../components/ConfirmDialogProvider";
import { useToast } from "../components/ToastProvider";

const ROLE_OPTIONS: { value: UserRole; label: string }[] = [
  { value: "Admin", label: "Quản trị" },
  { value: "Director", label: "Giám đốc" },
  { value: "Security", label: "Bảo vệ" },
  { value: "Employee", label: "Lễ tân" },
];

function roleLabel(role: UserRole): string {
  return ROLE_OPTIONS.find((r) => r.value === role)?.label ?? role;
}

const UserAccountsPage: React.FC = () => {
  const pushToast = useToast();
  const confirm = useConfirm();
  const role = localStorage.getItem("current_role");
  const currentUsername = localStorage.getItem("current_username");
  const isAdmin = role === "Admin";

  const [users, setUsers] = useState<UserAccount[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const [createForm, setCreateForm] = useState({
    username: "",
    password: "",
    fullName: "",
    role: "Employee" as UserRole,
  });

  const [editing, setEditing] = useState<UserAccount | null>(null);
  const [editForm, setEditForm] = useState({
    fullName: "",
    role: "Employee" as UserRole,
    password: "",
  });

  const loadUsers = useCallback(async () => {
    try {
      setLoading(true);
      setError(null);
      const res = await authApi.listUsers();
      setUsers(res.data);
    } catch (err: any) {
      if (err?.response?.status === 401 || err?.response?.status === 403) {
        setError("Bạn không có quyền quản lý tài khoản.");
      } else {
        setError("Không tải được danh sách tài khoản. Kiểm tra kết nối backend.");
      }
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    if (isAdmin) loadUsers();
  }, [isAdmin, loadUsers]);

  if (!isAdmin) {
    return <Navigate to="/" replace />;
  }

  const handleCreate = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);
    try {
      const res = await authApi.createUser({
        username: createForm.username.trim(),
        password: createForm.password,
        fullName: createForm.fullName.trim(),
        role: createForm.role,
      });
      setUsers((prev) => [...prev, res.data].sort((a, b) => a.username.localeCompare(b.username)));
      setCreateForm({ username: "", password: "", fullName: "", role: "Employee" });
      pushToast({ type: "success", title: "Đã tạo tài khoản", message: res.data.username });
    } catch (err: any) {
      const msg =
        err?.response?.data?.detail ||
        (typeof err?.response?.data === "string" ? err.response.data : null) ||
        "Không tạo được tài khoản.";
      setError(String(msg));
      pushToast({ type: "error", title: "Lỗi", message: String(msg) });
    }
  };

  const openEdit = (u: UserAccount) => {
    setEditing(u);
    setEditForm({ fullName: u.fullName, role: u.role, password: "" });
    setError(null);
  };

  const handleSaveEdit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!editing) return;
    setError(null);
    try {
      const res = await authApi.updateUser(editing.username, {
        fullName: editForm.fullName.trim(),
        role: editForm.role,
        password: editForm.password.trim() || undefined,
      });
      setUsers((prev) => prev.map((x) => (x.username === res.data.username ? res.data : x)));
      setEditing(null);
      pushToast({ type: "success", title: "Đã cập nhật", message: res.data.username });
    } catch (err: any) {
      const msg =
        err?.response?.data?.detail ||
        (typeof err?.response?.data === "string" ? err.response.data : null) ||
        "Không cập nhật được.";
      setError(String(msg));
      pushToast({ type: "error", title: "Lỗi", message: String(msg) });
    }
  };

  const handleDeleteAccount = async () => {
    if (!editing) return;
    const uname = editing.username;
    const ok = await confirm({
      title: "Xóa tài khoản",
      message: `Bạn có chắc muốn xóa vĩnh viễn tài khoản "${uname}"? Thao tác không thể hoàn tác.`,
      confirmLabel: "Xóa",
      cancelLabel: "Hủy",
      tone: "danger",
    });
    if (!ok) return;
    setError(null);
    try {
      await authApi.deleteUser(uname);
      setUsers((prev) => prev.filter((x) => x.username !== uname));
      setEditing(null);
      pushToast({ type: "success", title: "Đã xóa tài khoản", message: uname });
    } catch (err: any) {
      const msg =
        err?.response?.data?.detail ||
        (typeof err?.response?.data === "string" ? err.response.data : null) ||
        "Không xóa được tài khoản.";
      setError(String(msg));
      pushToast({ type: "error", title: "Lỗi", message: String(msg) });
    }
  };

  return (
    <div>
      <div className="mb-8">
        <h1 className="text-3xl font-bold text-white">Tài khoản & phân quyền</h1>
        <p className="text-white/70 mt-1">Tạo tài khoản đăng nhập và gán vai trò (chỉ Quản trị viên)</p>
      </div>

      {error && (
        <div className="login-error" style={{ marginBottom: "1rem" }}>
          {error}
        </div>
      )}

      <div className="bg-white border border-slate-200 rounded-2xl p-6 shadow-sm mb-6">
        <div className="flex items-center gap-2 mb-4">
          <span className="w-9 h-9 rounded-lg flex items-center justify-center bg-slate-100 border border-slate-200 text-slate-700">
            <UserCog className="h-5 w-5" aria-hidden="true" />
          </span>
          <h2 className="text-lg font-bold text-gray-900">Thêm tài khoản mới</h2>
        </div>
        <form onSubmit={handleCreate} className="grid grid-cols-1 md:grid-cols-2 gap-4">
          <label className="flex flex-col gap-1 text-sm">
            <span className="text-gray-600">Tên đăng nhập</span>
            <input
              className="border border-slate-200 rounded-lg px-3 py-2"
              value={createForm.username}
              onChange={(e) => setCreateForm((s) => ({ ...s, username: e.target.value }))}
              required
              autoComplete="off"
            />
          </label>
          <label className="flex flex-col gap-1 text-sm">
            <span className="text-gray-600">Mật khẩu</span>
            <input
              type="password"
              className="border border-slate-200 rounded-lg px-3 py-2"
              value={createForm.password}
              onChange={(e) => setCreateForm((s) => ({ ...s, password: e.target.value }))}
              required
              minLength={4}
              autoComplete="new-password"
            />
          </label>
          <label className="flex flex-col gap-1 text-sm">
            <span className="text-gray-600">Họ tên hiển thị</span>
            <input
              className="border border-slate-200 rounded-lg px-3 py-2"
              value={createForm.fullName}
              onChange={(e) => setCreateForm((s) => ({ ...s, fullName: e.target.value }))}
              required
            />
          </label>
          <label className="flex flex-col gap-1 text-sm">
            <span className="text-gray-600">Vai trò</span>
            <select
              className="border border-slate-200 rounded-lg px-3 py-2"
              value={createForm.role}
              onChange={(e) => setCreateForm((s) => ({ ...s, role: e.target.value as UserRole }))}
            >
              {ROLE_OPTIONS.map((o) => (
                <option key={o.value} value={o.value}>
                  {o.label}
                </option>
              ))}
            </select>
          </label>
          <div className="md:col-span-2">
            <button
              type="submit"
              className="px-4 py-2 rounded-xl bg-blue-600 text-white font-medium hover:bg-blue-700"
            >
              Tạo tài khoản
            </button>
          </div>
        </form>
      </div>

      <div className="bg-white border border-slate-200 rounded-2xl p-6 shadow-sm">
        <div className="flex items-center gap-2 mb-4">
          <span className="w-9 h-9 rounded-lg flex items-center justify-center bg-slate-100 border border-slate-200 text-slate-700">
            <Shield className="h-5 w-5" aria-hidden="true" />
          </span>
          <h2 className="text-lg font-bold text-gray-900">Danh sách tài khoản</h2>
        </div>

        {loading && !users.length ? (
          <p className="text-sm text-gray-500">Đang tải...</p>
        ) : (
          <div className="overflow-x-auto">
            <table className="table w-full text-sm">
              <thead>
                <tr>
                  <th>Tên đăng nhập</th>
                  <th>Họ tên</th>
                  <th>Vai trò</th>
                  <th></th>
                </tr>
              </thead>
              <tbody>
                {users.map((u) => (
                  <tr key={u.username}>
                    <td className="font-medium">{u.username}</td>
                    <td>{u.fullName}</td>
                    <td>{roleLabel(u.role)}</td>
                    <td>
                      <button
                        type="button"
                        className="text-blue-600 hover:underline"
                        onClick={() => openEdit(u)}
                      >
                        Sửa
                      </button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>

      {editing && (
        <div
          className="dialog-overlay"
          role="dialog"
          aria-modal="true"
          onClick={() => setEditing(null)}
        >
          <div className="dialog" onClick={(e) => e.stopPropagation()}>
            <div className="flex justify-between items-start gap-4">
              <div>
                <div className="dialog-title">Sửa tài khoản</div>
                <div className="dialog-message mt-1">{editing.username}</div>
              </div>
              <button type="button" className="btn" aria-label="Đóng" onClick={() => setEditing(null)}>
                ×
              </button>
            </div>
            <form onSubmit={handleSaveEdit} className="mt-4 space-y-3">
              <label className="flex flex-col gap-1 text-sm">
                <span className="text-gray-600">Họ tên</span>
                <input
                  className="border border-slate-200 rounded-lg px-3 py-2 w-full"
                  value={editForm.fullName}
                  onChange={(e) => setEditForm((s) => ({ ...s, fullName: e.target.value }))}
                  required
                />
              </label>
              <label className="flex flex-col gap-1 text-sm">
                <span className="text-gray-600">Vai trò</span>
                <select
                  className="border border-slate-200 rounded-lg px-3 py-2 w-full"
                  value={editForm.role}
                  onChange={(e) => setEditForm((s) => ({ ...s, role: e.target.value as UserRole }))}
                >
                  {ROLE_OPTIONS.map((o) => (
                    <option key={o.value} value={o.value}>
                      {o.label}
                    </option>
                  ))}
                </select>
              </label>
              <label className="flex flex-col gap-1 text-sm">
                <span className="text-gray-600">Mật khẩu mới (để trống nếu giữ nguyên)</span>
                <input
                  type="password"
                  className="border border-slate-200 rounded-lg px-3 py-2 w-full"
                  value={editForm.password}
                  onChange={(e) => setEditForm((s) => ({ ...s, password: e.target.value }))}
                  autoComplete="new-password"
                />
              </label>
              <div className="flex flex-wrap items-center justify-between gap-2 pt-2">
                <button
                  type="button"
                  className="btn btn-danger"
                  disabled={currentUsername === editing.username}
                  title={
                    currentUsername === editing.username
                      ? "Không thể xóa tài khoản bạn đang đăng nhập"
                      : undefined
                  }
                  onClick={() => void handleDeleteAccount()}
                >
                  Xóa tài khoản
                </button>
                <div className="flex gap-2 flex-wrap">
                  <button type="submit" className="btn btn-primary">
                    Lưu
                  </button>
                  <button type="button" className="btn" onClick={() => setEditing(null)}>
                    Hủy
                  </button>
                </div>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
};

export default UserAccountsPage;
