import React, { useState } from "react";
import { CalendarDays } from "lucide-react";
import { visitorApi } from "../api/visitorApi";
import { useConfirm } from "../components/ConfirmDialogProvider";
import { useToast } from "../components/ToastProvider";

interface CustomerAppointmentForm {
  fullName: string;
  email: string;
  phone: string;
  companyName: string;
  hostName: string;
  department: string;
  appointmentDate: string;
  appointmentTime: string;
  note: string;
}

const CustomerAppointmentPage: React.FC = () => {
  const [form, setForm] = useState<CustomerAppointmentForm>({
    fullName: "",
    email: "",
    phone: "",
    companyName: "",
    hostName: "",
    department: "",
    appointmentDate: "",
    appointmentTime: "",
    note: ""
  });
  const [submitting, setSubmitting] = useState(false);
  const [successMessage, setSuccessMessage] = useState<string | null>(null);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);

  const confirm = useConfirm();
  const pushToast = useToast();

  const handleChange = (e: React.ChangeEvent<HTMLInputElement | HTMLTextAreaElement>) => {
    const { name, value } = e.target;
    setForm((prev) => ({
      ...prev,
      [name]: value
    }));
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setErrorMessage(null);
    setSuccessMessage(null);

    if (!form.appointmentDate || !form.appointmentTime) {
      setErrorMessage("Vui lòng chọn ngày và giờ hẹn.");
      return;
    }
    if (!form.fullName.trim()) {
      setErrorMessage("Vui lòng nhập họ tên.");
      return;
    }
    if (!form.email.trim()) {
      setErrorMessage("Vui lòng nhập email để nhận xác nhận lịch hẹn.");
      return;
    }

    const ok = await confirm({
      title: "Xác nhận gửi đăng ký",
      message: `Bạn có chắc muốn gửi đăng ký lịch hẹn với email: ${form.email.trim()}?`,
      confirmLabel: "Gửi",
      cancelLabel: "Hủy",
      tone: "default",
    });
    if (!ok) return;

    setSubmitting(true);
    try {
      const payload = {
        fullName: form.fullName.trim(),
        email: form.email.trim(),
        phone: form.phone || undefined,
        companyName: form.companyName || undefined,
        hostName: form.hostName || undefined,
        department: form.department || undefined,
        appointmentDate: form.appointmentDate,
        appointmentTime: form.appointmentTime,
        // Lịch do khách tự đăng ký: backend sẽ đặt isPreRegistration = False để chờ duyệt
        isPreRegistration: false
      };

      await visitorApi.createVisitorPublic(payload);
      setSuccessMessage(
        "Đăng ký lịch hẹn thành công. Lễ tân/Admin sẽ kiểm tra và xác nhận lịch hẹn của bạn."
      );
      pushToast({ type: "success", title: "Gửi thành công", message: "Đã gửi đăng ký lịch hẹn." });
      setForm({
        fullName: "",
        phone: "",
        companyName: "",
        hostName: "",
        department: "",
        appointmentDate: "",
        appointmentTime: "",
        note: ""
      });
    } catch (err: any) {
      const detail = err?.response?.data?.detail;
      if (typeof detail === "string") {
        setErrorMessage(detail);
      } else {
        setErrorMessage("Không thể gửi đăng ký lịch hẹn. Vui lòng thử lại sau.");
      }
      pushToast({ type: "error", title: "Gửi thất bại", message: "Vui lòng thử lại sau." });
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <div className="app-public-page">
      <div className="app-public-card">
        <h1
          className="page-title flex items-center justify-center gap-3"
          style={{ marginBottom: "1.5rem" }}
        >
          <CalendarDays className="h-6 w-6 text-blue-700" aria-hidden="true" />
          <span>Đăng ký lịch hẹn thăm công ty</span>
        </h1>

        <p style={{ textAlign: "center", marginBottom: "1.5rem", color: "#6b7280" }}>
          Vui lòng điền thông tin bên dưới. Sau khi gửi, bộ phận lễ tân sẽ liên hệ xác nhận lịch hẹn.
        </p>

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
              <label className="form-label" htmlFor="companyName">
                Công ty (nếu có)
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
              <label className="form-label" htmlFor="hostName">
                Người/ bộ phận cần gặp
              </label>
              <input
                id="hostName"
                name="hostName"
                className="form-input"
                placeholder="Ví dụ: Phòng Nhân sự, Anh A - Kinh doanh..."
                value={form.hostName}
                onChange={handleChange}
              />
            </div>
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

          <div className="form-field" style={{ marginTop: "0.75rem" }}>
            <label className="form-label" htmlFor="note">
              Ghi chú thêm (nếu có)
            </label>
            <textarea
              id="note"
              name="note"
              className="form-textarea"
              value={form.note}
              onChange={handleChange}
            />
          </div>

          {errorMessage && <div className="login-error" style={{ marginTop: "0.75rem" }}>{errorMessage}</div>}
          {successMessage && <div className="login-success" style={{ marginTop: "0.75rem" }}>{successMessage}</div>}

          <div className="form-actions" style={{ marginTop: "1rem", justifyContent: "center" }}>
            <button type="submit" className="btn btn-primary" disabled={submitting}>
              {submitting ? "Đang gửi..." : "Gửi đăng ký lịch hẹn"}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
};

export default CustomerAppointmentPage;

