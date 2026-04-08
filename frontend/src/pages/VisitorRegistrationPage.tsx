import React, { useState } from "react";
import { QrCode, UserPlus } from "lucide-react";
import { visitorApi } from "../api/visitorApi";
import { isBlacklistedGuest } from "../blacklistStore";
import { useConfirm } from "../components/ConfirmDialogProvider";
import { useToast } from "../components/ToastProvider";

const DEPARTMENTS = ["Phòng Kế toán", "Phòng Nhân sự", "Phòng Kinh doanh", "Văn phòng Giám đốc", "Khác"];
const HOSTS = ["Giám đốc", "Phó giám đốc", "Thư ký", "Trưởng phòng Kế toán", "Trưởng phòng Nhân sự", "Khác"];

interface VisitorRegistrationForm {
  fullName: string;
  idNumber: string;
  phone: string;
  companyName: string;
  email: string;
  hostSelect: string;
  hostOther: string;
  departmentSelect: string;
  departmentOther: string;
  purpose: string;
  appointmentDate: string;
  appointmentTime: string;
}

const VisitorRegistrationPage: React.FC = () => {
  const confirm = useConfirm();
  const pushToast = useToast();
  const [form, setForm] = useState<VisitorRegistrationForm>({
    fullName: "",
    idNumber: "",
    phone: "",
    companyName: "",
    email: "",
    hostSelect: "",
    hostOther: "",
    departmentSelect: "",
    departmentOther: "",
    purpose: "",
    appointmentDate: "",
    appointmentTime: ""
  });
  const [qrToken, setQrToken] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const handleChange = (e: React.ChangeEvent<HTMLInputElement | HTMLTextAreaElement | HTMLSelectElement>) => {
    const { name, value, type } = e.target;
    const checked = (e.target as HTMLInputElement).checked;
    setForm((prev) => ({
      ...prev,
      [name]: type === "checkbox" ? checked : value
    }));
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);

    if (form.idNumber && form.idNumber.trim() && isBlacklistedGuest(form.idNumber)) {
      setError(
        "CCCD này đang trong danh sách đen. Để đăng ký khách, vui lòng vào mục Danh sách đen (Danh sách đen khách) để xóa trước."
      );
      return;
    }

    if (!form.appointmentDate || !form.appointmentTime) {
      setError("Vui lòng chọn đầy đủ ngày và giờ hẹn.");
      return;
    }

    const ok = await confirm({
      title: "Xác nhận lưu đăng ký",
      message: "Bạn có chắc muốn lưu thông tin khách và tạo QR cho lượt visit này không?",
      confirmLabel: "Lưu",
      cancelLabel: "Hủy",
      tone: "default",
    });
    if (!ok) return;

    setSaving(true);
    try {
      const hostName = form.hostSelect === "Khác" ? form.hostOther.trim() : form.hostSelect;
      const department = form.departmentSelect === "Khác" ? form.departmentOther.trim() : form.departmentSelect;
      const response = await visitorApi.createVisitor({
        fullName: form.fullName,
        idNumber: form.idNumber || undefined,
        phone: form.phone || undefined,
        companyName: form.companyName || undefined,
        email: form.email || undefined,
        hostName: hostName || undefined,
        department: department || undefined,
        appointmentDate: form.appointmentDate,
        appointmentTime: form.appointmentTime,
        // Employee/Reception registers the appointment first; Admin will approve later.
        isPreRegistration: false,
      });
      const created = response.data;
      setQrToken(created.qrToken ?? null);
      pushToast({
        type: "success",
        title: "Lưu thành công",
        message: "Đã tạo QR cho lượt đăng ký của khách.",
      });
      // Notify the sidebar badge counter to refresh immediately.
      window.dispatchEvent(new Event("pendingApprovalChanged"));
    } catch (err: any) {
      if (err?.response?.status === 401 || err?.response?.status === 403) {
        setError("Bạn không có quyền đăng ký khách. Hãy đăng nhập với tài khoản Admin hoặc Lễ tân (letan).");
        pushToast({ type: "error", title: "Không thể lưu", message: "Bạn không đủ quyền thực hiện." });
      } else {
        setError("Không thể lưu đăng ký khách. Vui lòng kiểm tra backend và thử lại.");
        pushToast({ type: "error", title: "Không thể lưu", message: "Vui lòng thử lại sau." });
      }
    } finally {
      setSaving(false);
    }
  };

  return (
    <div>
      <h2 className="page-title flex items-center gap-3">
        <UserPlus className="h-6 w-6 text-indigo-700" aria-hidden="true" />
        <span>Đăng ký khách</span>
      </h2>

      <div className="card">
        <div className="card-header">
          <div>
            <div className="card-title flex items-center gap-3">
              <UserPlus className="h-5 w-5 text-slate-700" aria-hidden="true" />
              <span>Thông tin khách</span>
            </div>
            <div className="card-subtitle">Nhập thông tin cơ bản, người cần gặp và thời gian hẹn</div>
          </div>
        </div>

        <form onSubmit={handleSubmit}>
          <div className="form-grid">
            <div className="form-field">
              <label className="form-label" htmlFor="fullName">
                Họ tên
              </label>
              <input
                id="fullName"
                name="fullName"
                className="form-input"
                value={form.fullName}
                onChange={handleChange}
                required
              />
            </div>

            <div className="form-field">
              <label className="form-label" htmlFor="idNumber">
                CCCD
              </label>
              <input
                id="idNumber"
                name="idNumber"
                className="form-input"
                value={form.idNumber}
                onChange={handleChange}
              />
            </div>

            <div className="form-field">
              <label className="form-label" htmlFor="phone">
                Số điện thoại
              </label>
              <input
                id="phone"
                name="phone"
                className="form-input"
                value={form.phone}
                onChange={handleChange}
              />
            </div>

            <div className="form-field">
              <label className="form-label" htmlFor="email">
                Email
              </label>
              <input
                id="email"
                name="email"
                type="email"
                className="form-input"
                value={form.email}
                onChange={handleChange}
              />
            </div>

            <div className="form-field">
              <label className="form-label" htmlFor="companyName">
                Công ty
              </label>
              <input
                id="companyName"
                name="companyName"
                className="form-input"
                value={form.companyName}
                onChange={handleChange}
              />
            </div>

            <div className="form-field">
              <label className="form-label" htmlFor="hostSelect">
                Gặp ai (Host)
              </label>
              <select
                id="hostSelect"
                name="hostSelect"
                className="form-input"
                value={form.hostSelect}
                onChange={handleChange}
              >
                <option value="">Chọn...</option>
                {HOSTS.map((opt) => (
                  <option key={opt} value={opt}>{opt}</option>
                ))}
              </select>
              {form.hostSelect === "Khác" && (
                <input
                  name="hostOther"
                  className="form-input"
                  placeholder="Ghi rõ gặp ai (phòng ban / người cụ thể)"
                  value={form.hostOther}
                  onChange={handleChange}
                  style={{ marginTop: "0.5rem" }}
                />
              )}
            </div>

            <div className="form-field">
              <label className="form-label" htmlFor="departmentSelect">
                Phòng ban
              </label>
              <select
                id="departmentSelect"
                name="departmentSelect"
                className="form-input"
                value={form.departmentSelect}
                onChange={handleChange}
              >
                <option value="">Chọn...</option>
                {DEPARTMENTS.map((opt) => (
                  <option key={opt} value={opt}>{opt}</option>
                ))}
              </select>
              {form.departmentSelect === "Khác" && (
                <input
                  name="departmentOther"
                  className="form-input"
                  placeholder="Ghi rõ phòng ban cần gặp"
                  value={form.departmentOther}
                  onChange={handleChange}
                  style={{ marginTop: "0.5rem" }}
                />
              )}
            </div>
          </div>

          <div className="form-field" style={{ marginTop: "0.75rem" }}>
            <label className="form-label" htmlFor="purpose">
              Mục đích
            </label>
            <textarea
              id="purpose"
              name="purpose"
              className="form-textarea"
              value={form.purpose}
              onChange={handleChange}
            />
          </div>

          <div className="form-grid" style={{ marginTop: "0.75rem" }}>
            <div className="form-field">
              <label className="form-label" htmlFor="appointmentDate">
                Ngày hẹn
              </label>
              <input
                id="appointmentDate"
                name="appointmentDate"
                type="date"
                className="form-input"
                value={form.appointmentDate}
                onChange={handleChange}
                required
              />
            </div>
            <div className="form-field">
              <label className="form-label" htmlFor="appointmentTime">
                Giờ hẹn
              </label>
              <input
                id="appointmentTime"
                name="appointmentTime"
                type="time"
                className="form-input"
                value={form.appointmentTime}
                onChange={handleChange}
                required
              />
            </div>
          </div>

          {error && <div className="login-error">{error}</div>}

          <div className="form-actions">
            <button type="submit" className="btn btn-primary" disabled={saving}>
              {saving ? "Đang lưu..." : "Lưu đăng ký và sinh QR"}
            </button>
          </div>
        </form>
      </div>

      {qrToken && (
        <div className="card">
          <div className="card-title flex items-center gap-3">
            <QrCode className="h-5 w-5 text-blue-700" aria-hidden="true" />
            <span>QR Code cho khách</span>
          </div>
          <div className="card-subtitle">
            Đây là token đại diện cho QR của lượt visit (có thể dùng thư viện để render QR sau này).
          </div>
          <pre style={{ marginTop: "0.5rem", backgroundColor: "#f9fafb", padding: "0.5rem" }}>{qrToken}</pre>
        </div>
      )}
    </div>
  );
};

export default VisitorRegistrationPage;

