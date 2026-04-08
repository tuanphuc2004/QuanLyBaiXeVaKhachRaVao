import React, { useEffect, useState } from "react";
import { NavLink, Navigate, Route, Routes, useLocation, useNavigate } from "react-router-dom";
import { AlignJustify, AlertTriangle, Ban, BarChart3, CalendarCheck, Car, ClipboardCheck, LayoutDashboard, UserCog, UserPlus, Users } from "lucide-react";
import DashboardPage from "./pages/DashboardPage";
import VisitorListPage from "./pages/VisitorListPage";
import VisitorRegistrationPage from "./pages/VisitorRegistrationPage";
import VisitorApprovalPage from "./pages/VisitorApprovalPage";
import CheckinPage from "./pages/CheckinPage";
import CheckoutPage from "./pages/CheckoutPage";
import BlacklistPage from "./pages/BlacklistPage";
import ReceptionCheckinPage from "./pages/ReceptionCheckinPage";
import AlertsPage from "./pages/AlertsPage";
import ReportsPage from "./pages/ReportsPage";
import LoginPage from "./pages/LoginPage";
import CustomerAppointmentPage from "./pages/CustomerAppointmentPage";
import UserAccountsPage from "./pages/UserAccountsPage";
import { visitApi, Visit } from "./api/visitApi";
import { visitorApi } from "./api/visitorApi";
import { ToastProvider } from "./components/ToastProvider";
import { ConfirmDialogProvider } from "./components/ConfirmDialogProvider";

const COMPANY_CLOSE_HOUR = 17;

function computeAlertCount(visits: Visit[], role: string | null): number {
  const active = visits.filter((v) => !v.checkOutTime);
  const guests = active.filter((v) => !v.vehiclePlate || String(v.vehiclePlate).trim() === "");
  const vehicles = active.filter((v) => v.vehiclePlate && v.vehiclePlate.trim() !== "");
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
  const guestAlerts = guests.filter((v) => isAfterClosing(v.checkInTime)).length;
  const vehicleAlerts = vehicles.filter((v) => isAfterClosing(v.checkInTime)).length;
  if (role === "Admin" || role === "Director") return guestAlerts + vehicleAlerts;
  if (role === "Employee") return guestAlerts;
  if (role === "Security") return vehicleAlerts;
  return 0;
}

/** Director: dashboard + approval only; block other app routes. */
const DIRECTOR_ALLOWED_PATHS = new Set(["/", "/visitors/approval"]);

const DirectorRouteGuard: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const location = useLocation();
  const token = localStorage.getItem("access_token");
  const currentRole = localStorage.getItem("current_role");
  if (
    token &&
    currentRole === "Director" &&
    !DIRECTOR_ALLOWED_PATHS.has(location.pathname) &&
    location.pathname !== "/login" &&
    !location.pathname.startsWith("/public")
  ) {
    return <Navigate to="/visitors/approval" replace />;
  }
  return <>{children}</>;
};

const RequireAuth: React.FC<{ children: JSX.Element }> = ({ children }) => {
  const location = useLocation();
  const token = localStorage.getItem("access_token");

  if (!token) {
    return <Navigate to="/login" state={{ from: location }} replace />;
  }

  return children;
};

const App: React.FC = () => {
  const navigate = useNavigate();
  const location = useLocation();
  const token = localStorage.getItem("access_token");
  const fullName = localStorage.getItem("current_full_name");
  const role = localStorage.getItem("current_role");
  const isLoginPage = location.pathname === "/login";
  const isPublicPage = location.pathname.startsWith("/public");

  const [alertCount, setAlertCount] = useState(0);
  const [pendingApprovalCount, setPendingApprovalCount] = useState(0);

  useEffect(() => {
    if (!token || !role) return;
    const fetch = () => {
      visitApi.getVisits().then((res) => {
        setAlertCount(computeAlertCount(res.data, role));
      }).catch(() => setAlertCount(0));
    };
    fetch();
    const onFocus = () => fetch();
    window.addEventListener("focus", onFocus);
    return () => window.removeEventListener("focus", onFocus);
  }, [token, role]);

  useEffect(() => {
    if (!token || (role !== "Admin" && role !== "Director")) return;
    const fetch = () => {
      visitorApi.getPendingApprovalCount().then((res) => {
        setPendingApprovalCount(res.data?.count ?? 0);
      }).catch(() => setPendingApprovalCount(0));
    };
    fetch();
    const onFocus = () => fetch();
    window.addEventListener("focus", onFocus);
    const onPendingApprovalChanged = () => fetch();
    window.addEventListener("pendingApprovalChanged", onPendingApprovalChanged);
    return () => {
      window.removeEventListener("focus", onFocus);
      window.removeEventListener("pendingApprovalChanged", onPendingApprovalChanged);
    };
  }, [token, role]);

  const roleDisplay =
    role === "Admin" ? "Quản trị"
    : role === "Director" ? "Giám đốc"
    : role === "Employee" ? "Lễ tân"
    : role === "Security" ? "Bảo vệ"
    : role || "";

  const canSeeVisitorPages = role === "Admin" || role === "Employee";
  const isAdmin = role === "Admin";
  const isDirector = role === "Director";
  const canSeeReceptionCheckin = role === "Admin" || role === "Employee";
  const canSeeParkingOps = role === "Admin" || role === "Security";
  const [sidebarOpen, setSidebarOpen] = useState(true);

  const handleLogout = () => {
    localStorage.removeItem("access_token");
    localStorage.removeItem("current_username");
    localStorage.removeItem("current_full_name");
    localStorage.removeItem("current_role");
    navigate("/login");
  };

  const appRoutes = (
    <Routes>
      <Route path="/login" element={<LoginPage />} />
      <Route path="/public/appointment" element={<CustomerAppointmentPage />} />
      <Route
        path="/"
        element={
          <RequireAuth>
            <DashboardPage />
          </RequireAuth>
        }
      />
      <Route
        path="/alerts"
        element={
          <RequireAuth>
            <AlertsPage />
          </RequireAuth>
        }
      />
      <Route
        path="/reports"
        element={
          <RequireAuth>
            <ReportsPage />
          </RequireAuth>
        }
      />
      <Route
        path="/visitors"
        element={
          <RequireAuth>
            <VisitorListPage />
          </RequireAuth>
        }
      />
      <Route
        path="/visitors/approval"
        element={
          <RequireAuth>
            <VisitorApprovalPage />
          </RequireAuth>
        }
      />
      <Route
        path="/visitors/register"
        element={
          <RequireAuth>
            <VisitorRegistrationPage />
          </RequireAuth>
        }
      />
      <Route
        path="/reception-checkin"
        element={
          <RequireAuth>
            <ReceptionCheckinPage />
          </RequireAuth>
        }
      />
      <Route
        path="/checkin"
        element={
          <RequireAuth>
            <CheckinPage />
          </RequireAuth>
        }
      />
      <Route
        path="/checkout"
        element={
          <RequireAuth>
            <CheckoutPage />
          </RequireAuth>
        }
      />
      <Route
        path="/blacklist"
        element={
          <RequireAuth>
            <BlacklistPage />
          </RequireAuth>
        }
      />
      <Route
        path="/admin/users"
        element={
          <RequireAuth>
            <UserAccountsPage />
          </RequireAuth>
        }
      />
    </Routes>
  );

  const shouldUseProjectALayout = !isLoginPage && !isPublicPage;

  const navItems = [
    {
      label: "Tổng quan",
      to: "/",
      visible: true,
      badge: null,
      icon: LayoutDashboard,
      end: true,
      iconBgClass: "bg-blue-50",
      iconBorderClass: "border border-blue-100",
      iconTextClass: "text-blue-700",
      activeClass: "bg-blue-50 text-blue-700",
      inactiveClass: "text-gray-700 hover:bg-blue-50",
    },
    {
      label: "Cảnh báo",
      to: "/alerts",
      // Admin: full page; Reception: guest; Security: vehicle.
      icon: AlertTriangle,
      visible: isAdmin || role === "Security" || role === "Employee",
      badge: alertCount > 0 ? alertCount : null,
      end: false,
      iconBgClass: "bg-orange-50",
      iconBorderClass: "border border-orange-100",
      iconTextClass: "text-orange-700",
      activeClass: "bg-orange-50 text-orange-700",
      inactiveClass: "text-gray-700 hover:bg-orange-50",
      badgeBgClass: "bg-orange-600",
    },
    {
      label: "Báo cáo",
      to: "/reports",
      // Admin: full report; Reception: guest; Security: vehicle.
      icon: BarChart3,
      visible: isAdmin || role === "Security" || role === "Employee",
      badge: null,
      end: false,
      iconBgClass: "bg-purple-50",
      iconBorderClass: "border border-purple-100",
      iconTextClass: "text-purple-700",
      activeClass: "bg-purple-50 text-purple-700",
      inactiveClass: "text-gray-700 hover:bg-purple-50",
    },
    {
      label: "Danh sách khách đăng ký trước đã duyệt",
      to: "/visitors",
      visible: isAdmin && canSeeVisitorPages,
      badge: null,
      icon: Users,
      // Use exact match, so "/visitors/approval" does not also mark "/visitors" as active.
      end: true,
      iconBgClass: "bg-indigo-50",
      iconBorderClass: "border border-indigo-100",
      iconTextClass: "text-indigo-700",
      activeClass: "bg-indigo-50 text-indigo-700",
      inactiveClass: "text-gray-700 hover:bg-indigo-50",
    },
    {
      label: "Duyệt lịch hẹn",
      to: "/visitors/approval",
      visible: isAdmin || isDirector,
      badge: pendingApprovalCount > 0 ? pendingApprovalCount : null,
      icon: CalendarCheck,
      end: false,
      iconBgClass: "bg-teal-50",
      iconBorderClass: "border border-teal-100",
      iconTextClass: "text-teal-700",
      activeClass: "bg-teal-50 text-teal-700",
      inactiveClass: "text-gray-700 hover:bg-teal-50",
      badgeBgClass: "bg-teal-600",
    },
    {
      label: "Tài khoản & phân quyền",
      to: "/admin/users",
      visible: isAdmin,
      badge: null,
      icon: UserCog,
      end: false,
      iconBgClass: "bg-slate-50",
      iconBorderClass: "border border-slate-200",
      iconTextClass: "text-slate-700",
      activeClass: "bg-slate-100 text-slate-800",
      inactiveClass: "text-gray-700 hover:bg-slate-50",
    },
    {
      label: "Đăng ký khách",
      to: "/visitors/register",
      visible: isAdmin,
      badge: null,
      icon: UserPlus,
      end: false,
      iconBgClass: "bg-indigo-50",
      iconBorderClass: "border border-indigo-100",
      iconTextClass: "text-indigo-700",
      activeClass: "bg-indigo-50 text-indigo-700",
      inactiveClass: "text-gray-700 hover:bg-indigo-50",
    },
    {
      label: "Check-in/check-out lễ tân",
      to: "/reception-checkin",
      visible: canSeeReceptionCheckin,
      badge: null,
      icon: ClipboardCheck,
      end: false,
      iconBgClass: "bg-green-50",
      iconBorderClass: "border border-green-100",
      iconTextClass: "text-green-700",
      activeClass: "bg-green-50 text-green-700",
      inactiveClass: "text-gray-700 hover:bg-green-50",
    },
    {
      // Duplicate of the "Đăng ký xe mới" button inside the Dashboard quick actions.
      // Keep it for Admin/Security because other pages may still need access.
      label: "Check-in / Check-out bãi xe",
      to: "/checkin",
      visible: canSeeParkingOps,
      badge: null,
      icon: Car,
      end: false,
      iconBgClass: "bg-amber-50",
      iconBorderClass: "border border-amber-100",
      iconTextClass: "text-amber-700",
      activeClass: "bg-amber-50 text-amber-700",
      inactiveClass: "text-gray-700 hover:bg-amber-50",
    },
    {
      label: "Danh sách đen",
      to: "/blacklist",
      icon: Ban,
      // Reception/Admin guest list; Security/Admin vehicle list. Director: no access (see BlacklistPage).
      visible: !isDirector,
      badge: null,
      end: false,
      iconBgClass: "bg-rose-50",
      iconBorderClass: "border border-rose-100",
      iconTextClass: "text-rose-700",
      activeClass: "bg-rose-50 text-rose-700",
      inactiveClass: "text-gray-700 hover:bg-rose-50",
    },
  ];

  return (
    <ToastProvider>
      <ConfirmDialogProvider>
        <DirectorRouteGuard>
        {shouldUseProjectALayout ? (
          <div className="flex h-screen bg-gray-50 overflow-hidden">
            <aside
              className={`${
                sidebarOpen ? "w-64" : "w-20"
              } bg-white border-r border-gray-200 transition-all duration-300 flex flex-col overflow-hidden`}
            >
              <div className="h-16 flex items-center justify-between px-6 border-b border-gray-200">
                {sidebarOpen && <h1 className="font-bold text-xl text-gray-800">Quản lý công ty</h1>}
                <button
                  type="button"
                  className="ml-auto p-2 rounded-md hover:bg-gray-100"
                  onClick={() => setSidebarOpen(!sidebarOpen)}
                  aria-label="Toggle sidebar"
                >
                  <AlignJustify className="h-5 w-5 text-gray-600" aria-hidden="true" />
                </button>
              </div>

              <nav className="flex-1 min-h-0 px-3 py-4 space-y-1 overflow-y-auto">
                {navItems
                  .filter((i) => i.visible)
                  .map((item) => (
                    <NavLink
                      key={item.to}
                      to={item.to}
                      end={item.end}
                      className={({ isActive }) =>
                        `w-full flex items-center rounded-lg transition-colors ${
                          sidebarOpen ? "px-3 py-3 justify-start" : "px-2 py-3 justify-center"
                        } ${isActive ? item.activeClass : item.inactiveClass}`
                      }
                    >
                      {item.icon && (
                        <span
                          className={`w-9 h-9 rounded-lg flex items-center justify-center ${item.iconBgClass ?? "bg-blue-50"} ${item.iconBorderClass ?? "border border-blue-100"} ${item.iconTextClass ?? "text-blue-700"}`}
                        >
                          <item.icon className="h-5 w-5 flex-shrink-0" aria-hidden="true" />
                        </span>
                      )}
                      {sidebarOpen && (
                        <span className="ml-3 flex items-center gap-2 min-w-0">
                          <span className="truncate whitespace-nowrap">{item.label}</span>
                          {typeof item.badge === "number" && item.badge > 0 && (
                            <span
                              className={`inline-flex items-center justify-center min-w-[20px] h-[18px] px-1 rounded-full ${item.badgeBgClass ?? "bg-blue-600"} text-white text-xs`}
                            >
                              {item.badge}
                            </span>
                          )}
                        </span>
                      )}
                    </NavLink>
                  ))}
              </nav>

              <div className="p-4 border-t border-gray-200 space-y-3">
                <div className="flex items-center">
                  <div className="w-10 h-10 rounded-full bg-blue-500 flex items-center justify-center text-white font-semibold">
                    {(fullName || "U").charAt(0).toUpperCase()}
                  </div>
                  {sidebarOpen && (
                    <div className="ml-3 flex-1">
                      <p className="text-sm font-medium text-gray-900">{fullName || "Người dùng"}</p>
                      <p className="text-xs text-gray-500">{roleDisplay || ""}</p>
                    </div>
                  )}
                </div>

                {sidebarOpen && (
                  <button
                    type="button"
                    className="w-full py-2 px-3 rounded-xl flex items-center justify-center text-white bg-gradient-to-b from-blue-500 to-blue-700 border border-blue-700 shadow-lg hover:shadow-xl hover:from-blue-600 hover:to-blue-800 transition-all"
                    onClick={handleLogout}
                  >
                    Đăng xuất
                  </button>
                )}
              </div>
            </aside>

            <main className="app-content app-content-project-a flex-1 overflow-y-auto">
              <div className="app-page">{appRoutes}</div>
            </main>
          </div>
        ) : (
          isLoginPage ? (
            <div className="min-h-screen">{appRoutes}</div>
          ) : (
            <div className="app-layout app-layout-login">
              <main className="app-content app-content-full">{appRoutes}</main>
            </div>
          )
        )}
        </DirectorRouteGuard>
      </ConfirmDialogProvider>
    </ToastProvider>
  );
};

export default App;

