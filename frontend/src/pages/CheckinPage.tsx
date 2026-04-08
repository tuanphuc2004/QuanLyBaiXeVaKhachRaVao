import React, { useEffect, useRef, useState } from "react";
import { Camera, Car, History, LogOut } from "lucide-react";
import { visitApi, Visit } from "../api/visitApi";
import { isBlacklistedVehicle } from "../blacklistStore";
import { plateRecognitionApi, type PlateRecognitionCandidate } from "../api/plateRecognitionApi";
import { useConfirm } from "../components/ConfirmDialogProvider";
import { useToast } from "../components/ToastProvider";

interface CheckinForm {
  qrOrIdNumber: string;
  vehiclePlate: string;
  vehicleType: string;
  badgeNumber: string;
}

const CheckinPage: React.FC = () => {
  const [form, setForm] = useState<CheckinForm>({
    qrOrIdNumber: "",
    vehiclePlate: "",
    vehicleType: "Xe máy",
    badgeNumber: ""
  });
  const [visits, setVisits] = useState<Visit[]>([]);
  const [loadingList, setLoadingList] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [checkoutLoadingId, setCheckoutLoadingId] = useState<number | null>(null);
  const [checkoutError, setCheckoutError] = useState<string | null>(null);
  const [pendingCandidate, setPendingCandidate] = useState<PlateRecognitionCandidate | null>(null);
  const [pendingLoading, setPendingLoading] = useState(false);
  const [pendingError, setPendingError] = useState<string | null>(null);
  const [autoScanError, setAutoScanError] = useState<string | null>(null);
  const [confirmCandidateOpen, setConfirmCandidateOpen] = useState(false);
  const [confirmVehicleType, setConfirmVehicleType] = useState<string>("Xe máy");

  const videoRef = useRef<HTMLVideoElement | null>(null);
  const cameraStreamRef = useRef<MediaStream | null>(null);
  const canvasRef = useRef<HTMLCanvasElement | null>(null);

  const [cameraEnabled, setCameraEnabled] = useState(false);
  const [cameraError, setCameraError] = useState<string | null>(null);
  const [capturedImageFile, setCapturedImageFile] = useState<File | null>(null);
  const [capturedImageUrl, setCapturedImageUrl] = useState<string | null>(null);

  const scanInFlightRef = useRef(false);
  const scanCooldownUntilRef = useRef<number>(0);

  const [cameraPlateNumber, setCameraPlateNumber] = useState<string>("");
  const [cameraVehicleType, setCameraVehicleType] = useState<string>("");

  const [checkoutPreviewVisit, setCheckoutPreviewVisit] = useState<Visit | null>(null);

  const role = localStorage.getItem("current_role");
  const confirm = useConfirm();
  const pushToast = useToast();
  const isAdmin = role === "Admin";
  const isSecurity = role === "Security";

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

  const canUseRecognition = isAdmin || isSecurity;

  const loadPendingCandidate = async () => {
    if (!canUseRecognition) return;
    try {
      const response = await plateRecognitionApi.getPending(5);
      setPendingCandidate(response.data?.[0] ?? null);
    } catch {
      // Ignore transient network errors for polling.
    }
  };

  useEffect(() => {
    if (!canUseRecognition) return;
    loadPendingCandidate();
    const intervalId = window.setInterval(() => {
      loadPendingCandidate();
    }, 3000);
    return () => window.clearInterval(intervalId);
  }, [canUseRecognition]);

  useEffect(() => {
    return () => {
      stopCamera();
      if (capturedImageUrl) URL.revokeObjectURL(capturedImageUrl);
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  useEffect(() => {
    if (!pendingCandidate) return;
    // Auto-fill recognized plate + type, keep guard-entered QR/Badge values.
    setForm((prev) => ({
      ...prev,
      vehiclePlate: pendingCandidate.plateNumber,
      vehicleType: pendingCandidate.vehicleType,
    }));
    setConfirmVehicleType(pendingCandidate.vehicleType || "Xe máy");
  }, [pendingCandidate?.candidateId]);

  // Auto-enable camera and auto-scan for plate recognition.
  useEffect(() => {
    if (!canUseRecognition) {
      stopCamera();
      return;
    }
    // Start camera once when we enter the page with the right role.
    if (!cameraEnabled) {
      startCamera();
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [canUseRecognition]);

  useEffect(() => {
    if (!canUseRecognition) return;
    if (!cameraEnabled) return;

    const intervalId = window.setInterval(async () => {
      if (scanInFlightRef.current) return;
      if (pendingCandidate) return; // Keep one active pending candidate to avoid duplicates.
      if (Date.now() < scanCooldownUntilRef.current) return;

      setAutoScanError(null);
      scanInFlightRef.current = true;
      try {
        const file = await captureFrameToFile();
        if (!file) return;

        await plateRecognitionApi.ocrWithImage({ imageFile: file });
        // Cooldown to avoid spamming backend for the same vehicle.
        scanCooldownUntilRef.current = Date.now() + 8000;
      } catch (err: any) {
        if (err?.response?.status === 401 || err?.response?.status === 403) {
          setCameraError("Phiên đăng nhập của bạn đã hết. Hãy đăng nhập lại.");
          scanCooldownUntilRef.current = Date.now() + 30000;
        } else if (err?.response?.status === 422) {
          // No plate recognized in this frame; silently ignore.
        } else {
          setAutoScanError("Không thể quét biển số tự động. Vui lòng kiểm tra lại camera hoặc mạng.");
        }
      } finally {
        scanInFlightRef.current = false;
      }
    }, 2000);

    return () => window.clearInterval(intervalId);
  }, [canUseRecognition, cameraEnabled, pendingCandidate]);

  const handleConfirmCandidate = async (vehicleTypeOverride?: string) => {
    if (!pendingCandidate) return;
    setPendingError(null);
    setPendingLoading(true);
    try {
      const plate = (form.vehiclePlate || pendingCandidate.plateNumber || "").trim();
      const qrOrId = (form.qrOrIdNumber || "").trim() || plate;
      const vehicleType = (vehicleTypeOverride || form.vehicleType || pendingCandidate.vehicleType || "Xe máy").trim();

      const response = await plateRecognitionApi.confirm(pendingCandidate.candidateId, {
        qrOrIdNumber: qrOrId,
        vehiclePlate: plate,
        vehicleType,
        badgeNumber: form.badgeNumber,
      });

      const created = response.data as Visit;
      setVisits((prev) => [created, ...prev]);

      setForm({
        qrOrIdNumber: "",
        vehiclePlate: "",
        vehicleType: "Xe máy",
        badgeNumber: "",
      });
      setPendingCandidate(null);
      await loadPendingCandidate();
      pushToast({ type: "success", title: "Xác nhận thành công", message: "Đã ghi nhận phương tiện vào bãi." });
    } catch (err: any) {
      if (err?.response?.status === 401 || err?.response?.status === 403) {
        setPendingError("Bạn không có quyền xác nhận. Hãy đăng nhập tài khoản Security/Admin.");
        pushToast({ type: "error", title: "Không thể xác nhận", message: "Bạn không đủ quyền." });
      } else {
        setPendingError("Không thể xác nhận biển số. Vui lòng thử lại.");
        pushToast({ type: "error", title: "Không thể xác nhận", message: "Vui lòng thử lại sau." });
      }
    } finally {
      setPendingLoading(false);
    }
  };

  const handleRejectCandidate = async () => {
    if (!pendingCandidate) return;
    const ok = await confirm({
      title: "Từ chối nhận dạng",
      message: `Bạn có chắc muốn từ chối biển số: ${pendingCandidate.plateNumber}?`,
      confirmLabel: "Không xác nhận",
      cancelLabel: "Hủy",
      tone: "danger",
    });
    if (!ok) return;

    setPendingError(null);
    setPendingLoading(true);
    try {
      await plateRecognitionApi.reject(pendingCandidate.candidateId);
      setPendingCandidate(null);
      await loadPendingCandidate();
      pushToast({ type: "info", title: "Đã cập nhật", message: "Đã từ chối nhận dạng." });
    } catch {
      setPendingError("Không thể từ chối nhận dạng. Vui lòng thử lại.");
      pushToast({ type: "error", title: "Không thể từ chối", message: "Vui lòng thử lại sau." });
    } finally {
      setPendingLoading(false);
    }
  };

  const handleChange = (e: React.ChangeEvent<HTMLInputElement | HTMLSelectElement>) => {
    const { name, value } = e.target;
    setForm((prev) => ({ ...prev, [name]: value }));
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);
    const plate = (form.vehiclePlate || "").trim();
    if (plate && isBlacklistedVehicle(plate)) {
      setError(
        "Biển số này đang trong danh sách đen. Để cho phép xe vào bãi, vui lòng vào mục Danh sách đen (Danh sách đen xe) để xóa trước."
      );
      return;
    }

    const ok = await confirm({
      title: "Xác nhận check-in",
      message: `Ghi nhận phương tiện: ${form.vehiclePlate || "(chưa có)"} | Loại xe: ${form.vehicleType}?`,
      confirmLabel: "Lưu",
      cancelLabel: "Hủy",
      tone: "default",
    });
    if (!ok) return;

    setSubmitting(true);
    try {
      const response = await visitApi.checkin(form);
      const created = response.data;
      setVisits((prev) => [created, ...prev]);
      setForm({
        qrOrIdNumber: "",
        vehiclePlate: "",
        vehicleType: "Xe máy",
        badgeNumber: ""
      });
      pushToast({ type: "success", title: "Đã lưu", message: "Ghi nhận check-in thành công." });
    } catch (err: any) {
      if (err?.response?.status === 404) {
        setError("Không tìm thấy thông tin phù hợp để check-in.");
        pushToast({ type: "error", title: "Không thể check-in", message: "Không tìm thấy dữ liệu phù hợp." });
      } else if (err?.response?.status === 401 || err?.response?.status === 403) {
        setError("Bạn không có quyền thực hiện chức năng này. Hãy đăng nhập với tài khoản Security/Admin.");
        pushToast({ type: "error", title: "Không đủ quyền", message: "Vui lòng đăng nhập đúng tài khoản." });
      } else {
        setError("Không thể kết nối tới server. Vui lòng thử lại.");
        pushToast({ type: "error", title: "Lỗi kết nối", message: "Vui lòng thử lại sau." });
      }
    } finally {
      setSubmitting(false);
    }
  };

  const handleCheckout = async (visit: Visit) => {
    if (visit.checkOutTime) {
      return;
    }
    const token = visit.badgeNumber || visit.qrOrIdNumber;
    if (!token) {
      return;
    }
    setCheckoutError(null);
    setCheckoutLoadingId(visit.visitId);
    try {
      const response = await visitApi.checkout({ qrOrBadge: token });
      const updated = response.data;
      setVisits((prev) => prev.map((v) => (v.visitId === updated.visitId ? updated : v)));
    } catch (err: any) {
      if (err?.response?.status === 404) {
        setCheckoutError("Không tìm thấy lượt visit đang hoạt động cho mã này.");
      } else if (err?.response?.status === 401 || err?.response?.status === 403) {
        setCheckoutError("Bạn không có quyền check-out. Hãy đăng nhập lại với tài khoản phù hợp.");
      } else {
        setCheckoutError("Không thể thực hiện check-out. Vui lòng thử lại.");
      }
    } finally {
      setCheckoutLoadingId(null);
    }
  };

  const confirmCheckoutPreview = async () => {
    if (!checkoutPreviewVisit) return;
    const ok = await confirm({
      title: "Xác nhận check-out",
      message: `Xác nhận ra cổng cho biển số: ${checkoutPreviewVisit.vehiclePlate} ?`,
      confirmLabel: "Ra cổng",
      cancelLabel: "Hủy",
      tone: "danger",
    });
    if (!ok) return;
    const v = checkoutPreviewVisit;
    await handleCheckout(v);
    setCheckoutPreviewVisit(null);
  };

  const stopCamera = () => {
    try {
      if (cameraStreamRef.current) {
        cameraStreamRef.current.getTracks().forEach((t) => t.stop());
      }
    } catch {
      // ignore
    }
    cameraStreamRef.current = null;
    if (videoRef.current) {
      videoRef.current.srcObject = null;
    }
    setCameraEnabled(false);
  };

  const startCamera = async () => {
    setCameraError(null);
    try {
      if (!navigator.mediaDevices?.getUserMedia) {
        setCameraError("Trình duyệt không hỗ trợ camera.");
        return;
      }
      stopCamera();
      const stream = await navigator.mediaDevices.getUserMedia({
        video: { facingMode: "environment" },
        audio: false,
      });
      cameraStreamRef.current = stream;
      if (videoRef.current) {
        videoRef.current.srcObject = stream;
        await videoRef.current.play();
      }
      setCameraEnabled(true);
    } catch (e) {
      setCameraError("Không thể bật camera. Vui lòng kiểm tra quyền truy cập camera.");
      setCameraEnabled(false);
    }
  };

  const captureFrameToFile = async (): Promise<File | null> => {
    if (!videoRef.current) return null;

    const video = videoRef.current;
    const width = video.videoWidth || 1280;
    const height = video.videoHeight || 720;

    if (!canvasRef.current) {
      canvasRef.current = document.createElement("canvas");
    }
    const canvas = canvasRef.current;
    canvas.width = width;
    canvas.height = height;
    const ctx = canvas.getContext("2d");
    if (!ctx) return null;

    ctx.drawImage(video, 0, 0, width, height);

    const blob: Blob | null = await new Promise((resolve) => {
      canvas.toBlob((b) => resolve(b), "image/jpeg", 0.95);
    });
    if (!blob) return null;

    return new File([blob], `plate-${Date.now()}.jpg`, { type: "image/jpeg" });
  };

  const handleCaptureFromCamera = async () => {
    setCameraError(null);
    const file = await captureFrameToFile();
    if (!file) {
      setCameraError("Không chụp được ảnh từ camera.");
      return;
    }

    if (capturedImageUrl) URL.revokeObjectURL(capturedImageUrl);
    setCapturedImageFile(file);
    setCapturedImageUrl(URL.createObjectURL(file));
  };

  const submitRecognitionFromCamera = async () => {
    if (!capturedImageFile) {
      setPendingError("Chưa có ảnh chụp từ camera.");
      return;
    }
    const plate = (cameraPlateNumber || "").trim();
    if (!plate) {
      setPendingError("Chưa có biển số. Hãy nhập biển số (hoặc nối OCR thực tế sau).");
      return;
    }

    try {
      setPendingLoading(true);
      await plateRecognitionApi.submitWithImage({
        imageFile: capturedImageFile,
        plateNumber: plate,
        vehicleType: cameraVehicleType,
      });

      setPendingError(null);
      setPendingLoading(false);
      // Pending candidate sẽ tự hiện về trong polling.
      // Clear preview để không nhầm lần sau.
      if (capturedImageUrl) URL.revokeObjectURL(capturedImageUrl);
      setCapturedImageFile(null);
      setCapturedImageUrl(null);
      setCameraPlateNumber("");
    } catch {
      setPendingError("Không thể gửi nhận dạng từ camera. Vui lòng thử lại.");
      setPendingLoading(false);
    }
  };

  const formatDateTime = (value?: string | null) => {
    if (!value) return "-";
    return new Date(value).toLocaleString("vi-VN");
  };

  // Only show visits that have license plate (vehicle parking history), exclude guest-only check-ins
  const vehicleParkingVisits = visits.filter(
    (v) => v.vehiclePlate != null && String(v.vehiclePlate).trim() !== ""
  );
  const activeVehicles = visits.filter((v) => !v.checkOutTime && v.vehiclePlate && v.vehiclePlate.trim() !== "");

  return (
    <div>
      <h2 className="page-title flex items-center gap-3">
        <Car className="h-6 w-6 text-amber-600" aria-hidden="true" />
        <span>Ghi nhận phương tiện tại bãi xe</span>
      </h2>

      {(isAdmin || isSecurity) && (
        <div className="grid-3" style={{ marginBottom: "1rem" }}>
          <div className="stat-card">
            <div className="stat-label">Xe đang trong bãi</div>
            <div className="stat-value">{activeVehicles.length}</div>
            <div className="stat-helper">Lượt có biển số xe và chưa check-out</div>
          </div>
          <div className="stat-card">
            <div className="stat-label">Ghi chú</div>
            <div className="stat-helper">
              {isAdmin && "Admin: xem và quản lý số xe trong bãi."}
              {isSecurity && "Bảo vệ: chỉ xem số xe trong bãi, không biết tổng số khách."}
            </div>
          </div>
        </div>
      )}

      <div className="card">
        <div className="card-header">
          <div>
            <div className="card-title flex items-center gap-3">
              <Camera className="h-5 w-5 text-slate-700" aria-hidden="true" />
              <span>Thông tin phương tiện</span>
            </div>
            <div className="card-subtitle">Ghi nhận biển số xe và loại xe khi xe vào bãi</div>
          </div>
        </div>

        {(isAdmin || isSecurity) && (
          <div style={{ marginBottom: "1rem" }}>
            <div className="card-subtitle" style={{ marginBottom: "0.5rem" }}>
              Camera nhận dạng biển số (MVP)
            </div>

            <div
              style={{
                border: "1px solid rgba(255,255,255,0.15)",
                borderRadius: "8px",
                padding: "0.75rem",
                marginBottom: "0.75rem",
              }}
            >
              <div
                style={{
                  display: "grid",
                  gridTemplateColumns: "minmax(360px, 1.3fr) minmax(320px, 0.9fr)",
                  gap: "1rem",
                  alignItems: "start",
                }}
              >
                <div>
                  <video
                    ref={videoRef}
                    style={{ width: "100%", maxWidth: "520px", borderRadius: "8px", background: "#000" }}
                    playsInline
                    muted
                    autoPlay
                  />

                  <div className="form-actions" style={{ display: "flex", gap: "0.75rem", marginTop: "0.75rem" }}>
                    <button
                      type="button"
                      className="btn"
                      onClick={stopCamera}
                      disabled={!cameraEnabled}
                    >
                      Tắt camera
                    </button>
                  </div>
                </div>

                <div>
                  <div className="stat-helper">
                    Camera đang mở và tự động quét biển số.
                    Chờ ứng viên nhận dạng xuất hiện để bảo vệ xác nhận/từ chối.
                  </div>

                  {autoScanError && (
                    <div className="login-error" style={{ marginTop: "0.75rem" }}>
                      {autoScanError}
                    </div>
                  )}

                  {canUseRecognition && pendingCandidate && (
                    <div style={{ marginTop: "0.75rem" }}>
                      <div className="card-subtitle" style={{ marginBottom: "0.5rem" }}>
                        Nhận dạng biển số đang chờ xác nhận
                      </div>

                      {isBlacklistedVehicle(pendingCandidate.plateNumber) && (
                        <div className="login-error" style={{ marginBottom: "0.75rem" }}>
                          Biển số {pendingCandidate.plateNumber} nằm trong danh sách đen. Vui lòng cân nhắc xác nhận/không xác nhận.
                        </div>
                      )}

                      <div className="stat-card" style={{ marginBottom: "0.75rem" }}>
                        <div className="stat-label">Biển số</div>
                        <div className="stat-value">{pendingCandidate.plateNumber}</div>
                      </div>

                      {pendingCandidate.plateImageRelativePath && (
                        <img
                          src={`/media/${pendingCandidate.plateImageRelativePath}`}
                          alt="pending-plate"
                          style={{ width: "100%", maxHeight: "240px", objectFit: "cover", borderRadius: "8px", marginBottom: "0.75rem" }}
                        />
                      )}

                      <div className="form-actions" style={{ display: "flex", gap: "0.75rem" }}>
                        <button
                          type="button"
                          className="btn btn-primary"
                          disabled={pendingLoading}
                          onClick={() => setConfirmCandidateOpen(true)}
                        >
                          {pendingLoading ? "Đang xử lý..." : "Xác nhận"}
                        </button>
                        <button
                          type="button"
                          className="btn"
                          disabled={pendingLoading}
                          onClick={handleRejectCandidate}
                        >
                          Không xác nhận
                        </button>
                      </div>

                      {pendingError && <div className="login-error" style={{ marginTop: "0.75rem" }}>{pendingError}</div>}
                    </div>
                  )}
                </div>
              </div>
            </div>
          </div>
        )}

      {confirmCandidateOpen && pendingCandidate && (
        <div
          className="dialog-overlay"
          role="dialog"
          aria-modal="true"
          onClick={() => setConfirmCandidateOpen(false)}
        >
          <div className="dialog" onClick={(e) => e.stopPropagation()}>
            <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", gap: "1rem" }}>
              <div>
                <div className="dialog-title">Chọn loại xe</div>
                <div className="dialog-message" style={{ marginTop: "0.25rem" }}>
                  Biển số: {pendingCandidate.plateNumber}
                </div>
              </div>
              <button type="button" className="btn" aria-label="Đóng" onClick={() => setConfirmCandidateOpen(false)}>
                ×
              </button>
            </div>

            <div style={{ marginTop: "0.75rem" }} className="form-field">
              <label className="form-label" htmlFor="confirm-vehicle-type">
                Loại xe
              </label>
              <select
                id="confirm-vehicle-type"
                className="form-select"
                value={confirmVehicleType}
                onChange={(e) => setConfirmVehicleType(e.target.value)}
              >
                <option value="Xe máy">Xe máy</option>
                <option value="Ô tô">Ô tô</option>
                <option value="Xe tải">Xe tải</option>
              </select>
              <div className="card-subtitle" style={{ marginTop: "0.35rem" }}>
                Hệ thống tự nhận dạng có thể sai, vui lòng chọn đúng trước khi ghi nhận.
              </div>
            </div>

            <div className="form-actions" style={{ marginTop: "1rem", display: "flex", gap: "0.75rem" }}>
              <button
                type="button"
                className="btn btn-primary"
                disabled={pendingLoading}
                onClick={async () => {
                  setConfirmCandidateOpen(false);
                  await handleConfirmCandidate(confirmVehicleType);
                }}
              >
                {pendingLoading ? "Đang xử lý..." : "Xác nhận check-in"}
              </button>
              <button type="button" className="btn" onClick={() => setConfirmCandidateOpen(false)} disabled={pendingLoading}>
                Hủy
              </button>
            </div>
          </div>
        </div>
      )}

        <form onSubmit={handleSubmit}>
          <div className="form-grid">
            <div className="form-field">
              <label className="form-label" htmlFor="vehiclePlate">
                Biển số xe
              </label>
              <input
                id="vehiclePlate"
                name="vehiclePlate"
                className="form-input"
                value={form.vehiclePlate}
                onChange={handleChange}
              />
            </div>

            <div className="form-field">
              <label className="form-label" htmlFor="vehicleType">
                Loại xe
              </label>
              <select
                id="vehicleType"
                name="vehicleType"
                className="form-select"
                value={form.vehicleType}
                onChange={handleChange}
              >
                <option value="Xe máy">Xe máy</option>
                <option value="Ô tô">Ô tô</option>
                <option value="Xe tải">Xe tải</option>
              </select>
            </div>

          </div>

          {error && <div className="login-error">{error}</div>}

          <div className="form-actions">
            <button type="submit" className="btn btn-primary" disabled={submitting}>
              {submitting ? "Đang ghi nhận..." : "Ghi nhận phương tiện vào bãi"}
            </button>
          </div>
        </form>
      </div>

      <div className="card">
        <div className="card-header">
          <div>
            <div className="card-title flex items-center gap-3">
              <History className="h-5 w-5 text-slate-700" aria-hidden="true" />
              <span>Lịch sử phương tiện trong bãi</span>
            </div>
            <div className="card-subtitle">
              Danh sách xe đã được ghi nhận. Xe đã check-out sẽ hiển thị trạng thái tương ứng.
            </div>
          </div>
        </div>

        {loadingList ? (
          <div>Đang tải dữ liệu...</div>
        ) : (
          <table className="table">
            <thead>
              <tr>
                <th>STT</th>
                <th>Biển số</th>
                <th>Loại xe</th>
                <th>Trạng thái</th>
              </tr>
            </thead>
            <tbody>
              {vehicleParkingVisits.length === 0 ? (
                <tr>
                  <td colSpan={4}>Chưa có lịch sử ra vào bãi xe.</td>
                </tr>
              ) : (
                vehicleParkingVisits.map((visit, index) => {
                  const hasLeft = !!visit.checkOutTime;
                  return (
                    <tr key={visit.visitId}>
                      <td>{index + 1}</td>
                      <td>{visit.vehiclePlate}</td>
                      <td>{visit.vehicleType}</td>
                      <td>
                        {hasLeft ? (
                          <span>Phương tiện đã ra khỏi công ty</span>
                        ) : (
                          <button
                            className="btn btn-primary"
                              onClick={() => setCheckoutPreviewVisit(visit)}
                            disabled={checkoutLoadingId === visit.visitId}
                          >
                            {checkoutLoadingId === visit.visitId ? "Đang check-out..." : "Ra cổng"}
                          </button>
                        )}
                      </td>
                    </tr>
                  );
                })
              )}
            </tbody>
          </table>
        )}
        {checkoutError && (
          <div className="login-error" style={{ marginTop: "0.75rem" }}>
            {checkoutError}
          </div>
        )}
      </div>

      {checkoutPreviewVisit && (
        <div
          style={{
            position: "fixed",
            inset: 0,
            background: "rgba(0,0,0,0.6)",
            zIndex: 9999,
            display: "flex",
            alignItems: "center",
            justifyContent: "center",
            padding: "1rem",
          }}
        >
          <div
            style={{
              width: "100%",
              maxWidth: "720px",
              background: "#1e1e1e",
              borderRadius: "10px",
              padding: "1rem",
              border: "1px solid rgba(255,255,255,0.15)",
            }}
          >
            <div style={{ display: "flex", justifyContent: "space-between", gap: "1rem" }}>
              <div>
                <div className="card-title flex items-center gap-3">
                  <LogOut className="h-5 w-5 text-red-700" aria-hidden="true" />
                  <span>Xác nhận check-out</span>
                </div>
                <div className="card-subtitle">
                  Biển số: {checkoutPreviewVisit.vehiclePlate} | Loại xe: {checkoutPreviewVisit.vehicleType}
                </div>
              </div>
              <button className="btn" type="button" onClick={() => setCheckoutPreviewVisit(null)}>
                Đóng
              </button>
            </div>

            <div style={{ marginTop: "1rem", display: "grid", gridTemplateColumns: "1fr", gap: "0.75rem" }}>
              {checkoutPreviewVisit.vehiclePlateImageRelativePath ? (
                <img
                  src={`/media/${checkoutPreviewVisit.vehiclePlateImageRelativePath}`}
                  alt="vehicle-plate"
                  style={{ width: "100%", maxHeight: "420px", objectFit: "contain", borderRadius: "8px", background: "#000" }}
                />
              ) : (
                <div className="stat-helper">Không có ảnh phương tiện cho lượt này.</div>
              )}
            </div>

            <div className="form-actions" style={{ display: "flex", gap: "0.75rem", marginTop: "1rem" }}>
              <button
                type="button"
                className="btn btn-primary"
                disabled={checkoutLoadingId === checkoutPreviewVisit.visitId}
                onClick={confirmCheckoutPreview}
              >
                {checkoutLoadingId === checkoutPreviewVisit.visitId ? "Đang check-out..." : "Xác nhận check-out"}
              </button>
              <button className="btn" type="button" onClick={() => setCheckoutPreviewVisit(null)}>
                Hủy
              </button>
            </div>
            {checkoutError && (
              <div className="login-error" style={{ marginTop: "0.75rem" }}>
                {checkoutError}
              </div>
            )}
          </div>
        </div>
      )}
    </div>
  );
};

export default CheckinPage;

