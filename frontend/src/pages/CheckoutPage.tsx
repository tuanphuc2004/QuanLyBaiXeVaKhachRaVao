import React, { useEffect, useState } from "react";
import { History, LogOut, QrCode } from "lucide-react";
import { visitApi, Visit } from "../api/visitApi";
import { useConfirm } from "../components/ConfirmDialogProvider";
import { useToast } from "../components/ToastProvider";

interface CheckoutForm {
  qrOrBadge: string;
}

const CheckoutPage: React.FC = () => {
  const [form, setForm] = useState<CheckoutForm>({ qrOrBadge: "" });
  const [visits, setVisits] = useState<Visit[]>([]);
  const [loadingList, setLoadingList] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const confirm = useConfirm();
  const pushToast = useToast();

  const loadVisits = async () => {
    try {
      setLoadingList(true);
      const response = await visitApi.getVisits();
      setVisits(response.data);
    } catch (err) {
      // In real case, should log error
    } finally {
      setLoadingList(false);
    }
  };

  useEffect(() => {
    loadVisits();
  }, []);

  const handleChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const { name, value } = e.target;
    setForm((prev) => ({ ...prev, [name]: value }));
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);

    const token = form.qrOrBadge.trim();
    if (!token) {
      setError("Vui lòng nhập QR/CCCD.");
      return;
    }

    const ok = await confirm({
      title: "Xác nhận check-out",
      message: `Bạn có chắc muốn ra cổng cho mã: ${token}?`,
      confirmLabel: "Ra cổng",
      cancelLabel: "Hủy",
      tone: "danger",
    });
    if (!ok) return;

    setSubmitting(true);
    try {
      const response = await visitApi.checkout(form);
      const updated = response.data;
      setVisits((prev) =>
        prev.map((v) => (v.visitId === updated.visitId ? updated : v))
      );
      setForm({ qrOrBadge: "" });
      pushToast({ type: "success", title: "Check-out thành công", message: "Đã ghi nhận giờ ra cổng." });
    } catch (err: any) {
      if (err?.response?.status === 404) {
        setError("Không tìm thấy lượt visit đang hoạt động cho mã này.");
        pushToast({ type: "error", title: "Check-out thất bại", message: "Không tìm thấy lượt visit." });
      } else if (err?.response?.status === 401 || err?.response?.status === 403) {
        setError("Bạn không có quyền thực hiện chức năng này. Hãy đăng nhập với tài khoản Security/Admin.");
        pushToast({ type: "error", title: "Check-out thất bại", message: "Không đủ quyền." });
      } else {
        setError("Không thể kết nối tới server. Vui lòng thử lại.");
        pushToast({ type: "error", title: "Check-out thất bại", message: "Vui lòng thử lại sau." });
      }
    } finally {
      setSubmitting(false);
    }
  };

  const formatDateTime = (value?: string | null) => {
    if (!value) return "-";
    return new Date(value).toLocaleString("vi-VN");
  };

  return (
    <div>
      <h2 className="page-title flex items-center gap-3">
        <LogOut className="h-6 w-6 text-red-700" aria-hidden="true" />
        <span>Check-out khách</span>
      </h2>

      <div className="card">
        <div className="card-header">
          <div>
            <div className="card-title flex items-center gap-3">
              <QrCode className="h-5 w-5 text-slate-700" aria-hidden="true" />
              <span>Thông tin check-out</span>
            </div>
            <div className="card-subtitle">
              Quét QR lượt visit hoặc số thẻ khách để ghi nhận giờ ra và thu hồi thẻ
            </div>
          </div>
        </div>

        <form onSubmit={handleSubmit}>
          <div className="form-field">
            <label className="form-label" htmlFor="qrOrBadge">
              QR visit hoặc số thẻ khách
            </label>
            <input
              id="qrOrBadge"
              name="qrOrBadge"
              className="form-input"
              value={form.qrOrBadge}
              onChange={handleChange}
              placeholder="Nhập token QR hoặc số thẻ"
            />
          </div>

          {error && <div className="login-error">{error}</div>}

          <div className="form-actions">
            <button type="submit" className="btn btn-primary" disabled={submitting}>
              {submitting ? "Đang check-out..." : "Thực hiện check-out"}
            </button>
          </div>
        </form>
      </div>

      <div className="card">
        <div className="card-header">
          <div>
            <div className="card-title flex items-center gap-3">
              <History className="h-5 w-5 text-slate-700" aria-hidden="true" />
              <span>Lịch sử check-in / check-out</span>
            </div>
            <div className="card-subtitle">Xem giờ vào và giờ ra của các lượt gần đây</div>
          </div>
        </div>

        {loadingList ? (
          <div>Đang tải dữ liệu...</div>
        ) : (
          <table className="table">
            <thead>
              <tr>
                <th>STT</th>
                <th>QR/CCCD</th>
                <th>Biển số</th>
                <th>Loại xe</th>
                <th>Số thẻ</th>
                <th>Giờ vào</th>
                <th>Giờ ra</th>
              </tr>
            </thead>
            <tbody>
              {visits.length === 0 ? (
                <tr>
                  <td colSpan={7}>Chưa có dữ liệu check-in / check-out.</td>
                </tr>
              ) : (
                visits.map((visit, index) => (
                  <tr key={visit.visitId}>
                    <td>{index + 1}</td>
                    <td>{visit.qrOrIdNumber}</td>
                    <td>{visit.vehiclePlate}</td>
                    <td>{visit.vehicleType}</td>
                    <td>{visit.badgeNumber}</td>
                    <td>{formatDateTime(visit.checkInTime)}</td>
                    <td>{formatDateTime(visit.checkOutTime)}</td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        )}
      </div>
    </div>
  );
};

export default CheckoutPage;

