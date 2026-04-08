import React, { useEffect, useState } from "react";
import { ClipboardCheck, ListChecks, UserPlus, Users } from "lucide-react";
import { visitorApi, Visitor, PagedResult } from "../api/visitorApi";
import { visitApi, Visit } from "../api/visitApi";
import { isBlacklistedGuest } from "../blacklistStore";
import { useToast } from "../components/ToastProvider";
import { useConfirm } from "../components/ConfirmDialogProvider";

const HOSTS = ["Giám đốc", "Phó giám đốc", "Thư ký", "Trưởng phòng Kế toán", "Trưởng phòng Nhân sự", "Khác"];

interface WalkinForm {
  fullName: string;
  idNumber: string;
  phone: string;
  companyName: string;
  hostSelect: string;
  hostOther: string;
  appointmentDate: string;
  appointmentTime: string;
}

const ReceptionCheckinPage: React.FC = () => {
  const pushToast = useToast();
  const confirm = useConfirm();
  const [data, setData] = useState<PagedResult<Visitor> | null>(null);
  const [pageNumber, setPageNumber] = useState(1);
  const [searchTerm, setSearchTerm] = useState("");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [checkinLoadingId, setCheckinLoadingId] = useState<number | null>(null);
  const [checkinError, setCheckinError] = useState<string | null>(null);
  const [walkinForm, setWalkinForm] = useState<WalkinForm>({
    fullName: "",
    idNumber: "",
    phone: "",
    companyName: "",
    hostSelect: "",
    hostOther: "",
    appointmentDate: "",
    appointmentTime: ""
  });
  const [walkinSaving, setWalkinSaving] = useState(false);
  const [walkinMessage, setWalkinMessage] = useState<string | null>(null);
  const [activeGuestVisits, setActiveGuestVisits] = useState<Visit[]>([]);
  const [visitors, setVisitors] = useState<Visitor[]>([]);
  const [checkoutLoadingId, setCheckoutLoadingId] = useState<number | null>(null);
  const [checkoutError, setCheckoutError] = useState<string | null>(null);
  const pageSize = 10;

  const role = localStorage.getItem("current_role");
  const isAdmin = role === "Admin";
  const isReception = role === "Employee";

  const loadVisitors = async () => {
    try {
      setLoading(true);
      setError(null);
      // Lấy toàn bộ khách còn có thể check-in (bao gồm khách đăng ký trước và khách lễ tân tạo lịch)
      const response = await visitorApi.getVisitorsForReception(pageNumber, pageSize, searchTerm);
      setData(response.data);
    } catch (err: any) {
      if (err?.response?.status === 401 || err?.response?.status === 403) {
        setError("Bạn không có quyền xem danh sách khách. Hãy đăng nhập lại.");
      } else {
        setError("Không thể tải danh sách khách. Vui lòng kiểm tra backend.");
      }
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadVisitors();
    loadActiveGuests();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [pageNumber, searchTerm]);

  useEffect(() => {
    loadAllVisitors();
  }, []);

  const loadActiveGuests = async () => {
    try {
      const res = await visitApi.getVisits();
      const all = res.data || [];
      const active = all.filter(
        (v) => !v.checkOutTime && (!v.vehiclePlate || String(v.vehiclePlate).trim() === "")
      );
      setActiveGuestVisits(active);
    } catch {
      setActiveGuestVisits([]);
    }
  };

  const loadAllVisitors = async () => {
    try {
      const first = await visitorApi.getVisitors(1, 2000, "");
      const items: Visitor[] = first.data?.items ?? [];
      let totalPages = first.data?.totalPages ?? 1;
      let page = 1;
      while (page < totalPages) {
        page += 1;
        const next = await visitorApi.getVisitors(page, 2000, "");
        items.push(...(next.data?.items ?? []));
        totalPages = next.data?.totalPages ?? 1;
      }
      setVisitors(items);
    } catch {
      setVisitors([]);
    }
  };

  const handleWalkinChange = (e: React.ChangeEvent<HTMLInputElement | HTMLSelectElement>) => {
    const { name, value } = e.target;
    setWalkinForm((prev) => ({ ...prev, [name]: value }));
  };

  const handleWalkinSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setWalkinMessage(null);
    setError(null);
    if (!walkinForm.fullName.trim()) {
      setError("Vui lòng nhập họ tên khách.");
      return;
    }
    if (walkinForm.idNumber && walkinForm.idNumber.trim() && isBlacklistedGuest(walkinForm.idNumber)) {
      setError(
        "CCCD này đang trong danh sách đen. Để tạo lịch hẹn cho khách, vui lòng vào mục Danh sách đen (Danh sách đen khách) để xóa trước."
      );
      return;
    }
    if (!walkinForm.appointmentDate || !walkinForm.appointmentTime) {
      setError("Vui lòng chọn đầy đủ ngày và giờ hẹn.");
      return;
    }
    try {
      setWalkinSaving(true);
      const hostName = walkinForm.hostSelect === "Khác" ? walkinForm.hostOther.trim() : walkinForm.hostSelect;
      await visitorApi.createVisitor({
        fullName: walkinForm.fullName.trim(),
        idNumber: walkinForm.idNumber || undefined,
        phone: walkinForm.phone || undefined,
        companyName: walkinForm.companyName || undefined,
        hostName: hostName || undefined,
        appointmentDate: walkinForm.appointmentDate,
        appointmentTime: walkinForm.appointmentTime,
        isPreRegistration: false
      });
      setWalkinMessage("Đã ghi nhận lịch hẹn cho khách. Chờ admin xác nhận lịch.");
      setWalkinForm({
        fullName: "",
        idNumber: "",
        phone: "",
        companyName: "",
        hostSelect: "",
        hostOther: "",
        appointmentDate: "",
        appointmentTime: ""
      });
      // reload list để thấy khách mới với trạng thái đang chờ
      setPageNumber(1);
      loadVisitors();
    } catch (err: any) {
      if (err?.response?.status === 401 || err?.response?.status === 403) {
        setError("Bạn không có quyền tạo lịch hẹn cho khách. Hãy đăng nhập lại.");
      } else {
        setError("Không thể lưu lịch hẹn mới. Vui lòng kiểm tra backend và thử lại.");
      }
    } finally {
      setWalkinSaving(false);
    }
  };

  const handleCheckin = async (visitor: Visitor) => {
    setCheckinError(null);
    const idToCheck = (visitor.idNumber || visitor.qrToken || "").trim();
    if (idToCheck && isBlacklistedGuest(idToCheck)) {
      setCheckinError(
        "CCCD/mã này đang trong danh sách đen. Để cho phép khách vào công ty, vui lòng vào mục Danh sách đen (Danh sách đen khách) để xóa trước."
      );
      return;
    }
    if (!visitor.isPreRegistration) {
      // Show popup for pending schedule
      pushToast({
        type: "warning",
        title: "Chưa thể check-in",
        message: "Lịch hẹn của khách đang chờ admin xác nhận.",
      });
      setCheckinError("Khách này đang chờ admin xác nhận lịch, chưa thể check-in.");
      return;
    }
    const token = visitor.qrToken || visitor.idNumber || visitor.fullName;

    const ok = await confirm({
      title: "Xác nhận check-in",
      message: `Xác nhận check-in cho: ${token}?`,
      confirmLabel: "Check-in",
      cancelLabel: "Hủy",
      tone: "default",
    });
    if (!ok) return;

    setCheckinLoadingId(visitor.visitorId);
    try {
      await visitApi.checkin({
        qrOrIdNumber: token,
        vehiclePlate: "",
        vehicleType: "",
        badgeNumber: ""
      });
      loadActiveGuests();
      // Xóa khách vừa check-in khỏi danh sách để không hiển thị nữa
      setData((prev) =>
        prev
          ? {
              ...prev,
              items: prev.items.filter((x) => x.visitorId !== visitor.visitorId)
            }
          : prev
      );
      pushToast({ type: "success", title: "Check-in thành công", message: "Đã ghi nhận khách vào công ty." });
    } catch (err: any) {
      if (err?.response?.status === 401 || err?.response?.status === 403) {
        setCheckinError("Bạn không có quyền check-in khách. Hãy đăng nhập lại bằng tài khoản Admin hoặc Lễ tân.");
      } else {
        setCheckinError("Không thể check-in khách. Vui lòng kiểm tra backend và thử lại.");
      }
      pushToast({ type: "error", title: "Check-in thất bại", message: "Vui lòng thử lại sau." });
    } finally {
      setCheckinLoadingId(null);
    }
  };

  const getVisitorForVisit = (visit: { qrOrIdNumber: string }) =>
    visitors.find(
      (x) =>
        (x.qrToken && x.qrToken === visit.qrOrIdNumber) ||
        (x.idNumber && x.idNumber === visit.qrOrIdNumber)
    );

  const handleCheckout = async (visit: Visit) => {
    const token = visit.badgeNumber || visit.qrOrIdNumber;
    if (!token) return;

    const ok = await confirm({
      title: "Xác nhận check-out",
      message: `Xác nhận ra cổng cho: ${token}?`,
      confirmLabel: "Ra cổng",
      cancelLabel: "Hủy",
      tone: "danger",
    });
    if (!ok) return;

    setCheckoutError(null);
    setCheckoutLoadingId(visit.visitId);
    try {
      await visitApi.checkout({ qrOrBadge: token });
      setActiveGuestVisits((prev) => prev.filter((v) => v.visitId !== visit.visitId));
      pushToast({ type: "success", title: "Check-out thành công", message: "Đã ghi nhận giờ ra cổng." });
    } catch (err: any) {
      if (err?.response?.status === 404) {
        setCheckoutError("Không tìm thấy lượt visit phù hợp để check-out.");
      } else {
        setCheckoutError("Không thể thực hiện check-out. Vui lòng thử lại.");
      }
      pushToast({ type: "error", title: "Check-out thất bại", message: "Vui lòng thử lại sau." });
    } finally {
      setCheckoutLoadingId(null);
    }
  };

  return (
    <div>
      <h2 className="page-title flex items-center gap-3">
        <ClipboardCheck className="h-6 w-6 text-green-700" aria-hidden="true" />
        <span>Check-in/check-out lễ tân</span>
      </h2>

      {(isAdmin || isReception) && (
        <div className="grid-3" style={{ marginBottom: "1rem" }}>
          <div className="stat-card">
            <div className="stat-label">Khách đang trong công ty</div>
            <div className="stat-value">{activeGuestVisits.length}</div>
            <div className="stat-helper">Đã check-in và chưa check-out</div>
          </div>
          <div className="stat-card">
            <div className="stat-label">Ghi chú</div>
            <div className="stat-helper">
              {isAdmin && "Admin: xem và quản lý số khách."}
              {isReception && "Lễ tân: chỉ xem số khách đang trong công ty, không xem số xe."}
            </div>
          </div>
        </div>
      )}

      <div className="card">
        <div className="card-header">
          <div>
              <div className="card-title flex items-center gap-3">
                <UserPlus className="h-5 w-5 text-slate-700" aria-hidden="true" />
                <span>Đăng ký lịch hẹn cho khách chưa đăng ký trước</span>
              </div>
            <div className="card-subtitle">
              Lễ tân nhập thông tin khách vãng lai khi khách đến trực tiếp để tạo lịch hẹn và chờ admin xác nhận.
            </div>
          </div>
        </div>

        <form onSubmit={handleWalkinSubmit}>
          <div className="form-grid">
            <div className="form-field">
              <label className="form-label" htmlFor="walkin-fullName">
                Họ tên
              </label>
              <input
                id="walkin-fullName"
                name="fullName"
                className="form-input"
                value={walkinForm.fullName}
                onChange={handleWalkinChange}
                required
              />
            </div>
            <div className="form-field">
              <label className="form-label" htmlFor="walkin-idNumber">
                CCCD
              </label>
              <input
                id="walkin-idNumber"
                name="idNumber"
                className="form-input"
                value={walkinForm.idNumber}
                onChange={handleWalkinChange}
              />
            </div>
            <div className="form-field">
              <label className="form-label" htmlFor="walkin-phone">
                Số điện thoại
              </label>
              <input
                id="walkin-phone"
                name="phone"
                className="form-input"
                value={walkinForm.phone}
                onChange={handleWalkinChange}
              />
            </div>
            <div className="form-field">
              <label className="form-label" htmlFor="walkin-companyName">
                Công ty
              </label>
              <input
                id="walkin-companyName"
                name="companyName"
                className="form-input"
                value={walkinForm.companyName}
                onChange={handleWalkinChange}
              />
            </div>
            <div className="form-field">
              <label className="form-label" htmlFor="walkin-hostSelect">
                Gặp ai (Host)
              </label>
              <select
                id="walkin-hostSelect"
                name="hostSelect"
                className="form-input"
                value={walkinForm.hostSelect}
                onChange={handleWalkinChange}
              >
                <option value="">Chọn...</option>
                {HOSTS.map((opt) => (
                  <option key={opt} value={opt}>{opt}</option>
                ))}
              </select>
              {walkinForm.hostSelect === "Khác" && (
                <input
                  name="hostOther"
                  className="form-input"
                  placeholder="Ghi rõ gặp ai (phòng ban / người cụ thể)"
                  value={walkinForm.hostOther}
                  onChange={handleWalkinChange}
                  style={{ marginTop: "0.5rem" }}
                />
              )}
            </div>
          </div>

          <div className="form-grid" style={{ marginTop: "0.75rem" }}>
            <div className="form-field">
              <label className="form-label" htmlFor="walkin-appointmentDate">
                Ngày hẹn
              </label>
              <input
                id="walkin-appointmentDate"
                name="appointmentDate"
                type="date"
                className="form-input"
                value={walkinForm.appointmentDate}
                onChange={handleWalkinChange}
                required
              />
            </div>
            <div className="form-field">
              <label className="form-label" htmlFor="walkin-appointmentTime">
                Giờ hẹn
              </label>
              <input
                id="walkin-appointmentTime"
                name="appointmentTime"
                type="time"
                className="form-input"
                value={walkinForm.appointmentTime}
                onChange={handleWalkinChange}
                required
              />
            </div>
          </div>

          {error && (
            <div className="login-error" style={{ marginTop: "0.75rem" }}>
              {error}
            </div>
          )}
          {walkinMessage && (
            <div className="login-hint" style={{ marginTop: "0.75rem" }}>
              {walkinMessage}
            </div>
          )}

          <div className="form-actions">
            <button type="submit" className="btn btn-primary" disabled={walkinSaving}>
              {walkinSaving ? "Đang lưu lịch hẹn..." : "Tạo lịch hẹn mới"}
            </button>
          </div>
        </form>
      </div>

      <div className="card">
        <div className="card-header">
          <div>
            <div className="card-title flex items-center gap-3">
              <Users className="h-5 w-5 text-slate-700" aria-hidden="true" />
              <span>Khách đang trong công ty</span>
            </div>
            <div className="card-subtitle">
              Lễ tân có thể check-out khách khi khách ra khỏi công ty.
            </div>
          </div>
        </div>
        <table className="table" style={{ marginBottom: "1rem" }}>
          <thead>
            <tr>
              <th>STT</th>
              <th>Tên</th>
              <th>CCCD</th>
              <th>Giờ vào</th>
              <th>Thao tác</th>
            </tr>
          </thead>
          <tbody>
            {activeGuestVisits.length === 0 ? (
              <tr>
                <td colSpan={5}>Hiện không có khách nào trong công ty.</td>
              </tr>
            ) : (
              activeGuestVisits.map((visit, index) => {
                const visitor = getVisitorForVisit(visit);
                return (
                  <tr key={visit.visitId}>
                    <td>{index + 1}</td>
                    <td>{visitor?.fullName ?? "-"}</td>
                    <td>{visit.qrOrIdNumber || "-"}</td>
                    <td>{new Date(visit.checkInTime).toLocaleString("vi-VN")}</td>
                    <td>
                      <button
                        className="btn btn-primary"
                        onClick={() => handleCheckout(visit)}
                        disabled={checkoutLoadingId === visit.visitId}
                      >
                        {checkoutLoadingId === visit.visitId ? "Đang xử lý..." : "Ra cổng"}
                      </button>
                    </td>
                  </tr>
                );
              })
            )}
          </tbody>
        </table>
        {checkoutError && (
          <div className="login-error">{checkoutError}</div>
        )}
      </div>

      <div className="card">
        <div className="card-header">
          <div>
            <div className="card-title flex items-center gap-3">
              <ListChecks className="h-5 w-5 text-slate-700" aria-hidden="true" />
              <span>Danh sách khách và trạng thái lịch hẹn</span>
            </div>
            <div className="card-subtitle">
              Khách đã đăng ký trước hoặc đã được tạo lịch tại lễ tân. Chỉ khách đã được admin xác nhận (có QR) mới
              được check-in.
            </div>
          </div>
        </div>

        <div style={{ display: "flex", gap: "0.5rem", maxWidth: 520, marginBottom: "0.75rem" }}>
          <input
            type="text"
            className="form-input"
            placeholder="Tìm theo tên, CCCD, SĐT..."
            value={searchTerm}
            onChange={(e) => {
              setPageNumber(1);
              setSearchTerm(e.target.value);
            }}
          />
        </div>

        {loading ? (
          <div>Đang tải dữ liệu...</div>
        ) : (
          <table className="table">
            <thead>
              <tr>
                <th>Họ tên</th>
                <th>CCCD</th>
                <th>SĐT</th>
                <th>Công ty</th>
                <th>Ngày hẹn</th>
                <th>Giờ hẹn</th>
                <th>Trạng thái lịch</th>
                <th>Thao tác</th>
              </tr>
            </thead>
            <tbody>
              {data && data.items.length > 0 ? (
                data.items.map((v) => {
                  const isPreRegistered = !!v.isPreRegistration;
                  const statusLabel = isPreRegistered ? "Lịch đã được xác nhận" : "Đang chờ xác nhận lịch";
                  return (
                    <tr key={v.visitorId}>
                      <td>{v.fullName}</td>
                      <td>{v.idNumber}</td>
                      <td>{v.phone}</td>
                      <td>{v.companyName}</td>
                      <td>{v.appointmentDate ?? "-"}</td>
                      <td>{v.appointmentTime ?? "-"}</td>
                      <td>{statusLabel}</td>
                      <td>
                        <button
                          className="btn btn-primary"
                          onClick={() => handleCheckin(v)}
                          disabled={checkinLoadingId === v.visitorId}
                        >
                          {checkinLoadingId === v.visitorId ? "Đang check-in..." : "Check-in vào công ty"}
                        </button>
                      </td>
                    </tr>
                  );
                })
              ) : (
                <tr>
                  <td colSpan={6}>Chưa có khách nào.</td>
                </tr>
              )}
            </tbody>
          </table>
        )}

        {data && data.totalPages > 1 && (
          <div style={{ marginTop: "0.75rem", display: "flex", alignItems: "center", gap: "0.75rem" }}>
            <button
              className="btn btn-secondary"
              disabled={pageNumber <= 1}
              onClick={() => setPageNumber((prev) => prev - 1)}
            >
              Trang trước
            </button>
            <span>
              Trang {data?.pageNumber}/{data?.totalPages}
            </span>
            <button
              className="btn btn-secondary"
              disabled={data && pageNumber >= data.totalPages}
              onClick={() => setPageNumber((prev) => prev + 1)}
            >
              Trang sau
            </button>
          </div>
        )}

        {checkinError && (
          <div className="login-error" style={{ marginTop: "0.75rem" }}>
            {checkinError}
          </div>
        )}
      </div>
    </div>
  );
};

export default ReceptionCheckinPage;

