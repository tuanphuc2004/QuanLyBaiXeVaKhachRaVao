import React, { useEffect, useMemo, useState } from "react";
import { AlertTriangle, BarChart3, CalendarCheck, Car, Percent, UserCog, UserPlus, Users } from "lucide-react";
import { visitApi, Visit } from "../api/visitApi";
import { visitorApi, Visitor } from "../api/visitorApi";

const COMPANY_CLOSE_HOUR = 17;

function formatDateTime(value?: string | null) {
  if (!value) return "-";
  return new Date(value).toLocaleString("vi-VN");
}

function isAfterClosing(checkInTime: string) {
  const now = new Date();
  const currentHour = now.getHours() + now.getMinutes() / 60;
  const todayKey = `${now.getFullYear()}-${now.getMonth()}-${now.getDate()}`;
  const checkIn = new Date(checkInTime);
  const checkInKey = `${checkIn.getFullYear()}-${checkIn.getMonth()}-${checkIn.getDate()}`;
  if (checkInKey < todayKey) return true;
  if (checkInKey === todayKey) return currentHour >= COMPANY_CLOSE_HOUR;
  return false;
}

const DashboardPage: React.FC = () => {
  const [visits, setVisits] = useState<Visit[]>([]);
  const [visitors, setVisitors] = useState<Visitor[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [selectedActivity, setSelectedActivity] = useState<{
    visit: Visit;
    visitor?: Visitor;
  } | null>(null);
  const [selectedStat, setSelectedStat] = useState<"vehicles" | "people" | "usage" | "alerts" | null>(null);

  const role = localStorage.getItem("current_role");
  const isAdmin = role === "Admin";
  const isSecurity = role === "Security";
  const isReception = role === "Employee";
  const isDirector = role === "Director";

  const getVisitorForVisit = (visit: Visit): Visitor | undefined =>
    visitors.find(
      (x) =>
        (x.qrToken && x.qrToken === visit.qrOrIdNumber) ||
        (x.idNumber && x.idNumber === visit.qrOrIdNumber)
    );

  const activeVisits = useMemo(() => visits.filter((v) => !v.checkOutTime), [visits]);
  const activeVehicleVisits = useMemo(
    () => activeVisits.filter((v) => v.vehiclePlate && String(v.vehiclePlate).trim() !== ""),
    [activeVisits]
  );
  const activeGuestVisits = useMemo(
    () => activeVisits.filter((v) => !v.vehiclePlate || String(v.vehiclePlate).trim() === ""),
    [activeVisits]
  );

  const alertItems = useMemo(() => {
    const guests = activeGuestVisits.filter((v) => isAfterClosing(v.checkInTime));
    const vehicles = activeVehicleVisits.filter((v) => isAfterClosing(v.checkInTime));
    if (role === "Admin" || role === "Director") return { guests, vehicles };
    if (role === "Employee") return { guests, vehicles: [] as Visit[] };
    if (role === "Security") return { guests: [] as Visit[], vehicles };
    return { guests: [] as Visit[], vehicles: [] as Visit[] };
  }, [activeGuestVisits, activeVehicleVisits, role]);

  const usage = useMemo(() => {
    const totalNow = activeGuestVisits.length + activeVehicleVisits.length;
    const share = Math.round((activeVehicleVisits.length / Math.max(1, totalNow)) * 100);
    return { totalNow, vehicleShare: share };
  }, [activeGuestVisits.length, activeVehicleVisits.length]);

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
        setError("Không thể tải dữ liệu dashboard. Vui lòng kiểm tra backend.");
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
        const nextItems = next.data?.items ?? [];
        items.push(...nextItems);
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
    if (isAdmin || isReception || isDirector) loadVisitors();
  }, [isAdmin, isReception, isDirector]);

  return (
    <div>
      <div className="mb-8">
        <h1 className="text-3xl font-bold text-white">Dashboard</h1>
        <p className="text-white/70 mt-1">
          {isAdmin
            ? "Xin chào, Quản trị viên"
            : isDirector
            ? "Xin chào, Giám đốc"
            : isReception
            ? "Xin chào, Lễ tân"
            : "Xin chào, Bảo vệ"}{" "}
          - Tổng quan hoạt động công ty
        </p>
      </div>

      {error && (
        <div className="login-error" style={{ marginBottom: "1rem" }}>
          {error}
        </div>
      )}

      <DashboardStats
        visits={visits}
        isReception={isReception}
        isSecurity={isSecurity}
        loading={loading}
        onOpenStat={(key) => setSelectedStat(key)}
      />

      <div
        className={`grid grid-cols-1 gap-6 mt-8 ${
          isReception || isSecurity ? "" : "lg:grid-cols-3"
        }`}
      >
        <div className={isReception || isSecurity ? "" : "lg:col-span-2"}>
          <div className="bg-white border border-slate-200 rounded-2xl p-6 shadow-sm">
            <div className="mb-4">
              <h2 className="text-lg font-bold text-gray-900">Hoạt động gần đây</h2>
              <p className="text-sm text-gray-500 mt-1">
                {isReception
                  ? "Cập nhật các lượt khách / nhân sự (không bao gồm bãi xe)"
                  : isSecurity
                  ? "Cập nhật các lượt xe (không bao gồm khách không phương tiện)"
                  : "Cập nhật các lượt ra vào mới nhất"}
              </p>
            </div>

            {loading ? (
              <div className="text-sm text-gray-500">Đang tải dữ liệu...</div>
            ) : (
              <RecentActivities
                visits={visits}
                visitors={visitors}
                excludeParking={isReception}
                excludeGuests={isSecurity}
                onSelect={(payload) => setSelectedActivity(payload)}
              />
            )}
          </div>
        </div>

        {!isReception && !isSecurity && (
          <div>
            <div className="bg-white border border-slate-200 rounded-2xl p-6 shadow-sm">
              <h2 className="text-lg font-bold text-gray-900 mb-2">Thao tác nhanh</h2>
              <p className="text-sm text-gray-500 mb-4">Truy cập nhanh các luồng chính</p>

              <div className="space-y-3">
                {isAdmin || isSecurity ? (
                  <button
                    type="button"
                    className="w-full flex items-center justify-start gap-2 px-4 py-3 rounded-xl border border-slate-200 bg-white hover:bg-blue-50 transition-colors"
                    onClick={() => (window.location.href = "/checkin")}
                  >
                    <span className="w-9 h-9 rounded-lg flex items-center justify-center bg-blue-50 border border-blue-100 text-blue-700">
                      <Car className="h-5 w-5" aria-hidden="true" />
                    </span>
                    <span className="font-medium text-gray-900">Đăng ký xe mới</span>
                  </button>
                ) : null}

                {isAdmin ? (
                  <button
                    type="button"
                    className="w-full flex items-center justify-start gap-2 px-4 py-3 rounded-xl border border-slate-200 bg-white hover:bg-indigo-50 transition-colors"
                    onClick={() => (window.location.href = "/visitors/register")}
                  >
                    <span className="w-9 h-9 rounded-lg flex items-center justify-center bg-indigo-50 border border-indigo-100 text-indigo-700">
                      <UserPlus className="h-5 w-5" aria-hidden="true" />
                    </span>
                    <span className="font-medium text-gray-900">Đăng ký khách</span>
                  </button>
                ) : null}

                {isAdmin || isDirector ? (
                  <button
                    type="button"
                    className="w-full flex items-center justify-start gap-2 px-4 py-3 rounded-xl border border-slate-200 bg-white hover:bg-teal-50 transition-colors"
                    onClick={() => (window.location.href = "/visitors/approval")}
                  >
                    <span className="w-9 h-9 rounded-lg flex items-center justify-center bg-teal-50 border border-teal-100 text-teal-700">
                      <CalendarCheck className="h-5 w-5" aria-hidden="true" />
                    </span>
                    <span className="font-medium text-gray-900">Duyệt lịch hẹn</span>
                  </button>
                ) : null}

                {isAdmin ? (
                  <button
                    type="button"
                    className="w-full flex items-center justify-start gap-2 px-4 py-3 rounded-xl border border-slate-200 bg-white hover:bg-slate-50 transition-colors"
                    onClick={() => (window.location.href = "/admin/users")}
                  >
                    <span className="w-9 h-9 rounded-lg flex items-center justify-center bg-slate-100 border border-slate-200 text-slate-700">
                      <UserCog className="h-5 w-5" aria-hidden="true" />
                    </span>
                    <span className="font-medium text-gray-900">Tài khoản & phân quyền</span>
                  </button>
                ) : null}

                {!isDirector && (
                  <>
                <button
                  type="button"
                  className="w-full flex items-center justify-start gap-2 px-4 py-3 rounded-xl border border-slate-200 bg-white hover:bg-purple-50 transition-colors"
                  onClick={() => (window.location.href = "/reports")}
                >
                  <span className="w-9 h-9 rounded-lg flex items-center justify-center bg-purple-50 border border-purple-100 text-purple-700">
                    <BarChart3 className="h-5 w-5" aria-hidden="true" />
                  </span>
                  <span className="font-medium text-gray-900">Xem báo cáo</span>
                </button>

                <button
                  type="button"
                  className="w-full flex items-center justify-start gap-2 px-4 py-3 rounded-xl border border-slate-200 bg-white hover:bg-orange-50 transition-colors"
                  onClick={() => (window.location.href = "/alerts")}
                >
                  <span className="w-9 h-9 rounded-lg flex items-center justify-center bg-orange-50 border border-orange-100 text-orange-700">
                    <AlertTriangle className="h-5 w-5" aria-hidden="true" />
                  </span>
                  <span className="font-medium text-gray-900">Xem cảnh báo</span>
                </button>
                  </>
                )}
              </div>
            </div>
          </div>
        )}
      </div>

      {selectedActivity && (
        <div
          className="dialog-overlay"
          role="dialog"
          aria-modal="true"
          onClick={() => setSelectedActivity(null)}
        >
          <div className="dialog" onClick={(e) => e.stopPropagation()}>
            <div style={{ display: "flex", justifyContent: "space-between", gap: "1rem", alignItems: "center" }}>
              <div>
                <div className="dialog-title">
                  {isSecurity ? "Thông tin lượt xe" : "Thông tin người"}
                </div>
                <div className="dialog-message" style={{ marginTop: "0.25rem" }}>
                  {isSecurity
                    ? selectedActivity.visit.vehiclePlate?.trim() || "Không rõ biển số"
                    : selectedActivity.visitor?.fullName || "Không rõ"}
                </div>
              </div>
              <button type="button" className="btn" aria-label="Đóng" onClick={() => setSelectedActivity(null)}>
                ×
              </button>
            </div>

            <div style={{ marginTop: "1rem", overflowY: "auto", paddingRight: "0.25rem" }}>
              <div style={{ display: "grid", gridTemplateColumns: "1fr", gap: "0.75rem" }}>
              <div className="card" style={{ marginBottom: 0 }}>
                <div className="card-title">Thời gian ra vào</div>
                <div className="card-subtitle" style={{ marginTop: "0.35rem" }}>
                  <div>
                    Vào:{" "}
                    {selectedActivity.visit.checkInTime
                      ? new Date(selectedActivity.visit.checkInTime).toLocaleString("vi-VN")
                      : "-"}
                  </div>
                  <div>
                    Ra:{" "}
                    {selectedActivity.visit.checkOutTime
                      ? new Date(selectedActivity.visit.checkOutTime).toLocaleString("vi-VN")
                      : "Chưa ra"}
                  </div>
                </div>
              </div>

              {!isSecurity && (
              <div className="card" style={{ marginBottom: 0 }}>
                <div className="card-title">Thông tin chi tiết</div>
                <div className="card-subtitle" style={{ marginTop: "0.35rem" }}>
                  <div>CCCD/ID: {selectedActivity.visitor?.idNumber || "-"}</div>
                  <div>SĐT: {selectedActivity.visitor?.phone || "-"}</div>
                  <div>Công ty: {selectedActivity.visitor?.companyName || "-"}</div>
                  <div>Phòng/Bộ phận: {selectedActivity.visitor?.department || "-"}</div>
                </div>
              </div>
              )}

              {!isSecurity && (
              <div className="card" style={{ marginBottom: 0 }}>
                <div className="card-title">Nội dung lịch hẹn</div>
                <div className="card-subtitle" style={{ marginTop: "0.35rem" }}>
                  {selectedActivity.visitor?.appointmentDate || selectedActivity.visitor?.appointmentTime ? (
                    <>
                      <div>Ngày: {selectedActivity.visitor?.appointmentDate || "-"}</div>
                      <div>Giờ: {selectedActivity.visitor?.appointmentTime || "-"}</div>
                      <div>Người mời: {selectedActivity.visitor?.hostName || "-"}</div>
                    </>
                  ) : (
                    <div>Chưa có lịch hẹn.</div>
                  )}
                </div>
              </div>
              )}

              {!isReception &&
                selectedActivity.visit.vehiclePlate &&
                String(selectedActivity.visit.vehiclePlate).trim() !== "" && (
                  <div className="card" style={{ marginBottom: 0 }}>
                    <div className="card-title">Phương tiện</div>
                    <div className="card-subtitle" style={{ marginTop: "0.35rem" }}>
                      <div>Biển số: {selectedActivity.visit.vehiclePlate}</div>
                      <div>Loại xe: {selectedActivity.visit.vehicleType || "-"}</div>
                      <div>Mã QR/ID: {selectedActivity.visit.qrOrIdNumber || "-"}</div>
                    </div>
                  </div>
                )}
              </div>
            </div>
          </div>
        </div>
      )}

      {selectedStat && (
        <div
          className="dialog-overlay"
          role="dialog"
          aria-modal="true"
          onClick={() => setSelectedStat(null)}
        >
          <div className="dialog" onClick={(e) => e.stopPropagation()}>
            <div style={{ display: "flex", justifyContent: "space-between", gap: "1rem", alignItems: "center" }}>
              <div>
                <div className="dialog-title">
                  {selectedStat === "vehicles"
                    ? "Chi tiết xe đang đỗ"
                    : selectedStat === "people"
                    ? "Chi tiết người trong công ty"
                    : selectedStat === "usage"
                    ? "Chi tiết tỷ lệ sử dụng"
                    : "Chi tiết cảnh báo"}
                </div>
                <div className="dialog-message" style={{ marginTop: "0.25rem" }}>
                  {selectedStat === "vehicles"
                    ? `Đang trong bãi: ${activeVehicleVisits.length} xe`
                    : selectedStat === "people"
                    ? `Đang trong công ty: ${activeGuestVisits.length} người`
                    : selectedStat === "usage"
                    ? isSecurity
                      ? `Xe trong bãi: ${activeVehicleVisits.length} • Tỷ lệ xe: ${usage.vehicleShare}%`
                      : `Tổng lượt đang hoạt động: ${usage.totalNow} • Tỷ lệ xe: ${usage.vehicleShare}%`
                    : `Cảnh báo: ${
                        isSecurity ? alertItems.vehicles.length : alertItems.guests.length + alertItems.vehicles.length
                      } lượt cần xử lý`}
                </div>
              </div>
              <button type="button" className="btn" aria-label="Đóng" onClick={() => setSelectedStat(null)}>
                ×
              </button>
            </div>

            <div style={{ marginTop: "1rem", overflowY: "auto", paddingRight: "0.25rem" }}>
              {selectedStat === "vehicles" && (
                <table className="table">
                  <thead>
                    <tr>
                      <th>STT</th>
                      <th>Biển số</th>
                      <th>Loại xe</th>
                      <th>Giờ vào</th>
                    </tr>
                  </thead>
                  <tbody>
                    {activeVehicleVisits.length === 0 ? (
                      <tr>
                        <td colSpan={4}>Không có xe nào đang trong bãi.</td>
                      </tr>
                    ) : (
                      activeVehicleVisits.slice(0, 50).map((v, idx) => (
                        <tr key={v.visitId}>
                          <td>{idx + 1}</td>
                          <td>{v.vehiclePlate}</td>
                          <td>{v.vehicleType || "-"}</td>
                          <td>{formatDateTime(v.checkInTime)}</td>
                        </tr>
                      ))
                    )}
                  </tbody>
                </table>
              )}

              {selectedStat === "people" && !isSecurity && (
                <table className="table">
                  <thead>
                    <tr>
                      <th>STT</th>
                      <th>Họ tên</th>
                      <th>Phòng/Bộ phận</th>
                      <th>Công ty</th>
                      <th>Giờ vào</th>
                    </tr>
                  </thead>
                  <tbody>
                    {activeGuestVisits.length === 0 ? (
                      <tr>
                        <td colSpan={5}>Không có khách nào đang trong công ty.</td>
                      </tr>
                    ) : (
                      activeGuestVisits.slice(0, 50).map((v, idx) => {
                        const person = getVisitorForVisit(v);
                        return (
                          <tr key={v.visitId}>
                            <td>{idx + 1}</td>
                            <td>{person?.fullName ?? "-"}</td>
                            <td>{person?.department ?? "-"}</td>
                            <td>{person?.companyName ?? "-"}</td>
                            <td>{formatDateTime(v.checkInTime)}</td>
                          </tr>
                        );
                      })
                    )}
                  </tbody>
                </table>
              )}

              {selectedStat === "usage" && (
                <div className="card" style={{ marginBottom: 0 }}>
                  <div className="card-title">Tổng quan</div>
                  <div className="card-subtitle" style={{ marginTop: "0.35rem" }}>
                    {!isSecurity && <div>Tổng lượt đang hoạt động: {usage.totalNow}</div>}
                    <div>Xe đang đỗ: {activeVehicleVisits.length}</div>
                    {!isSecurity && <div>Người trong công ty: {activeGuestVisits.length}</div>}
                    <div>Tỷ lệ xe: {usage.vehicleShare}%</div>
                  </div>
                </div>
              )}

              {selectedStat === "alerts" && (
                <>
                  {!isSecurity && (
                  <div className="card" style={{ marginBottom: "0.75rem" }}>
                    <div className="card-title">Cảnh báo khách</div>
                    <div className="card-subtitle" style={{ marginTop: "0.35rem" }}>
                      {alertItems.guests.length} lượt
                    </div>
                    <table className="table" style={{ marginTop: "0.75rem" }}>
                      <thead>
                        <tr>
                          <th>STT</th>
                          <th>Họ tên</th>
                          <th>Giờ vào</th>
                        </tr>
                      </thead>
                      <tbody>
                        {alertItems.guests.length === 0 ? (
                          <tr>
                            <td colSpan={3}>Không có.</td>
                          </tr>
                        ) : (
                          alertItems.guests.slice(0, 30).map((v, idx) => (
                            <tr key={v.visitId}>
                              <td>{idx + 1}</td>
                              <td>{getVisitorForVisit(v)?.fullName ?? "-"}</td>
                              <td>{formatDateTime(v.checkInTime)}</td>
                            </tr>
                          ))
                        )}
                      </tbody>
                    </table>
                  </div>
                  )}

                  {!isReception && (
                  <div className="card" style={{ marginBottom: 0 }}>
                    <div className="card-title">Cảnh báo phương tiện</div>
                    <div className="card-subtitle" style={{ marginTop: "0.35rem" }}>
                      {alertItems.vehicles.length} lượt
                    </div>
                    <table className="table" style={{ marginTop: "0.75rem" }}>
                      <thead>
                        <tr>
                          <th>STT</th>
                          <th>Biển số</th>
                          <th>Giờ vào</th>
                        </tr>
                      </thead>
                      <tbody>
                        {alertItems.vehicles.length === 0 ? (
                          <tr>
                            <td colSpan={3}>Không có.</td>
                          </tr>
                        ) : (
                          alertItems.vehicles.slice(0, 30).map((v, idx) => (
                            <tr key={v.visitId}>
                              <td>{idx + 1}</td>
                              <td>{v.vehiclePlate}</td>
                              <td>{formatDateTime(v.checkInTime)}</td>
                            </tr>
                          ))
                        )}
                      </tbody>
                    </table>
                  </div>
                  )}
                </>
              )}
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

export default DashboardPage;

function DashboardStats({
  visits,
  isReception,
  isSecurity,
  loading,
  onOpenStat,
}: {
  visits: Visit[];
  isReception: boolean;
  isSecurity: boolean;
  loading: boolean;
  onOpenStat?: (key: "vehicles" | "people" | "usage" | "alerts") => void;
}) {
  const role = localStorage.getItem("current_role");
  const activeVisits = useMemo(() => visits.filter((v) => !v.checkOutTime), [visits]);

  const activeGuestVisits = useMemo(
    () =>
      activeVisits.filter(
        (v) => !v.vehiclePlate || String(v.vehiclePlate).trim() === ""
      ),
    [activeVisits],
  );
  const activeVehicles = useMemo(
    () => activeVisits.filter((v) => v.vehiclePlate && v.vehiclePlate.trim() !== ""),
    [activeVisits],
  );

  const computeAlertCount = (allVisits: Visit[], currentRole: string | null): number => {
    const now = new Date();
    const currentHour = now.getHours() + now.getMinutes() / 60;
    const todayKey = `${now.getFullYear()}-${now.getMonth()}-${now.getDate()}`;

    const isAfterClosing = (checkInTime: string) => {
      const checkIn = new Date(checkInTime);
      const checkInKey = `${checkIn.getFullYear()}-${checkIn.getMonth()}-${checkIn.getDate()}`;
      if (checkInKey < todayKey) return true;
      if (checkInKey === todayKey) return currentHour >= COMPANY_CLOSE_HOUR;
      return false;
    };

    const guests = allVisits
      .filter((v) => !v.checkOutTime)
      .filter((v) => !v.vehiclePlate || String(v.vehiclePlate).trim() === "");
    const vehicles = allVisits
      .filter((v) => !v.checkOutTime)
      .filter((v) => v.vehiclePlate && v.vehiclePlate.trim() !== "");

    const guestAlerts = guests.filter((v) => isAfterClosing(v.checkInTime)).length;
    const vehicleAlerts = vehicles.filter((v) => isAfterClosing(v.checkInTime)).length;

    if (currentRole === "Admin" || currentRole === "Director") return guestAlerts + vehicleAlerts;
    if (currentRole === "Employee") return guestAlerts;
    if (currentRole === "Security") return vehicleAlerts;
    return 0;
  };

  const alertCount = useMemo(() => computeAlertCount(visits, role), [visits, role]);

  const totalNow = activeGuestVisits.length + activeVehicles.length;
  const vehicleShare = Math.round((activeVehicles.length / Math.max(1, totalNow)) * 100);

  const nowMs = Date.now();
  const last24hMs = nowMs - 24 * 60 * 60 * 1000;
  const vehicles24h = visits.filter((v) => v.vehiclePlate && v.vehiclePlate.trim() !== "" && new Date(v.checkInTime).getTime() >= last24hMs).length;
  const guests24h = visits.filter((v) => (!v.vehiclePlate || String(v.vehiclePlate).trim() === "") && new Date(v.checkInTime).getTime() >= last24hMs).length;

  const showParkingStats = !isReception;
  const showGuestStats = !isSecurity;

  if (loading) {
    const n = isReception ? 2 : isSecurity ? 3 : 4;
    return (
      <div
        className={`grid grid-cols-1 gap-6 mb-8 ${
          isReception ? "md:grid-cols-2" : isSecurity ? "md:grid-cols-3" : "md:grid-cols-2 lg:grid-cols-4"
        }`}
      >
        {Array.from({ length: n }).map((_, i) => (
          <div key={i} className="bg-white border border-slate-200 rounded-2xl p-6 shadow-sm animate-pulse" />
        ))}
      </div>
    );
  }

  return (
    <div
      className={`grid grid-cols-1 gap-6 mb-8 ${
        isReception ? "md:grid-cols-2" : isSecurity ? "md:grid-cols-3" : "md:grid-cols-2 lg:grid-cols-4"
      }`}
    >
      {showParkingStats && (
      <button
        type="button"
        onClick={() => onOpenStat?.("vehicles")}
        className="bg-white border border-slate-200 rounded-2xl p-6 shadow-sm text-left hover:bg-blue-50 transition-colors"
        style={{ cursor: "pointer" }}
      >
        <div className="flex items-center justify-between">
          <div className="text-sm text-gray-600 font-medium">Xe đang đỗ</div>
          <div className="w-11 h-11 rounded-xl bg-blue-700 flex items-center justify-center text-white">
            <Car className="h-5 w-5" aria-hidden="true" />
          </div>
        </div>
        <div className="flex items-baseline space-x-2 mt-4">
          <span className="text-3xl font-bold text-gray-900">{activeVehicles.length}</span>
          <span className="text-sm text-gray-500">/ {totalNow || 0}</span>
        </div>
        <div className="text-xs text-gray-500 mt-2">{vehicles24h} trong 24h</div>
      </button>
      )}

      {showGuestStats && (
      <button
        type="button"
        onClick={() => onOpenStat?.("people")}
        className="bg-white border border-slate-200 rounded-2xl p-6 shadow-sm text-left hover:bg-green-50 transition-colors"
        style={{ cursor: "pointer" }}
      >
        <div className="flex items-center justify-between">
          <div className="text-sm text-gray-600 font-medium">Người trong công ty</div>
          <div className="w-11 h-11 rounded-xl bg-green-700 flex items-center justify-center text-white">
            <Users className="h-5 w-5" aria-hidden="true" />
          </div>
        </div>
        <div className="flex items-baseline space-x-2 mt-4">
          <span className="text-3xl font-bold text-gray-900">{activeGuestVisits.length}</span>
          <span className="text-sm text-gray-500">/ {totalNow || 0}</span>
        </div>
        <div className="text-xs text-gray-500 mt-2">{guests24h} hôm nay</div>
      </button>
      )}

      {showParkingStats && (
      <button
        type="button"
        onClick={() => onOpenStat?.("usage")}
        className="bg-white border border-slate-200 rounded-2xl p-6 shadow-sm text-left hover:bg-purple-50 transition-colors"
        style={{ cursor: "pointer" }}
      >
        <div className="flex items-center justify-between">
          <div className="text-sm text-gray-600 font-medium">Tỷ lệ sử dụng</div>
          <div className="w-11 h-11 rounded-xl bg-purple-700 flex items-center justify-center text-white">
            <Percent className="h-5 w-5" aria-hidden="true" />
          </div>
        </div>
        <div className="flex items-baseline space-x-2 mt-4">
          <span className="text-3xl font-bold text-gray-900">{vehicleShare}%</span>
          <span className="text-sm text-gray-500">bãi xe</span>
        </div>
        <div className="text-xs text-gray-500 mt-2">{alertCount > 0 ? "Cần xử lý" : "Bình thường"}</div>
      </button>
      )}

      <button
        type="button"
        onClick={() => onOpenStat?.("alerts")}
        className="bg-white border border-slate-200 rounded-2xl p-6 shadow-sm text-left hover:bg-orange-50 transition-colors"
        style={{ cursor: "pointer" }}
      >
        <div className="flex items-center justify-between">
          <div className="text-sm text-gray-600 font-medium">Cảnh báo</div>
          <div className="w-11 h-11 rounded-xl bg-orange-600 flex items-center justify-center text-white">
            <AlertTriangle className="h-5 w-5" aria-hidden="true" />
          </div>
        </div>
        <div className="flex items-baseline space-x-2 mt-4">
          <span className="text-3xl font-bold text-gray-900">{alertCount}</span>
          <span className="text-sm text-gray-500">sự kiện</span>
        </div>
        <div className="text-xs text-gray-500 mt-2">{alertCount > 0 ? "Cần xử lý" : "Không có"}</div>
      </button>
    </div>
  );
}

function RecentActivities({
  visits,
  visitors,
  excludeParking,
  excludeGuests,
  onSelect,
}: {
  visits: Visit[];
  visitors: Visitor[];
  excludeParking?: boolean;
  excludeGuests?: boolean;
  onSelect?: (payload: { visit: Visit; visitor?: Visitor }) => void;
}) {
  const getVisitorForVisit = (visit: Visit): Visitor | undefined =>
    visitors.find(
      (x) =>
        (x.qrToken && x.qrToken === visit.qrOrIdNumber) ||
        (x.idNumber && x.idNumber === visit.qrOrIdNumber)
    );

  const items = useMemo(() => {
    const base = excludeParking
      ? visits.filter((v) => !v.vehiclePlate || String(v.vehiclePlate).trim() === "")
      : excludeGuests
      ? visits.filter((v) => v.vehiclePlate && String(v.vehiclePlate).trim() !== "")
      : visits;
    return [...base]
      .sort((a, b) => new Date(b.checkInTime).getTime() - new Date(a.checkInTime).getTime())
      .slice(0, 6)
      .map((v) => {
        const visitor = getVisitorForVisit(v);
        const isParking = !!v.vehiclePlate && String(v.vehiclePlate).trim() !== "";
        const isEmployee = !isParking && !!visitor?.department;
        const action = isParking ? (v.checkOutTime ? "Xe ra" : "Xe vào") : isEmployee ? "Nhân viên vào" : "Khách vào";
        const time = new Date(v.checkInTime).toLocaleTimeString("vi-VN", { hour: "2-digit", minute: "2-digit" });
        const details = isParking
          ? `${v.vehiclePlate} ${v.vehicleType ? `- ${v.vehicleType}` : ""}`.trim()
          : `${visitor?.department || visitor?.companyName || "-"}`;
        const user = visitor?.fullName || "-";
        const pillBg = isParking ? "bg-blue-100 text-blue-600" : "bg-green-100 text-green-600";
        return { v, visitor, isParking, isEmployee, action, details, user, time, pillBg };
      });
  }, [visits, visitors, excludeParking, excludeGuests]);

  if (items.length === 0) {
    return <div className="text-sm text-gray-500">Không có hoạt động gần đây.</div>;
  }

  return (
    <div className="space-y-4">
      {items.map((it) => (
        <button
          key={it.v.visitId}
          className="flex items-center justify-between p-4 rounded-xl border border-slate-200 hover:bg-slate-50 transition-colors"
          type="button"
          style={{ width: "100%", cursor: "pointer" }}
          onClick={() => onSelect?.({ visit: it.v, visitor: it.visitor })}
        >
          <div className="flex items-center gap-4">
            <div className={`w-10 h-10 rounded-xl flex items-center justify-center ${it.pillBg} font-bold text-sm`}>
              {it.isParking ? (
                <Car className="h-5 w-5" aria-hidden="true" />
              ) : it.isEmployee ? (
                <UserPlus className="h-5 w-5" aria-hidden="true" />
              ) : (
                <Users className="h-5 w-5" aria-hidden="true" />
              )}
            </div>
            <div>
              <div className="font-medium text-gray-900">{it.action}</div>
              <div className="text-sm text-gray-500">{it.details}</div>
            </div>
          </div>
          <div className="text-right">
            <div className="text-sm font-medium text-gray-900">{it.user}</div>
            <div className="text-sm text-gray-500">{it.time}</div>
          </div>
        </button>
      ))}
    </div>
  );
}

