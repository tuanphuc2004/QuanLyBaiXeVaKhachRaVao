import React, { useEffect, useState } from "react";
import { Ban, Car, Users } from "lucide-react";
import { getBlacklistFromStorage, setBlacklistToStorage, type BlacklistItem } from "../blacklistStore";
import { useConfirm } from "../components/ConfirmDialogProvider";
import { useToast } from "../components/ToastProvider";

const BlacklistPage: React.FC = () => {
  const confirm = useConfirm();
  const pushToast = useToast();

  const [items, setItems] = useState<BlacklistItem[]>(() => getBlacklistFromStorage());
  const [searchGuest, setSearchGuest] = useState("");
  const [searchVehicle, setSearchVehicle] = useState("");
  const [newGuest, setNewGuest] = useState({ idNumber: "", reason: "" });
  const [newVehicle, setNewVehicle] = useState({ plateNumber: "", reason: "" });
  const [editingGuestId, setEditingGuestId] = useState<number | null>(null);
  const [editingVehicleId, setEditingVehicleId] = useState<number | null>(null);

  useEffect(() => {
    setBlacklistToStorage(items);
  }, [items]);

  const role = localStorage.getItem("current_role");
  const isAdmin = role === "Admin";
  const isSecurity = role === "Security";
  const isReception = role === "Employee";
  const canSeeGuestBlacklist = isAdmin || isReception;
  const canSeeVehicleBlacklist = isAdmin || isSecurity;

  const guestItems = items.filter((x) => x.idNumber && x.idNumber.trim() !== "");
  const vehicleItems = items.filter((x) => x.plateNumber && x.plateNumber.trim() !== "");

  const filteredGuests = guestItems.filter((x) => {
    const term = searchGuest.toLowerCase();
    return !term || (x.idNumber && x.idNumber.toLowerCase().includes(term));
  });

  const filteredVehicles = vehicleItems.filter((x) => {
    const term = searchVehicle.toLowerCase();
    return !term || (x.plateNumber && x.plateNumber.toLowerCase().includes(term));
  });

  const handleAddGuest = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!newGuest.idNumber.trim()) {
      pushToast({ type: "warning", title: "Thiếu CCCD", message: "Nhập CCCD để thêm vào danh sách đen khách." });
      return;
    }
    const ok = await confirm({
      title: "Xác nhận thêm vào danh sách đen",
      message: `Thêm CCCD: ${newGuest.idNumber.trim()}?`,
      confirmLabel: "Thêm",
      cancelLabel: "Hủy",
      tone: "default",
    });
    if (!ok) return;

    const nextId = items.length > 0 ? Math.max(...items.map((i) => i.id)) + 1 : 1;
    setItems((prev) => [...prev, { id: nextId, idNumber: newGuest.idNumber.trim(), reason: newGuest.reason }]);
    setNewGuest({ idNumber: "", reason: "" });
    pushToast({ type: "success", title: "Đã thêm", message: "Khách đã được thêm vào danh sách đen." });
  };

  const beginEditGuest = (item: BlacklistItem) => {
    setEditingGuestId(item.id);
    setNewGuest({ idNumber: item.idNumber ?? "", reason: item.reason ?? "" });
  };

  const cancelEditGuest = () => {
    setEditingGuestId(null);
    setNewGuest({ idNumber: "", reason: "" });
  };

  const handleSaveGuest = async (e: React.FormEvent) => {
    e.preventDefault();
    if (editingGuestId === null) return;
    if (!newGuest.idNumber.trim()) {
      pushToast({ type: "warning", title: "CCCD trống", message: "CCCD không được để trống." });
      return;
    }
    const ok = await confirm({
      title: "Xác nhận lưu thay đổi",
      message: `Lưu chỉnh sửa CCCD: ${newGuest.idNumber.trim()}?`,
      confirmLabel: "Lưu",
      cancelLabel: "Hủy",
      tone: "default",
    });
    if (!ok) return;

    setItems((prev) =>
      prev.map((x) =>
        x.id === editingGuestId
          ? { ...x, idNumber: newGuest.idNumber.trim(), plateNumber: undefined, reason: newGuest.reason }
          : x
      )
    );
    cancelEditGuest();
    pushToast({ type: "success", title: "Đã lưu", message: "Thông tin danh sách đen khách đã được cập nhật." });
  };

  const deleteGuest = async (id: number) => {
    const ok = await confirm({
      title: "Xác nhận xóa khỏi danh sách đen",
      message: "Bạn có chắc muốn xóa khách khỏi danh sách đen không?",
      confirmLabel: "Xóa",
      cancelLabel: "Hủy",
      tone: "danger",
    });
    if (!ok) return;
    setItems((prev) => prev.filter((x) => x.id !== id));
    if (editingGuestId === id) cancelEditGuest();
    pushToast({ type: "success", title: "Đã xóa", message: "Khách đã được xóa khỏi danh sách đen." });
  };

  const handleAddVehicle = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!newVehicle.plateNumber.trim()) {
      pushToast({ type: "warning", title: "Thiếu biển số", message: "Nhập biển số để thêm vào danh sách đen xe." });
      return;
    }
    const ok = await confirm({
      title: "Xác nhận thêm vào danh sách đen xe",
      message: `Thêm biển số: ${newVehicle.plateNumber.trim()}?`,
      confirmLabel: "Thêm",
      cancelLabel: "Hủy",
      tone: "default",
    });
    if (!ok) return;

    const nextId = items.length > 0 ? Math.max(...items.map((i) => i.id)) + 1 : 1;
    setItems((prev) => [...prev, { id: nextId, plateNumber: newVehicle.plateNumber.trim(), reason: newVehicle.reason }]);
    setNewVehicle({ plateNumber: "", reason: "" });
    pushToast({ type: "success", title: "Đã thêm", message: "Xe đã được thêm vào danh sách đen." });
  };

  const beginEditVehicle = (item: BlacklistItem) => {
    setEditingVehicleId(item.id);
    setNewVehicle({ plateNumber: item.plateNumber ?? "", reason: item.reason ?? "" });
  };

  const cancelEditVehicle = () => {
    setEditingVehicleId(null);
    setNewVehicle({ plateNumber: "", reason: "" });
  };

  const handleSaveVehicle = async (e: React.FormEvent) => {
    e.preventDefault();
    if (editingVehicleId === null) return;
    if (!newVehicle.plateNumber.trim()) {
      pushToast({ type: "warning", title: "Biển số trống", message: "Biển số không được để trống." });
      return;
    }
    const ok = await confirm({
      title: "Xác nhận lưu thay đổi",
      message: `Lưu chỉnh sửa biển số: ${newVehicle.plateNumber.trim()}?`,
      confirmLabel: "Lưu",
      cancelLabel: "Hủy",
      tone: "default",
    });
    if (!ok) return;

    setItems((prev) =>
      prev.map((x) =>
        x.id === editingVehicleId
          ? { ...x, plateNumber: newVehicle.plateNumber.trim(), idNumber: undefined, reason: newVehicle.reason }
          : x
      )
    );
    cancelEditVehicle();
    pushToast({ type: "success", title: "Đã lưu", message: "Thông tin danh sách đen xe đã được cập nhật." });
  };

  const deleteVehicle = async (id: number) => {
    const ok = await confirm({
      title: "Xác nhận xóa khỏi danh sách đen",
      message: "Bạn có chắc muốn xóa xe khỏi danh sách đen không?",
      confirmLabel: "Xóa",
      cancelLabel: "Hủy",
      tone: "danger",
    });
    if (!ok) return;
    setItems((prev) => prev.filter((x) => x.id !== id));
    if (editingVehicleId === id) cancelEditVehicle();
    pushToast({ type: "success", title: "Đã xóa", message: "Xe đã được xóa khỏi danh sách đen." });
  };

  return (
    <div>
      <h2 className="page-title flex items-center gap-3">
        <Ban className="h-6 w-6 text-rose-700" aria-hidden="true" />
        <span>Danh sách đen</span>
      </h2>

      {/* Guest blacklist section */}
      {canSeeGuestBlacklist && (
        <div className="card" style={{ borderLeft: "4px solid #10b981" }}>
          <div className="card-header">
            <div>
              <div className="card-title flex items-center gap-3">
                <Users className="h-5 w-5 text-slate-700" aria-hidden="true" />
                <span>Danh sách đen khách</span>
              </div>
              <div className="card-subtitle">CCCD bị cấm vào công ty</div>
            </div>
          </div>
          <div className="form-field" style={{ marginBottom: "1rem" }}>
            <label className="form-label" htmlFor="searchGuest">Tìm theo CCCD</label>
            <input
              id="searchGuest"
              className="form-input"
              placeholder="Nhập CCCD để tìm..."
              value={searchGuest}
              onChange={(e) => setSearchGuest(e.target.value)}
            />
          </div>
          <form
            onSubmit={editingGuestId !== null ? handleSaveGuest : handleAddGuest}
            style={{ marginBottom: "1rem" }}
          >
            <div className="form-grid">
              <div className="form-field">
                <label className="form-label" htmlFor="idNumber">CCCD</label>
                <input
                  id="idNumber"
                  className="form-input"
                  value={newGuest.idNumber}
                  onChange={(e) => setNewGuest((prev) => ({ ...prev, idNumber: e.target.value }))}
                  placeholder="Ví dụ: 012345678901"
                />
              </div>
              <div className="form-field">
                <label className="form-label" htmlFor="reasonGuest">Lý do</label>
                <input
                  id="reasonGuest"
                  className="form-input"
                  value={newGuest.reason}
                  onChange={(e) => setNewGuest((prev) => ({ ...prev, reason: e.target.value }))}
                  placeholder="Lý do cấm"
                />
              </div>
            </div>
            <div className="form-actions">
              {editingGuestId !== null ? (
                <>
                  <button type="submit" className="btn btn-primary">Lưu chỉnh sửa</button>
                  <button type="button" className="btn btn-secondary" onClick={cancelEditGuest}>Hủy</button>
                </>
              ) : (
                <button type="submit" className="btn btn-primary">Thêm khách vào danh sách đen</button>
              )}
            </div>
          </form>
          <table className="table">
            <thead>
              <tr>
                <th>STT</th>
                <th>CCCD</th>
                <th>Lý do</th>
                <th>Thao tác</th>
              </tr>
            </thead>
            <tbody>
              {filteredGuests.map((item, idx) => (
                <tr key={item.id}>
                  <td>{idx + 1}</td>
                  <td>{item.idNumber}</td>
                  <td>{item.reason || "-"}</td>
                  <td>
                    <div style={{ display: "flex", gap: "0.5rem", flexWrap: "wrap" }}>
                      <button type="button" className="btn btn-secondary" onClick={() => beginEditGuest(item)}>
                        Sửa
                      </button>
                      <button type="button" className="btn btn-secondary" onClick={() => deleteGuest(item.id)}>
                        Xóa
                      </button>
                    </div>
                  </td>
                </tr>
              ))}
              {filteredGuests.length === 0 && (
                <tr>
                  <td colSpan={4}>Chưa có khách nào trong danh sách đen.</td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
      )}

      {/* Vehicle blacklist section */}
      {canSeeVehicleBlacklist && (
        <div className="card" style={{ borderLeft: "4px solid #f59e0b" }}>
          <div className="card-header">
            <div>
              <div className="card-title flex items-center gap-3">
                <Car className="h-5 w-5 text-slate-700" aria-hidden="true" />
                <span>Danh sách đen xe</span>
              </div>
              <div className="card-subtitle">Biển số xe bị cấm vào bãi</div>
            </div>
          </div>
          <div className="form-field" style={{ marginBottom: "1rem" }}>
            <label className="form-label" htmlFor="searchVehicle">Tìm theo biển số</label>
            <input
              id="searchVehicle"
              className="form-input"
              placeholder="Nhập biển số để tìm..."
              value={searchVehicle}
              onChange={(e) => setSearchVehicle(e.target.value)}
            />
          </div>
          <form
            onSubmit={editingVehicleId !== null ? handleSaveVehicle : handleAddVehicle}
            style={{ marginBottom: "1rem" }}
          >
            <div className="form-grid">
              <div className="form-field">
                <label className="form-label" htmlFor="plateNumber">Biển số</label>
                <input
                  id="plateNumber"
                  className="form-input"
                  value={newVehicle.plateNumber}
                  onChange={(e) => setNewVehicle((prev) => ({ ...prev, plateNumber: e.target.value }))}
                  placeholder="Ví dụ: 51A-12345"
                />
              </div>
              <div className="form-field">
                <label className="form-label" htmlFor="reasonVehicle">Lý do</label>
                <input
                  id="reasonVehicle"
                  className="form-input"
                  value={newVehicle.reason}
                  onChange={(e) => setNewVehicle((prev) => ({ ...prev, reason: e.target.value }))}
                  placeholder="Lý do cấm"
                />
              </div>
            </div>
            <div className="form-actions">
              {editingVehicleId !== null ? (
                <>
                  <button type="submit" className="btn btn-primary">Lưu chỉnh sửa</button>
                  <button type="button" className="btn btn-secondary" onClick={cancelEditVehicle}>Hủy</button>
                </>
              ) : (
                <button type="submit" className="btn btn-primary">Thêm xe vào danh sách đen</button>
              )}
            </div>
          </form>
          <table className="table">
            <thead>
              <tr>
                <th>STT</th>
                <th>Biển số</th>
                <th>Lý do</th>
                <th>Thao tác</th>
              </tr>
            </thead>
            <tbody>
              {filteredVehicles.map((item, idx) => (
                <tr key={item.id}>
                  <td>{idx + 1}</td>
                  <td>{item.plateNumber}</td>
                  <td>{item.reason || "-"}</td>
                  <td>
                    <div style={{ display: "flex", gap: "0.5rem", flexWrap: "wrap" }}>
                      <button type="button" className="btn btn-secondary" onClick={() => beginEditVehicle(item)}>
                        Sửa
                      </button>
                      <button type="button" className="btn btn-secondary" onClick={() => deleteVehicle(item.id)}>
                        Xóa
                      </button>
                    </div>
                  </td>
                </tr>
              ))}
              {filteredVehicles.length === 0 && (
                <tr>
                  <td colSpan={4}>Chưa có xe nào trong danh sách đen.</td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
};

export default BlacklistPage;

