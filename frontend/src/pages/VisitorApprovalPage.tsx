import React, { useEffect, useState } from "react";
import { CalendarCheck, ClipboardList, Search } from "lucide-react";
import { visitorApi, Visitor, PagedResult } from "../api/visitorApi";
import { useConfirm } from "../components/ConfirmDialogProvider";
import { useToast } from "../components/ToastProvider";

const VisitorApprovalPage: React.FC = () => {
  const confirm = useConfirm();
  const pushToast = useToast();
  const [data, setData] = useState<PagedResult<Visitor> | null>(null);
  const [pageNumber, setPageNumber] = useState(1);
  const [searchTerm, setSearchTerm] = useState("");
  const [loading, setLoading] = useState(false);
  const [approvingId, setApprovingId] = useState<number | null>(null);
  const [error, setError] = useState<string | null>(null);
  const pageSize = 10;

  const loadVisitors = async () => {
    try {
      setLoading(true);
      setError(null);
      const response = await visitorApi.getVisitors(pageNumber, pageSize, searchTerm);
      setData(response.data);
    } catch (err: any) {
      if (err?.response?.status === 401 || err?.response?.status === 403) {
        setError("Bạn không có quyền xem danh sách khách. Hãy đăng nhập bằng tài khoản Admin hoặc Giám đốc.");
      } else {
        setError("Không thể tải danh sách khách. Vui lòng kiểm tra backend.");
      }
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadVisitors();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [pageNumber, searchTerm]);

  const handleApprove = async (visitor: Visitor) => {
    if (visitor.isPreRegistration) {
      return;
    }
    setError(null);
    setApprovingId(visitor.visitorId);

    const ok = await confirm({
      title: "Xác nhận duyệt lịch hẹn",
      message: `Bạn có chắc muốn duyệt lịch hẹn cho: ${visitor.fullName}?`,
      confirmLabel: "Duyệt",
      cancelLabel: "Hủy",
      tone: "default",
    });

    if (!ok) {
      setApprovingId(null);
      return;
    }

    try {
      const response = await visitorApi.approveVisitor(visitor.visitorId);
      const updated = response.data;
      setData((prev) =>
        prev
          ? {
              ...prev,
              items: prev.items.map((v) => (v.visitorId === updated.visitorId ? updated : v))
            }
          : prev
      );
      pushToast({ type: "success", title: "Duyệt thành công", message: "Lịch hẹn đã được xác nhận." });
      // Notify the sidebar badge counter to refresh immediately.
      window.dispatchEvent(new Event("pendingApprovalChanged"));
    } catch (err: any) {
      if (err?.response?.status === 401 || err?.response?.status === 403) {
        setError("Bạn không có quyền xác nhận lịch. Hãy đăng nhập bằng tài khoản Admin hoặc Giám đốc.");
        pushToast({ type: "error", title: "Không thể duyệt", message: "Bạn không đủ quyền thực hiện." });
      } else if (err?.response?.status === 404) {
        setError("Không tìm thấy khách để xác nhận lịch. Vui lòng tải lại danh sách.");
        pushToast({ type: "error", title: "Không thể duyệt", message: "Dữ liệu không còn tồn tại." });
      } else {
        setError("Không thể xác nhận lịch hẹn. Vui lòng thử lại.");
        pushToast({ type: "error", title: "Không thể duyệt", message: "Vui lòng thử lại sau." });
      }
    } finally {
      setApprovingId(null);
    }
  };

  const pendingCount = data?.items.filter((v) => !v.isPreRegistration)?.length ?? 0;

  return (
    <div>
      <h2 className="page-title flex items-center gap-3">
        <CalendarCheck className="h-6 w-6 text-teal-700" aria-hidden="true" />
        <span>Duyệt lịch hẹn khách</span>
      </h2>

      <div className="card">
        <div className="card-header">
          <div>
            <div className="card-title flex items-center gap-3">
              <Search className="h-5 w-5 text-slate-700" aria-hidden="true" />
              <span>Tìm kiếm khách cần duyệt lịch</span>
            </div>
            <div className="card-subtitle">Lọc theo họ tên, CCCD hoặc số điện thoại</div>
          </div>
        </div>

        <div style={{ display: "flex", gap: "0.5rem", maxWidth: 480 }}>
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

        {error && (
          <div className="login-error" style={{ marginTop: "0.75rem" }}>
            {error}
          </div>
        )}
      </div>

      <div className="card">
        <div className="card-header">
          <div>
            <div className="card-title flex items-center gap-3">
              <ClipboardList className="h-5 w-5 text-slate-700" aria-hidden="true" />
              <span>Danh sách lịch hẹn</span>
            </div>
            <div className="card-subtitle">
              {pendingCount} khách đang chờ xác nhận lịch. Sau khi xác nhận, lễ tân có thể check-in cho khách.
            </div>
          </div>
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
                  const isApproved = !!v.isPreRegistration;
                  const statusLabel = isApproved ? "Lịch đã được xác nhận" : "Đang chờ xác nhận lịch";
                  return (
                    <tr key={v.visitorId}>
                      <td>{v.fullName}</td>
                      <td>{v.idNumber}</td>
                      <td>{v.phone}</td>
                      <td>{v.companyName}</td>
                      <td>{v.appointmentDate ?? "-"}</td>
                      <td>{v.appointmentTime ?? "-"}</td>
                      <td>
                        <span className={`badge ${isApproved ? "badge-success" : "badge-warning"}`}>
                          {statusLabel}
                        </span>
                      </td>
                      <td>
                        {!isApproved && (
                          <button
                            className="btn btn-primary"
                            type="button"
                            onClick={() => handleApprove(v)}
                            disabled={approvingId === v.visitorId}
                          >
                            {approvingId === v.visitorId ? "Đang xác nhận..." : "Xác nhận lịch"}
                          </button>
                        )}
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
              Trang {data.pageNumber}/{data.totalPages}
            </span>
            <button
              className="btn btn-secondary"
              disabled={pageNumber >= (data.totalPages ?? 1)}
              onClick={() => setPageNumber((prev) => prev + 1)}
            >
              Trang sau
            </button>
          </div>
        )}
      </div>
    </div>
  );
};

export default VisitorApprovalPage;

