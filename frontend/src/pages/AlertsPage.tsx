import React, { useEffect, useState } from "react";
import { AlertTriangle, Car, Users } from "lucide-react";
import { visitApi, Visit } from "../api/visitApi";
import { visitorApi, Visitor } from "../api/visitorApi";

const COMPANY_CLOSE_HOUR = 17;

const AlertsPage: React.FC = () => {
  const [visits, setVisits] = useState<Visit[]>([]);
  const [visitors, setVisitors] = useState<Visitor[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const role = localStorage.getItem("current_role");
  const isAdmin = role === "Admin";
  const isSecurity = role === "Security";
  const isReception = role === "Employee";

  const showGuestSection = isAdmin || isReception;
  const showParkingSection = isAdmin || isSecurity;

  const loadVisits = async () => {
    try {
      setLoading(true);
      setError(null);
      const response = await visitApi.getVisits();
      setVisits(response.data);
    } catch (err: any) {
      if (err?.response?.status === 401 || err?.response?.status === 403) {
        setError("Phiên đăng nhập đã hết hạn hoặc không có quyền xem dữ liệu. Hãy đăng nhập lại.");
      } else {
        setError("Không thể tải dữ liệu cảnh báo. Vui lòng kiểm tra backend.");
      }
    } finally {
      setLoading(false);
    }
  };

  const loadVisitors = async () => {
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

  useEffect(() => {
    loadVisits();
  }, []);

  useEffect(() => {
    if (showGuestSection) loadVisitors();
  }, [showGuestSection]);

  const activeVisits = visits.filter((v) => !v.checkOutTime);
  const activeGuestVisits = activeVisits.filter(
    (v) => !v.vehiclePlate || String(v.vehiclePlate).trim() === ""
  );
  const activeVehicles = activeVisits.filter(
    (v) => v.vehiclePlate && v.vehiclePlate.trim() !== ""
  );

  const getVisitorForVisit = (visit: Visit): Visitor | undefined =>
    visitors.find(
      (x) =>
        (x.qrToken && x.qrToken === visit.qrOrIdNumber) ||
        (x.idNumber && x.idNumber === visit.qrOrIdNumber)
    );

  const now = new Date();
  const currentHour = now.getHours() + now.getMinutes() / 60;
  const todayKey = `${now.getFullYear()}-${now.getMonth()}-${now.getDate()}`;

  // Per visit: red if check-in was on a previous day, or same day but current time >= 17h.
  const isVisitAfterClosing = (checkInTime: string): boolean => {
    const checkIn = new Date(checkInTime);
    const checkInKey = `${checkIn.getFullYear()}-${checkIn.getMonth()}-${checkIn.getDate()}`;
    if (checkInKey < todayKey) return true;
    if (checkInKey === todayKey) return currentHour >= COMPANY_CLOSE_HOUR;
    return false;
  };

  const isAfterClosing = currentHour >= COMPANY_CLOSE_HOUR;

  // Green: within regulated hours (8h-17h) today. Red: past 17h or check-in was on a previous day.
  const StatusDot: React.FC<{ afterClosing: boolean }> = ({ afterClosing }) => (
    <span
      title={afterClosing ? "Cảnh báo: đã quá giờ đóng cổng (17h), chưa check-out" : "Trong giờ quy định (8h-17h)"}
      style={{
        display: "inline-block",
        width: 12,
        height: 12,
        borderRadius: "50%",
        backgroundColor: afterClosing ? "#ef4444" : "#22c55e"
      }}
    />
  );

  return (
    <div>
      <h2 className="page-title flex items-center gap-3">
        <AlertTriangle className="h-6 w-6 text-orange-700" aria-hidden="true" />
        <span>Cảnh báo</span>
      </h2>

      <div className="card" style={{ marginBottom: "1rem" }}>
        <div className="card-subtitle">
          Công ty mở cửa từ 8h đến 17h. Danh sách dưới đây là khách / xe còn trong công ty chưa check-out.
          {isAfterClosing && (
            <span style={{ color: "var(--color-danger, #c00)", fontWeight: 600 }}>
              {" "}Đã quá giờ đóng cổng (17h).
            </span>
          )}
        </div>
        <div className="card-subtitle" style={{ marginTop: "0.5rem", display: "flex", alignItems: "center", gap: "1rem", flexWrap: "wrap" }}>
          <span style={{ display: "flex", alignItems: "center", gap: "0.35rem" }}>
            <span style={{ width: 12, height: 12, borderRadius: "50%", backgroundColor: "#22c55e", display: "inline-block" }} />
            Trong giờ quy định (8h-17h), chưa check-out
          </span>
          <span style={{ display: "flex", alignItems: "center", gap: "0.35rem" }}>
            <span style={{ width: 12, height: 12, borderRadius: "50%", backgroundColor: "#ef4444", display: "inline-block" }} />
            Cảnh báo: đã quá giờ đóng cổng (17h) vẫn chưa ra
          </span>
        </div>
      </div>

      {error && <div className="login-error" style={{ marginBottom: "0.75rem" }}>{error}</div>}

      {loading ? (
        <div className="card">Đang tải dữ liệu...</div>
      ) : (
        <>
          {showGuestSection && (
            <div className="card" style={{ marginBottom: "1rem" }}>
              <div className="card-title flex items-center gap-3">
                <Users className="h-5 w-5 text-slate-700" aria-hidden="true" />
                <span>Khách trong công ty</span>
              </div>
              <div className="card-subtitle">
                Khách đã check-in và chưa check-out (Lễ tân, Admin xem)
              </div>
              <table className="table">
                <thead>
                  <tr>
                    <th>STT</th>
                    <th>Tên</th>
                    <th>CCCD</th>
                    <th>Giờ vào</th>
                    <th>Phòng ban</th>
                    <th>Gặp ai</th>
                    <th>Trạng thái</th>
                  </tr>
                </thead>
                <tbody>
                  {activeGuestVisits.length === 0 ? (
                    <tr>
                      <td colSpan={7}>Không có khách nào còn trong công ty.</td>
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
                          <td>{visitor?.department ?? "-"}</td>
                          <td>{visitor?.hostName ?? "-"}</td>
                          <td><StatusDot afterClosing={isVisitAfterClosing(visit.checkInTime)} /></td>
                        </tr>
                      );
                    })
                  )}
                </tbody>
              </table>
            </div>
          )}

          {showParkingSection && (
            <div className="card">
              <div className="card-title flex items-center gap-3">
                <Car className="h-5 w-5 text-slate-700" aria-hidden="true" />
                <span>Bãi giữ xe</span>
              </div>
              <div className="card-subtitle">
                Xe còn trong bãi chưa check-out (Bảo vệ, Admin xem)
              </div>
              <table className="table">
                <thead>
                  <tr>
                    <th>STT</th>
                    <th>Biển số</th>
                    <th>Loại xe</th>
                    <th>Giờ vào</th>
                    <th>Trạng thái</th>
                  </tr>
                </thead>
                <tbody>
                  {activeVehicles.length === 0 ? (
                    <tr>
                      <td colSpan={5}>Không có xe nào còn trong bãi.</td>
                    </tr>
                  ) : (
                    activeVehicles.map((visit, index) => (
                      <tr key={visit.visitId}>
                        <td>{index + 1}</td>
                        <td>{visit.vehiclePlate}</td>
                        <td>{visit.vehicleType || "-"}</td>
                        <td>{new Date(visit.checkInTime).toLocaleString("vi-VN")}</td>
                        <td><StatusDot afterClosing={isVisitAfterClosing(visit.checkInTime)} /></td>
                      </tr>
                    ))
                  )}
                </tbody>
              </table>
            </div>
          )}

          {!showGuestSection && !showParkingSection && (
            <div className="card">Bạn không có quyền xem mục cảnh báo.</div>
          )}
        </>
      )}
    </div>
  );
};

export default AlertsPage;
