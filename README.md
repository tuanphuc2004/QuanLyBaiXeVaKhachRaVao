1. Phân tích yêu cầu hệ thống
1.1. Yêu cầu chức năng (Functional)
Quản lý khách (Visitor)
Đăng ký khách, pre-registration, quản lý lịch hẹn.
Check-in, check-out, sinh QR code cho lượt visit.
Quản lý tài sản mang theo.
Quản lý phương tiện (Vehicle)
Ghi nhận biển số, loại xe (Xe máy, Ô tô, Xe tải).
Theo dõi xe giao hàng, vị trí dock, thời gian ở trong công ty.
Kiểm soát ra/vào
Check-in & phát thẻ khách, mô phỏng in thẻ, kiosk tự check-in.
Xác nhận từ chủ nhà (Host approval).
Check-out, cảnh báo khách ở quá 8 giờ, check-out bằng QR.
Danh sách đen (Blacklist)
Quản lý danh sách CCCD/biển số bị chặn, cảnh báo khi check-in.
Báo cáo & dashboard
Danh sách khách đang trong công ty.
Thống kê theo ngày.
Dashboard realtime (SignalR).
Bảo mật & phân quyền
Đăng nhập bằng JWT.
Role-based: Admin, Security, Employee.
Logging hệ thống, soft delete, pagination + search.
1.2. Yêu cầu phi chức năng (Non-functional)
Sử dụng kiến trúc Clean Architecture: Controller – Service – Repository – DbContext.
Đảm bảo hiệu năng qua phân trang, search, chỉ truy vấn các cột cần thiết.
Bảo mật: JWT, role-based authorization, ẩn/xóa CCCD sau 30 ngày.
Khả năng mở rộng: dễ thêm module mới (ví dụ tích hợp camera OCR thật, barrier).
Triển khai được trên IIS hoặc Docker.
2. Actor và Use Case
2.1. Actor
Visitor: khách đến công ty.
Security: nhân viên bảo vệ, thao tác check-in/out, phát thẻ, theo dõi dock.
Employee (Host): nhân viên nội bộ, người được khách đến gặp.
Admin: quản trị hệ thống, phân quyền, xem báo cáo, cấu hình.
System: tiến trình nền xử lý auto ẩn CCCD, cảnh báo quá 8 giờ.
2.2. Use Case chính
UC01: Pre-registration khách (Employee, Admin).
UC02: Check-in khách tại cổng (Security).
UC03: Host approval (Employee).
UC04: Check-out khách (Security, Visitor tại kiosk).
UC05: Quản lý blacklist (Admin).
UC06: Quản lý tài sản mang theo (Security).
UC07: Theo dõi xe giao hàng & dock (Security).
UC08: Dashboard realtime & báo cáo (Admin, Security).
UC09: Quản lý user & phân quyền (Admin).
UC10: Tự động ẩn CCCD sau 30 ngày (System).
3. Mô tả Use Case tiêu biểu
UC02 – Check-in khách
Mục tiêu: ghi nhận khách đến cổng, kiểm tra blacklist, gửi yêu cầu duyệt cho Host, phát thẻ.
Actor: Security, Visitor.
Luồng chính:
Khách đến cổng, cung cấp CCCD/QR pre-registration.
Security mở màn hình Check-in, quét QR hoặc nhập CCCD.
Hệ thống tìm thông tin pre-registration, nếu chưa có thì cho phép nhập nhanh thông tin visitor.
Hệ thống kiểm tra CCCD và biển số xe trong bảng Blacklists.
Nếu có trong blacklist, hiển thị cảnh báo trên UI, ghi log, Security xử lý theo quy định.
Nếu hợp lệ, hệ thống tạo bản ghi Visit với Status = PendingApproval, sinh QR cho visit, gán thẻ khách.
Gửi notification (SignalR) tới Host liên quan.
UC03 – Host approval
Mục tiêu: nhân viên quyết định cho phép khách vào hay không.
Actor: Employee (Host).
Luồng chính:
Nhân viên nhận thông báo realtime trên màn hình Visitor chờ duyệt.
Nhân viên xem thông tin khách, mục đích, phòng ban, thông tin pre-registration.
Nhân viên bấm Đồng ý hoặc Từ chối.
Hệ thống cập nhật Visit.Status = Approved/Rejected, ghi log.
Gửi cập nhật realtime cho Security để xử lý tiếp.
UC04 – Check-out khách
Mục tiêu: ghi nhận khách rời công ty, thu hồi thẻ, kiểm tra tài sản và thời gian lưu trú.
Luồng chính:
Security/Visitor quét QR visit hoặc thẻ khách trên màn hình Check-out.
Hệ thống tìm Visit đang mở (Approved hoặc InProgress).
Hiển thị danh sách tài sản mang theo; Security xác nhận đã đúng/đủ.
Hệ thống ghi CheckOutTime, tính thời lượng.
Nếu thời lượng > 8 giờ, đánh cờ OverstayFlag = true, hiển thị cảnh báo, ghi log.
Thẻ khách được trả về trạng thái trống, visit chuyển CheckedOut.
4. Thiết kế database (tóm tắt ERD)
Users (UserId, Username, PasswordHash, FullName, Role, DepartmentId, IsDeleted, CreatedAt…).
Departments (DepartmentId, Name, Description).
Visitors (VisitorId, FullName, IdNumber, Phone, CompanyName, soft delete).
Vehicles (VehicleId, PlateNumber, VehicleType, soft delete).
Blacklists (BlacklistId, IdNumber, PlateNumber, Reason, StartDate, EndDate, IsActive, soft delete).
PreRegistrations (PreRegistrationId, VisitorId, HostUserId, DepartmentId, VisitDate, Purpose, QrCode, Status, soft delete).
Visits (VisitId, VisitorId, HostUserId, DepartmentId, VehicleId, PreRegistrationId, CheckInTime, CheckOutTime, Status, BadgeNumber, VisitQrCode, OverstayFlag, soft delete).
Assets (AssetId, VisitId, AssetType, SerialNumber, Description, AssetQrCode, soft delete).
DeliveryDocks (DockId, Name, Location, IsActive).
VehicleStays (VehicleStayId, VehicleId, DockId, VisitId, StartTime, EndTime, soft delete).
Logs (LogId, LogLevel, Message, Exception, CreatedAt, UserId).
Quan hệ quan trọng:

1 Visitor – N Visits.
1 User (host) – N Visits, N PreRegistrations.
1 Visit – N Assets.
1 Vehicle – N VehicleStays.
1 DeliveryDock – N VehicleStays.
5. SQL tạo bảng (tóm tắt)
Các bảng được thiết kế theo ERD trên, sử dụng:

Khóa chính INT IDENTITY.
Kiểu DATETIME2 cho thời gian.
Soft delete với các cột: IsDeleted BIT, DeletedAt DATETIME2.
Quan hệ FOREIGN KEY giữa các bảng: Visits tham chiếu Visitors, Users, Vehicles, PreRegistrations,…
(Chi tiết script SQL đầy đủ đã được mô tả trong phần thiết kế trước và có thể sinh từ EF Core Code First.)

6. Thiết kế API RESTful (mẫu)
Auth
POST /api/auth/login – nhận username, password, trả JWT + role.
Visitors
GET /api/visitors?pageNumber=&pageSize=&searchTerm= – phân trang + search.
POST /api/visitors – tạo mới visitor.
GET /api/visitors/{id} – xem chi tiết.
DELETE /api/visitors/{id} – soft delete.
Pre-registrations
POST /api/preregistrations – tạo lịch hẹn trước (sinh QR).
GET /api/preregistrations?hostId= – danh sách lịch hẹn theo host.
Visits
POST /api/visits/checkin – check-in, ghi phương tiện, tài sản, sinh QR.
POST /api/visits/{id}/approve – host đồng ý.
POST /api/visits/{id}/reject – host từ chối.
POST /api/visits/{id}/checkout – check-out.
GET /api/visits/current – danh sách khách đang ở trong.
Blacklist
GET /api/blacklists?pageNumber=&pageSize=&searchTerm=.
POST /api/blacklists.
DELETE /api/blacklists/{id} – soft delete.
Dashboard
GET /api/dashboard/summary – snapshot hiện tại.
SignalR Hub /hubs/dashboard – push realtime số khách, xe, pending approvals.
7. Code backend mẫu (ASP.NET Core)
Backend được tổ chức:

Entities: các lớp Visitor, Visit, Vehicle, Blacklist, Asset, DeliveryDock, VehicleStay, User, Department với trường soft delete.
DbContext: AppDbContext với DbSet<T> cho từng entity và HasQueryFilter cho soft delete.
Repository: IRepository<T> và Repository<T> triển khai generic repository, có GetPagedAsync hỗ trợ pagination + search.
Services:
VisitorService: search, tạo visitor, logging.
VisitService: logic check-in/out, overstay, gán badge, kiểm blacklist.
BlacklistService: quản lý blacklist.
AuthService: xác thực user, sinh JWT.
DashboardNotifier: bắn SignalR tới DashboardHub.
Controllers:
AuthController: POST /api/auth/login.
VisitorsController, VisitsController, BlacklistsController, DashboardController.
Áp dụng [Authorize] với Roles = "Admin,Security,Employee" tương ứng.
Logging dùng ILogger<T> hoặc Serilog, được tiêm qua DI vào service/controller.

8. Thiết kế giao diện React
Sử dụng React + Vite + TypeScript.
Cấu trúc:
src/api/ – axios client, các API modules (visitorApi, authApi, dashboardApi…).
src/contexts/AuthContext.tsx – lưu JWT, role, thông tin user.
src/components/Layout/MainLayout.tsx – header, sidebar, khu vực content.
src/pages/:
LoginPage – đăng nhập.
DashboardPage – hiển thị số khách, số xe, pending approvals, tích hợp SignalR.
VisitorListPage – danh sách visitor với pagination + search.
VisitorRegistrationPage – form pre-registration + sinh QR (token).
CheckinPage, CheckoutPage, BlacklistPage, VehiclePage, DeliveryDockPage, HostApprovalsPage, AssetsPage – UI cho các nghiệp vụ chính (kết nối API dần).
Sử dụng CSS thuần (flexbox, grid) để tạo layout hiện đại, không dùng icon.
Các route được bảo vệ bằng AuthContext: nếu chưa login sẽ bị chuyển về LoginPage.

9. Phần báo cáo (tóm tắt)
9.1. Giới thiệu
Đề tài giải quyết bài toán kiểm soát người và phương tiện ra vào công ty, thay thế quy trình ghi sổ tay thủ công bằng hệ thống Web hiện đại. Hệ thống hỗ trợ tiếp đón chuyên nghiệp, giảm thời gian chờ, tăng khả năng truy vết và đảm bảo an ninh, đặc biệt trong bối cảnh nhiều khách, đối tác, nhà cung cấp ra/vào mỗi ngày.

9.2. Mục tiêu
Tin học hóa quy trình đăng ký và check-in/check-out khách, phương tiện.
Tăng cường bảo mật thông qua phân quyền và quản lý blacklist.
Cung cấp công cụ giám sát realtime cho bộ phận an ninh.
Hỗ trợ báo cáo, thống kê phục vụ quản lý.
Tuân thủ yêu cầu bảo mật dữ liệu cá nhân (CCCD).
9.3. Kiến trúc hệ thống
Hệ thống áp dụng mô hình 3 lớp và Clean Architecture:

Frontend (React): giao diện người dùng, gọi REST API + SignalR, xử lý điều hướng, hiển thị form, bảng, dashboard.
Backend (ASP.NET Core Web API): hiện thực nghiệp vụ qua service, repository; xác thực JWT; SignalR Hub.
Database (SQL Server): lưu trữ dữ liệu theo ERD, sử dụng EF Core.
Luồng chính: người dùng thao tác trên React → gửi request đến API → service xử lý logic + repository truy cập DB → cập nhật dashboard realtime thông qua SignalR.

9.4. Kết luận
Hệ thống đạt được các yêu cầu đề ra: quản lý khách, phương tiện, tài sản, blacklist, check-in/out, host approval, dashboard realtime, cùng với các yêu cầu phi chức năng như bảo mật, logging, soft delete, phân trang và tìm kiếm. Kiến trúc được thiết kế mở, có thể mở rộng để tích hợp thêm các hệ thống khác như camera OCR thật, barrier tự động, hệ thống chấm công.

10. Triển khai (IIS / Docker)
IIS:
Publish ASP.NET Core Web API ở chế độ Release.
Cài .NET Hosting Bundle trên server.
Tạo site mới trong IIS, trỏ đến thư mục publish, cấu hình binding và CORS.
Docker:
Viết Dockerfile dựa trên image mcr.microsoft.com/dotnet/aspnet:8.0.
docker build -t visitor-api . rồi docker run -d -p 5000:8080 visitor-api.
Frontend React có thể build (npm run build) và deploy như static web trên IIS hoặc Nginx, trỏ API URL về backend.
