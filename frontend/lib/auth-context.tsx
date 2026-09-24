"use client";

import React, { createContext, useContext, useState, useEffect } from "react";
import { User } from "./types";
import { fetchCurrentUser, loginUser, registerUser } from "./api";

interface AuthContextType {
  user: User | null;
  token: string | null;
  isLoading: boolean;
  login: (email: string, password: string) => Promise<User>;
  register: (data: { email: string; password: string; full_name: string; steg_contract_no?: string }) => Promise<User>;
  logout: () => void;
  switchRoleDemo: (role: "CITIZEN" | "ADMIN") => Promise<void>;
}

const AuthContext = createContext<AuthContextType | undefined>(undefined);

export const AuthProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const [user, setUser] = useState<User | null>(null);
  const [token, setToken] = useState<string | null>(null);
  const [isLoading, setIsLoading] = useState(true);

  const saveTokenAndCookie = (tok: string, u: User) => {
    localStorage.setItem("steg_solar_token", tok);
    localStorage.setItem("session", JSON.stringify({ email: u.email, role: u.role, fullName: u.full_name }));
    // Also store cookie for client/middleware sync
    document.cookie = `steg_token=${tok}; path=/; max-age=86400; SameSite=Lax`;
    document.cookie = `steg_role=${u.role}; path=/; max-age=86400; SameSite=Lax`;
    setToken(tok);
    setUser(u);
  };

  const clearAuth = () => {
    localStorage.removeItem("steg_solar_token");
    localStorage.removeItem("session");
    document.cookie = "steg_token=; path=/; max-age=0";
    document.cookie = "steg_role=; path=/; max-age=0";
    setToken(null);
    setUser(null);
  };

  useEffect(() => {
    const savedToken = localStorage.getItem("steg_solar_token");
    if (savedToken) {
      setToken(savedToken);
      fetchCurrentUser()
        .then((u) => {
          setUser(u);
          // Sync cookies
          document.cookie = `steg_token=${savedToken}; path=/; max-age=86400; SameSite=Lax`;
          document.cookie = `steg_role=${u.role}; path=/; max-age=86400; SameSite=Lax`;
        })
        .catch(() => {
          clearAuth();
        })
        .finally(() => setIsLoading(false));
    } else {
      setIsLoading(false);
    }
  }, []);

  const login = async (email: string, password: string): Promise<User> => {
    setIsLoading(true);
    try {
      const data = await loginUser(email, password);
      saveTokenAndCookie(data.access_token, data.user);
      return data.user;
    } finally {
      setIsLoading(false);
    }
  };

  const register = async (data: { email: string; password: string; full_name: string; steg_contract_no?: string }): Promise<User> => {
    setIsLoading(true);
    try {
      const res = await registerUser(data);
      saveTokenAndCookie(res.access_token, res.user);
      return res.user;
    } finally {
      setIsLoading(false);
    }
  };

  const logout = () => {
    clearAuth();
  };

  const switchRoleDemo = async (role: "CITIZEN" | "ADMIN") => {
    if (role === "ADMIN") {
      await login("admin@example.com", "admin123");
    } else {
      await login("citizen@example.com", "citizen123");
    }
  };

  return (
    <AuthContext.Provider value={{ user, token, isLoading, login, register, logout, switchRoleDemo }}>
      {children}
    </AuthContext.Provider>
  );
};

export const useAuth = () => {
  const context = useContext(AuthContext);
  if (!context) throw new Error("useAuth must be used within an AuthProvider");
  return context;
};
