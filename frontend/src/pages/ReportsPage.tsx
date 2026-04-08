import React, { useEffect, useMemo, useState } from "react";
import { BarChart3, CalendarDays, Flame, Users, Car } from "lucide-react";
import { visitApi, Visit } from "../api/visitApi";
import { visitorApi, Visitor } from "../api/visitorApi";
import * as XLSX from "xlsx";
import {
  Bar,
  BarChart,
  CartesianGrid,
  Legend,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from "recharts";

const COMPANY_CLOSE_HOUR = 17;

const formatDate = (value?: string | null) =>
  value ? new Date(value).toLocaleString("vi-VN") : "-";

const isVisitOverdue = (checkInTime: string): boolean => {
  const now = new Date();
  const currentHour = now.getHours() + now.getMinutes() / 60;
  const todayKey = `${now.getFullYear()}-${now.getMonth()}-${now.getDate()}`;
  const checkIn = new Date(checkInTime);
  const checkInKey = `${checkIn.getFullYear()}-${checkIn.getMonth()}-${checkIn.getDate()}`;
  if (checkInKey < todayKey) return true;
  if (checkInKey === todayKey) return currentHour >= COMPANY_CLOSE_HOUR;
  return false;
};

const getCheckOutDisplay = (visit: Visit): string => {
  if (visit.checkOutTime) return formatDate(visit.checkOutTime);
  return isVisitOverdue(visit.checkInTime) ? "Quá hạn ra vào công ty" : "Chưa ra khỏi công ty";
};

const ReportsPage: React.FC = () => {
  const [fromDate, setFromDate] = useState("");
  const [toDate, setToDate] = useState("");
  const [visits, setVisits] = useState<Visit[]>([]);
  const [visitors, setVisitors] = useState<Visitor[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [filterApplied, setFilterApplied] = useState(false);

  const role = localStorage.getItem("current_role");
  const isAdmin = role === "Admin";
  const isSecurity = role === "Security";
  const isReception = role === "Employee";

  const showGuestReport = isAdmin || isReception;
  const showVehicleReport = isAdmin || isSecurity;

  const guestVisits = visits.filter(
    (v) => !v.vehiclePlate || String(v.vehiclePlate).trim() === ""
  );
  const vehicleVisits = visits.filter(
    (v) => v.vehiclePlate && v.vehiclePlate.trim() !== ""
  );

  const hourlyTraffic = useMemo(() => {
    const rows = Array.from({ length: 24 }).map((_, hour) => ({
      hour,
      label: `${String(hour).padStart(2, "0")}:00`,
      checkIn: 0,
      checkOut: 0,
      total: 0,
    }));

    for (const v of visits) {
      const hIn = new Date(v.checkInTime).getHours();
      if (rows[hIn]) rows[hIn].checkIn += 1;
      if (v.checkOutTime) {
        const hOut = new Date(v.checkOutTime).getHours();
        if (rows[hOut]) rows[hOut].checkOut += 1;
      }
    }

    for (const r of rows) r.total = r.checkIn + r.checkOut;
    return rows;
  }, [visits]);

  const peakHour = useMemo(() => {
    if (!hourlyTraffic.length) return null;
    const best = hourlyTraffic.reduce((acc, cur) => (cur.total > acc.total ? cur : acc), hourlyTraffic[0]);
    return best.total > 0 ? best : null;
  }, [hourlyTraffic]);

  const getVisitorForVisit = (visit: Visit): Visitor | undefined =>
    visitors.find(
      (x) =>
        (x.qrToken && x.qrToken === visit.qrOrIdNumber) ||
        (x.idNumber && x.idNumber === visit.qrOrIdNumber)
    );

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

  const loadReport = async () => {
    setError(null);
    setLoading(true);
    try {
      const res = await visitApi.getVisits(fromDate || undefined, toDate || undefined);
      setVisits(res.data);
      setFilterApplied(true);
    } catch (err: any) {
      if (err?.response?.status === 401 || err?.response?.status === 403) {
        setError("Phiên đăng nhập đã hết hạn hoặc không có quyền xem báo cáo.");
      } else {
        setError("Không thể tải dữ liệu báo cáo. Vui lòng kiểm tra backend.");
      }
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    if (showGuestReport) loadVisitors();
  }, [showGuestReport]);

  const exportGuestExcel = () => {
    const headers = ["STT", "Tên", "CCCD", "Giờ vào", "Giờ ra", "Phòng ban", "Gặp ai"];
    const rows = guestVisits.map((v, i) => {
      const visitor = getVisitorForVisit(v);
      return [
        i + 1,
        visitor?.fullName ?? "-",
        v.qrOrIdNumber || "-",
        formatDate(v.checkInTime),
        getCheckOutDisplay(v),
        visitor?.department ?? "-",
        visitor?.hostName ?? "-"
      ];
    });
    const ws = XLSX.utils.aoa_to_sheet([headers, ...rows]);
    const wb = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(wb, ws, "Bao cao khach");
    XLSX.writeFile(wb, `bao-cao-khach-${fromDate || "all"}-${toDate || "all"}.xlsx`);
  };

  const exportVehicleExcel = () => {
    const headers = ["STT", "Biển số", "Loại xe", "Giờ vào", "Giờ ra"];
    const rows = vehicleVisits.map((v, i) => [
      i + 1,
      v.vehiclePlate,
      v.vehicleType || "-",
      formatDate(v.checkInTime),
      getCheckOutDisplay(v)
    ]);
    const ws = XLSX.utils.aoa_to_sheet([headers, ...rows]);
    const wb = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(wb, ws, "Bao cao xe");
    XLSX.writeFile(wb, `bao-cao-phuong-tien-${fromDate || "all"}-${toDate || "all"}.xlsx`);
  };

  return (
    <div>
      <h2 className="page-title flex items-center gap-3">
        <BarChart3 className="h-6 w-6 text-blue-700" aria-hidden="true" />
        <span>Báo cáo</span>
      </h2>

      <div className="card">
        <div className="card-title flex items-center gap-3">
          <CalendarDays className="h-5 w-5 text-slate-700" aria-hidden="true" />
          <span>Lọc theo ngày</span>
        </div>
        <div className="card-subtitle">
          Chọn khoảng thời gian để xem danh sách ra vào. Để trống để xem tất cả.
        </div>
        <div className="form-grid" style={{ marginTop: "0.75rem", maxWidth: 520 }}>
          <div className="form-field">
            <label className="form-label" htmlFor="report-from">
              Từ ngày
            </label>
            <input
              id="report-from"
              type="date"
              className="form-input"
              value={fromDate}
              onChange={(e) => setFromDate(e.target.value)}
            />
          </div>
          <div className="form-field">
            <label className="form-label" htmlFor="report-to">
              Đến ngày
            </label>
            <input
              id="report-to"
              type="date"
              className="form-input"
              value={toDate}
              onChange={(e) => setToDate(e.target.value)}
            />
          </div>
        </div>
        <div style={{ marginTop: "0.75rem" }}>
          <button
            type="button"
            className="btn btn-primary"
            onClick={loadReport}
            disabled={loading}
          >
            {loading ? "Đang tải..." : "Xem báo cáo"}
          </button>
        </div>
      </div>

      {error && <div className="login-error" style={{ marginBottom: "0.75rem" }}>{error}</div>}

      {filterApplied && (
        <>
          <div className="card" style={{ marginBottom: "1rem" }}>
            <div className="card-title flex items-center gap-3">
              <Flame className="h-5 w-5 text-amber-600" aria-hidden="true" />
              <span>Báo cáo cao điểm</span>
            </div>
            <div className="card-subtitle">
              Thống kê khung giờ có nhiều lượt ra/vào nhất trong khoảng ngày đã chọn để bố trí thêm bảo vệ.
            </div>

            {peakHour ? (
              <div style={{ marginTop: "0.5rem" }}>
                <span className="badge badge-success">
                  Cao điểm: {peakHour.label}–{String((peakHour.hour + 1) % 24).padStart(2, "0")}:00 • Tổng {peakHour.total} lượt
                </span>
              </div>
            ) : (
              <div style={{ marginTop: "0.75rem" }} className="card-subtitle">
                Chưa có dữ liệu trong khoảng thời gian đã chọn.
              </div>
            )}

            <div style={{ width: "100%", height: 280, marginTop: "0.75rem" }}>
              <ResponsiveContainer width="100%" height="100%">
                <BarChart data={hourlyTraffic} margin={{ top: 8, right: 16, bottom: 8, left: 0 }}>
                  <CartesianGrid strokeDasharray="3 3" />
                  <XAxis dataKey="label" interval={2} />
                  <YAxis allowDecimals={false} />
                  <Tooltip
                    formatter={(value: any, name: any) => [value, name === "checkIn" ? "Vào" : name === "checkOut" ? "Ra" : name]}
                    labelFormatter={(label) => `Khung giờ: ${label}`}
                  />
                  <Legend
                    formatter={(value: any) => (value === "checkIn" ? "Vào" : value === "checkOut" ? "Ra" : value)}
                  />
                  <Bar dataKey="checkIn" stackId="a" fill="#2563eb" radius={[6, 6, 0, 0]} />
                  <Bar dataKey="checkOut" stackId="a" fill="#10b981" radius={[6, 6, 0, 0]} />
                </BarChart>
              </ResponsiveContainer>
            </div>
          </div>

          {showGuestReport && (
            <div className="card" style={{ marginBottom: "1rem" }}>
              <div className="card-title flex items-center gap-3">
                <Users className="h-5 w-5 text-indigo-700" aria-hidden="true" />
                <span>Danh sách khách ra vào công ty</span>
              </div>
              <div className="card-subtitle">
                {isAdmin ? "Admin: toàn bộ khách." : "Lễ tân: chỉ xem khách."}
              </div>
              <div style={{ display: "flex", justifyContent: "flex-end", marginBottom: "0.5rem" }}>
                <button type="button" className="btn btn-secondary" onClick={exportGuestExcel}>
                  Xuất Excel (khách)
                </button>
              </div>
              <table className="table">
                <thead>
                  <tr>
                    <th>STT</th>
                    <th>Tên</th>
                    <th>CCCD</th>
                    <th>Giờ vào</th>
                    <th>Giờ ra</th>
                    <th>Phòng ban</th>
                    <th>Gặp ai</th>
                  </tr>
                </thead>
                <tbody>
                  {guestVisits.length === 0 ? (
                    <tr>
                      <td colSpan={7}>Không có dữ liệu khách trong khoảng đã chọn.</td>
                    </tr>
                  ) : (
                    guestVisits.map((visit, index) => {
                      const visitor = getVisitorForVisit(visit);
                      return (
                        <tr key={visit.visitId}>
                          <td>{index + 1}</td>
                          <td>{visitor?.fullName ?? "-"}</td>
                          <td>{visit.qrOrIdNumber || "-"}</td>
                          <td>{formatDate(visit.checkInTime)}</td>
                          <td>{getCheckOutDisplay(visit)}</td>
                          <td>{visitor?.department ?? "-"}</td>
                          <td>{visitor?.hostName ?? "-"}</td>
                        </tr>
                      );
                    })
                  )}
                </tbody>
              </table>
            </div>
          )}

          {showVehicleReport && (
            <div className="card">
              <div className="card-title flex items-center gap-3">
                <Car className="h-5 w-5 text-amber-600" aria-hidden="true" />
                <span>Danh sách phương tiện ra vào bãi xe</span>
              </div>
              <div className="card-subtitle">
                {isAdmin ? "Admin: toàn bộ phương tiện." : "Bảo vệ: chỉ xem phương tiện."}
              </div>
              <div style={{ display: "flex", justifyContent: "flex-end", marginBottom: "0.5rem" }}>
                <button type="button" className="btn btn-secondary" onClick={exportVehicleExcel}>
                  Xuất Excel (phương tiện)
                </button>
              </div>
              <table className="table">
                <thead>
                  <tr>
                    <th>STT</th>
                    <th>Biển số</th>
                    <th>Loại xe</th>
                    <th>Giờ vào</th>
                    <th>Giờ ra</th>
                  </tr>
                </thead>
                <tbody>
                  {vehicleVisits.length === 0 ? (
                    <tr>
                      <td colSpan={5}>Không có dữ liệu phương tiện trong khoảng đã chọn.</td>
                    </tr>
                  ) : (
                    vehicleVisits.map((visit, index) => (
                      <tr key={visit.visitId}>
                        <td>{index + 1}</td>
                        <td>{visit.vehiclePlate}</td>
                        <td>{visit.vehicleType || "-"}</td>
                        <td>{formatDate(visit.checkInTime)}</td>
                        <td>{getCheckOutDisplay(visit)}</td>
                      </tr>
                    ))
                  )}
                </tbody>
              </table>
            </div>
          )}

          {!showGuestReport && !showVehicleReport && (
            <div className="card">Bạn không có quyền xem báo cáo.</div>
          )}
        </>
      )}
    </div>
  );
};

export default ReportsPage;
