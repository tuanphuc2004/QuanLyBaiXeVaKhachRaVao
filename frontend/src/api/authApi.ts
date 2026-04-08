import axiosClient from "./axiosClient";

export interface LoginRequest {
  username: string;
  password: string;
}

export interface LoginResponse {
  accessToken: string;
  tokenType: string;
  username: string;
  fullName: string;
  role: "Admin" | "Security" | "Employee" | "Director";
}

export type UserRole = "Admin" | "Security" | "Employee" | "Director";

export interface UserAccount {
  username: string;
  fullName: string;
  role: UserRole;
}

export interface CreateUserPayload {
  username: string;
  password: string;
  fullName: string;
  role: UserRole;
}

export interface UpdateUserPayload {
  fullName?: string;
  role?: UserRole;
  password?: string;
}

export const authApi = {
  login(payload: LoginRequest) {
    return axiosClient.post<LoginResponse>("/auth/login", payload);
  },
  listUsers() {
    return axiosClient.get<UserAccount[]>("/auth/users");
  },
  createUser(payload: CreateUserPayload) {
    return axiosClient.post<UserAccount>("/auth/users", payload);
  },
  updateUser(username: string, payload: UpdateUserPayload) {
    return axiosClient.patch<UserAccount>(`/auth/users/${encodeURIComponent(username)}`, payload);
  },
  deleteUser(username: string) {
    return axiosClient.delete<void>(`/auth/users/${encodeURIComponent(username)}`);
  },
};

