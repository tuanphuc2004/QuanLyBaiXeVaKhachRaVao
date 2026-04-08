import axiosClient from "./axiosClient";

export interface PlateRecognitionCandidate {
  candidateId: number;
  plateNumber: string;
  vehicleType: string;
  confidence?: number | null;
  createdAt: string;
  status: "pending" | "confirmed" | "rejected";
  decidedAt?: string | null;
  plateImageRelativePath?: string | null;
}

export interface PlateRecognitionConfirmPayload {
  qrOrIdNumber: string;
  vehiclePlate: string;
  vehicleType: string;
  badgeNumber?: string;
}

export const plateRecognitionApi = {
  getPending(limit = 5) {
    return axiosClient.get<PlateRecognitionCandidate[]>("/plate-recognitions/pending", {
      params: { limit },
    });
  },

  confirm(candidateId: number, payload: PlateRecognitionConfirmPayload) {
    return axiosClient.post(`/plate-recognitions/${candidateId}/confirm`, payload);
  },

  reject(candidateId: number) {
    return axiosClient.post(`/plate-recognitions/${candidateId}/reject`, {});
  },

  // For testing / integration: recognition system posts recognized plate here.
  submit(payload: { plateNumber: string; vehicleType?: string; confidence?: number }) {
    return axiosClient.post<PlateRecognitionCandidate>("/plate-recognitions", payload);
  },

  // MVP camera upload: send recognized plate + image to create pending candidate.
  submitWithImage(params: { imageFile: File; plateNumber: string; vehicleType?: string; confidence?: number }) {
    const form = new FormData();
    form.append("image", params.imageFile);
    form.append("plateNumber", params.plateNumber);
    if (params.vehicleType) form.append("vehicleType", params.vehicleType);
    if (params.confidence != null) form.append("confidence", String(params.confidence));
    return axiosClient.post<PlateRecognitionCandidate>("/plate-recognitions/with-image", form, {
      headers: { "Content-Type": "multipart/form-data" },
    });
  },

  // Auto camera OCR MVP: backend runs OCR and creates pending.
  ocrWithImage(params: { imageFile: File }) {
    const form = new FormData();
    form.append("image", params.imageFile);
    return axiosClient.post<PlateRecognitionCandidate>("/plate-recognitions/ocr-with-image", form, {
      headers: { "Content-Type": "multipart/form-data" },
    });
  },
};

