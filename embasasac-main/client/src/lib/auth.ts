import { useState, useEffect } from "react";
import { AccessCode } from "@shared/schema";

export type CurrentUser = AccessCode | null;

class AuthManager {
  private currentUser: CurrentUser = null;
  private listeners: ((user: CurrentUser) => void)[] = [];

  getCurrentUser(): CurrentUser {
    return this.currentUser;
  }

  setCurrentUser(user: CurrentUser) {
    this.currentUser = user;
    this.listeners.forEach(listener => listener(user));
  }

  addListener(listener: (user: CurrentUser) => void) {
    this.listeners.push(listener);
    return () => {
      const index = this.listeners.indexOf(listener);
      if (index > -1) {
        this.listeners.splice(index, 1);
      }
    };
  }

  logout() {
    this.setCurrentUser(null);
  }
}

export const authManager = new AuthManager();

export function useAuth() {
  const [currentUser, setCurrentUser] = useState<CurrentUser>(authManager.getCurrentUser());

  useEffect(() => {
    return authManager.addListener(setCurrentUser);
  }, []);

  return {
    currentUser,
    login: (user: AccessCode) => authManager.setCurrentUser(user),
    logout: () => authManager.logout(),
  };
}
