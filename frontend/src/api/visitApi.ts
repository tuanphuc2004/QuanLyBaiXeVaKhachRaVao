import axiosClient from "./axiosClient";

export interface Visit {
  visitId: number;
  qrOrIdNumber: string;
  vehiclePlate: string;
  vehicleType: string;
  badgeNumber: string;
  checkInTime: string;
  checkOutTime?: string | null;
  vehiclePlateImageRelativePath?: string | null;
}

export interface CheckinPayload {
  qrOrIdNumber: string;
  vehiclePlate: string;
  vehicleType: string;
  badgeNumber: string;
}

export interface CheckoutPayload {
  qrOrBadge: string;
}

export const visitApi = {
  getVisits(fromDate?: string, toDate?: string) {
    const params: Record<string, string> = {};
    if (fromDate) params.fromDate = fromDate;
    if (toDate) params.toDate = toDate;
    return axiosClient.get<Visit[]>("/visits", { params });
  },
  checkin(payload: CheckinPayload) {
    return axiosClient.post<Visit>("/visits/checkin", payload);
  },
  checkout(payload: CheckoutPayload) {
    return axiosClient.post<Visit>("/visits/checkout", payload);
  }
};

