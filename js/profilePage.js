"use strict";

/* Shared controller for both resident and admin profile pages.  The markup
 * supplies data-profile-page (view/edit) and data-profile-return-url. */
document.addEventListener("DOMContentLoaded", () => {
  const page = document.body.dataset.profilePage;
  const returnUrl = document.body.dataset.profileReturnUrl || "profile.html";
  const formatRole = (role) => (role || "User").replaceAll("_", " ").replace(/\b\w/g, (letter) => letter.toUpperCase());
  const formatDate = (value) => value ? new Date(value).toLocaleDateString("en-PH", { year: "numeric", month: "long", day: "numeric" }) : "Not available";

  async function getProfile() {
    try {
      const response = await api.getProfile();
      if (!response?.success || !response.data) {
        throw new Error(response?.message || "Unable to load profile.");
      }
      api.setUser(response.data);
      return response.data;
    } catch (error) {
      // Authentication stores the current account locally.  It is a reliable
      // read-only fallback while the API is being restarted or is unavailable.
      const storedUser = api.getStoredUser?.();
      if (storedUser?.id && storedUser?.role) {
        return storedUser;
      }
      throw error;
    }
  }

  if (page === "view") {
    const elements = {
      name: document.getElementById("profileName"), role: document.getElementById("profileRole"),
      email: document.getElementById("profileEmail"), id: document.getElementById("profileUserId"),
      joined: document.getElementById("profileJoined"), picture: document.getElementById("profilePicture"),
      status: document.getElementById("profileStatus"), refresh: document.getElementById("refreshProfileBtn"),
    };
    const render = async () => {
      elements.status.textContent = "Loading profile…";
      try {
        const user = await getProfile();
        elements.name.textContent = `${user.first_name} ${user.last_name}`.trim() || "Unnamed user";
        elements.role.textContent = formatRole(user.role);
        elements.email.textContent = user.email || "Not available";
        elements.id.textContent = user.id || "Not available";
        elements.joined.textContent = formatDate(user.created_at);
        if (user.profile_picture_url) elements.picture.src = user.profile_picture_url;
        elements.status.textContent = "";
      } catch (error) {
        console.error("Profile load failed:", error);
        elements.status.textContent = "We could not load your profile. Please try again.";
        showNotification(error.message || "Unable to load profile data.", "error");
      }
    };
    elements.refresh?.addEventListener("click", render);
    render();
    return;
  }

  if (page !== "edit") return;
  const form = document.getElementById("profileEditForm");
  const firstName = document.getElementById("firstName");
  const lastName = document.getElementById("lastName");
  const email = document.getElementById("email");
  const photo = document.getElementById("profilePhoto");
  const preview = document.getElementById("photoPreview");
  const status = document.getElementById("profileStatus");
  let photoDataUrl = "";

  async function load() {
    status.textContent = "Loading profile…";
    try {
      const user = await getProfile();
      firstName.value = user.first_name || "";
      lastName.value = user.last_name || "";
      email.value = user.email || "";
      photoDataUrl = user.profile_picture_url || "";
      if (photoDataUrl) preview.src = photoDataUrl;
      status.textContent = "";
    } catch (error) {
      console.error("Profile edit load failed:", error);
      status.textContent = "We could not load your profile. Please return to the dashboard and try again.";
    }
  }

  photo.addEventListener("change", () => {
    const file = photo.files?.[0];
    if (!file) return;
    if (!file.type.startsWith("image/") || file.size > 2 * 1024 * 1024) {
      photo.value = "";
      showNotification("Choose an image smaller than 2 MB.", "error");
      return;
    }
    const reader = new FileReader();
    reader.onload = () => { photoDataUrl = String(reader.result); preview.src = photoDataUrl; };
    reader.onerror = () => showNotification("Unable to read the selected image.", "error");
    reader.readAsDataURL(file);
  });

  form.addEventListener("submit", async (event) => {
    event.preventDefault();
    const submit = form.querySelector('[type="submit"]');
    setButtonLoading(submit, true);
    try {
      const response = await api.updateProfile({ first_name: firstName.value.trim(), last_name: lastName.value.trim(), email: email.value.trim(), profile_picture_url: photoDataUrl });
      if (!response?.success) throw new Error(response?.message || "Unable to save profile.");
      api.setUser(response.data);
      window.location.assign(returnUrl);
    } catch (error) {
      console.error("Profile update failed:", error);
      showNotification(error.message || "Unable to save profile.", "error");
      setButtonLoading(submit, false);
    }
  });
  load();
});
