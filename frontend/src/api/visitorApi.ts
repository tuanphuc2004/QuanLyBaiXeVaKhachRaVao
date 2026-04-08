import axiosClient from "./axiosClient";

export interface Visitor {
  visitorId: number;
  fullName: string;
  idNumber?: string;
  phone?: string;
  companyName?: string;
  email?: string;
  appointmentDate?: string;
  appointmentTime?: string;
  hostName?: string;
  department?: string;
  isPreRegistration?: boolean;
  qrToken?: string;
}

export interface PagedResult<T> {
  items: T[];
  pageNumber: number;
  pageSize: number;
  totalRecords: number;
  totalPages: number;
}

export interface CreateVisitorRequest {
  fullName: string;
  idNumber?: string;
  phone?: string;
  companyName?: string;
  email?: string;
  appointmentDate?: string;
  appointmentTime?: string;
  hostName?: string;
  department?: string;
  isPreRegistration?: boolean;
}

export const visitorApi = {
  getVisitors(pageNumber = 1, pageSize = 10, searchTerm = "") {
    return axiosClient.get<PagedResult<Visitor>>("/visitors", {
      params: { pageNumber, pageSize, searchTerm }
    });
  },

  createVisitor(payload: CreateVisitorRequest) {
    return axiosClient.post<Visitor>("/visitors", payload);
  },

  createVisitorPublic(payload: CreateVisitorRequest) {
    return axiosClient.post<Visitor>("/visitors/public-registration", payload);
  },

  getVisitorsForReception(pageNumber = 1, pageSize = 10, searchTerm = "") {
    return axiosClient.get<PagedResult<Visitor>>("/visitors/available-for-checkin", {
      params: { pageNumber, pageSize, searchTerm }
    });
  },

  approveVisitor(visitorId: number) {
    return axiosClient.post<Visitor>(`/visitors/${visitorId}/approve`, {});
  },

  getPendingApprovalCount() {
    return axiosClient.get<{ count: number }>("/visitors/pending-approval-count");
  }
};

