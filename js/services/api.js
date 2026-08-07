/**
 * API Service Layer
 *
 * Centralized interface for all backend communication.
 * Handles authentication, request formatting, and error handling in one place.
 *
 * NOTE:
 * This service is designed for a full backend implementation.
 * Some endpoints may not exist yet in the current backend scaffold.
 */
"use strict";

class ApiService {
  constructor(baseURL = "/api") {
    const isLocalFile =
      typeof window !== "undefined" &&
      (window.location.protocol === "file:" ||
        window.location.origin === "null");
    if (isLocalFile) {
      this.baseURL = "http://localhost:3000/api";
    } else {
      this.baseURL = baseURL;
    }
    this.token = this.getToken();
    this.user = this.getStoredUser();
    this.signingOut = false; // prevents a 401 handler racing against intentional sign-out
  }

  // AUTH STORAGE HANDLING

  getToken() {
    return localStorage.getItem("authToken");
  }

  setToken(token) {
    this.token = token;
    localStorage.setItem("authToken", token);
  }

  clearToken() {
    this.token = null;
    this.user = null;
    localStorage.removeItem("authToken");
    localStorage.removeItem("user");
  }

  getStoredUser() {
    const userStr = localStorage.getItem("user");
    if (!userStr) return null;

    try {
      return JSON.parse(userStr);
    } catch {
      localStorage.removeItem("user");
      return null;
    }
  }

  setUser(user) {
    this.user = user;
    localStorage.setItem("user", JSON.stringify(user));
  }

  // CORE REQUEST HANDLER

  async request(endpoint, options = {}) {
    const isFormData = options.body instanceof FormData;
    const headers = {
      ...options.headers,
    };

    if (!isFormData) {
      headers["Content-Type"] = "application/json";
    }

    // Attach token if available (used for protected routes)
    if (this.token) {
      headers["Authorization"] = `Bearer ${this.token}`;
    }

    try {
      const response = await fetch(`${this.baseURL}${endpoint}`, {
        ...options,
        headers,
      });

      const responseText = await response.text();
      const data = responseText ? JSON.parse(responseText) : {};

    if (!response.ok) {
      if (response.status === 401 && endpoint !== "/auth/sign-in") {
        this.clearToken();

        if (!this.signingOut) {
          window.location.href = "sign_in.html";
        }
      }
      throw new Error(data.message || "API request failed");
    }

      return data;
    } catch (error) {
      console.error("API Error:", error);
      throw error;
    }
  }

  // HTTP METHODS

  get(endpoint) {
    return this.request(endpoint, { method: "GET" });
  }

  post(endpoint, data) {
    return this.request(endpoint, {
      method: "POST",
      body: data instanceof FormData ? data : JSON.stringify(data),
    });
  }

  patch(endpoint, data) {
    return this.request(endpoint, {
      method: "PATCH",
      body: data instanceof FormData ? data : JSON.stringify(data),
    });
  }

  delete(endpoint) {
    return this.request(endpoint, { method: "DELETE" });
  }

  signIn(email, password) {
    return this.post("/auth/sign-in", { email, password });
  }

  register(userData) {
    return this.post("/auth/register", userData);
  }

  signOut() {
    this.signingOut = true; // disarms the 401 redirect in request()
    this.clearToken();
    return Promise.resolve();
  }

  getComplaints(filters = {}) {
    const params = new URLSearchParams(filters);
    return this.get(`/complaints?${params}`);
  }

  getPublicComplaintFeed() {
    return this.get("/complaints/public-feed");
  }

  getComplaintById(id) {
    return this.get(`/complaints/${id}`);
  }

  createComplaint(complaintData) {
    return this.post("/complaints", complaintData);
  }

  checkComplaintEligibility() {
    return this.get("/complaints/check-eligibility");
  }

  updateComplaintStatus(id, status, notes, sourceData = {}) {
    return this.patch(`/complaints/${id}/status`, {
      status,
      notes,
      ...sourceData,
    });
  }

  archiveComplaint(id) {
    return this.patch(`/complaints/${id}/archive`, { is_archived: true });
  }

  restoreComplaint(id) {
    return this.patch(`/complaints/${id}/archive`, { is_archived: false });
  }

  addComplaintComment(id, comment, isInternal = false) {
    return this.post(`/complaints/${id}/comment`, { comment, isInternal });
  }

  addComplaintFollowUp(id, update) {
    return this.post(`/complaints/${id}/follow-up`, { update });
  }

  updateComplaintRespondent(id, respondentData) {
    return this.patch(`/complaints/${id}/respondent`, respondentData);
  }

getComplaintComments(id) {
    return this.get(`/complaints/${id}/comments`);
  }

  getPendingResidents() {
    return this.get("/residents/pending");
  }

  approveResident(id) {
    return this.post(`/residents/${id}/approve`, {});
  }

  rejectResident(id, reason) {
    return this.post(`/residents/${id}/reject`, { reason });
  }

  getAllResidents() {
    return this.get("/residents/all");
  }

  archiveResident(id) {
    return this.patch(`/residents/${id}/archive`, { is_archived: true });
  }

  restoreResident(id) {
    return this.patch(`/residents/${id}/archive`, { is_archived: false });
  }

  getNotifications() {
    return this.get("/notifications");
  }

  getUnreadNotifications() {
    return this.get("/notifications/unread");
  }

  markNotificationAsRead(id) {
    return this.patch(`/notifications/${id}/read`, {});
  }

  getNotificationPreferences() {
    return this.get("/notification-preferences");
  }

  updateNotificationPreferences(preferences) {
    return this.patch("/notification-preferences", preferences);
  }

  getProfile() {
    return this.get("/profile");
  }

  updateProfile(profileData) {
    return this.patch("/profile", profileData);
  }

  changePassword(currentPassword, newPassword) {
    return this.post("/profile/change-password", {
      currentPassword,
      newPassword,
    });
  }

  getActivityLog() {
    return this.get("/profile/activity-log");
  }

  getSystemActivityLogs() {
    return this.get("/activity");
  }

  getReportOverview() {
    return this.get("/reports/overview");
  }

  getDashboardReport() {
    return this.get("/reports/dashboard");
  }

  getReportByCategory() {
    return this.get("/reports/by-category");
  }

  getReportByMonth() {
    return this.get("/reports/monthly");
  }

  getReportResolution() {
    return this.get("/reports/resolution");
  }

  getReportPriority() {
    return this.get("/reports/priority");
  }

  exportReport(format = "pdf", reportType = "all") {
    return this.get(`/reports/export?format=${format}&type=${reportType}`);
  }

  getAdminUsers() {
    return this.get("/admin-users");
  }

  activateAdminUser(id) {
    return this.post(`/admin-users/${id}/activate`, {});
  }

  deactivateAdminUser(id) {
    return this.post(`/admin-users/${id}/deactivate`, {});
  }
}

const api = new ApiService();
