import React, { useState } from "react";
import { useNavigate } from "react-router-dom";

import { authApi } from "../api/authApi";

const LoginPage: React.FC = () => {
  const navigate = useNavigate();
  const [username, setUsername] = useState("");
  const [password, setPassword] = useState("");
  const [showPassword, setShowPassword] = useState(false);
  const [rememberMe, setRememberMe] = useState(true);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const handleSubmit = async (event: React.FormEvent) => {
    event.preventDefault();
    setError(null);
    setLoading(true);
    try {
      const response = await authApi.login({ username, password });
      const data = response.data;
      localStorage.setItem("access_token", data.accessToken);
      localStorage.setItem("current_username", data.username);
      localStorage.setItem("current_full_name", data.fullName);
      localStorage.setItem("current_role", data.role);
      const target = "/";
      navigate(target);
    } catch (err: any) {
      if (err?.response?.status === 401) {
        setError("Tên đăng nhập hoặc mật khẩu không đúng");
      } else {
        setError("Không kết nối được tới server. Vui lòng kiểm tra backend đang chạy.");
      }
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="login-neo-root">
      <div className="login-neo-shell">
        <div className="login-neo-left" aria-hidden="true">
          <div className="login-neo-circles">
            <div className="login-neo-circle login-neo-circle-a" />
            <div className="login-neo-circle login-neo-circle-b" />
            <div className="login-neo-circle login-neo-circle-c" />
          </div>
          <div className="login-neo-left-inner">
            <div className="login-neo-left-title">NEOCODERS</div>
            <div className="login-neo-left-desc">
              Quản lý người và phương tiện ra vào công ty - giao diện gọn gàng, rõ ràng, dễ thao tác.
            </div>
          </div>
        </div>

        <div className="login-neo-right">
          <div className="login-neo-right-title">Đăng nhập</div>
          <div className="login-neo-right-desc">Quản lý người và phương tiện ra vào công ty</div>

          <form className="login-neo-form" onSubmit={handleSubmit}>
            {error && <div className="login-neo-error">{error}</div>}

            <div className="login-neo-field">
              <label className="login-neo-label" htmlFor="username">Tên đăng nhập</label>
              <input
                id="username"
                className="login-neo-input"
                value={username}
                onChange={(e) => setUsername(e.target.value)}
                placeholder="Ví dụ: admin"
                autoComplete="username"
                required
              />
            </div>

            <div className="login-neo-field">
              <div className="login-neo-label-row">
                <label className="login-neo-label" htmlFor="password">Mật khẩu</label>
                <button
                  type="button"
                  className="login-neo-link"
                  onClick={() => setShowPassword((v) => !v)}
                  aria-label="Toggle password visibility"
                >
                  {showPassword ? "Ẩn" : "Hiện"}
                </button>
              </div>

              <input
                id="password"
                className="login-neo-input"
                type={showPassword ? "text" : "password"}
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                placeholder="Nhập mật khẩu"
                autoComplete="current-password"
                required
              />
            </div>

            <div className="login-neo-row">
              <label className="login-neo-check">
                <input
                  type="checkbox"
                  checked={rememberMe}
                  onChange={(e) => setRememberMe(e.target.checked)}
                />
                <span>Ghi nhớ đăng nhập</span>
              </label>

              <a className="login-neo-link" href="#">
                Quên mật khẩu?
              </a>
            </div>

            <button type="submit" className="login-neo-btn" disabled={loading}>
              {loading ? "Đang đăng nhập..." : "Đăng nhập"}
            </button>

            <button
              type="button"
              className="login-neo-btn-secondary"
              onClick={() => navigate("/public/appointment")}
            >
              Khách hàng đăng ký lịch hẹn
            </button>
          </form>
        </div>
      </div>
    </div>
  );
};

export default LoginPage;

