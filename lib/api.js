// Medha.ai API Service for Browser Extension
// Connected to note-tube-backend

class MedhaAPI {
  constructor() {
    this.baseURL = 'http://localhost:8000';
    this.isRefreshing = false;
    this.refreshSubscribers = [];
  }

  async getTokens() {
    return await chrome.storage.local.get(['authToken', 'refreshToken']);
  }

  async setTokens(authToken, refreshToken) {
    await chrome.storage.local.set({ authToken, refreshToken });
  }

  async clearTokens() {
    await chrome.storage.local.remove(['authToken', 'refreshToken']);
  }

  onRefreshed(token) {
    this.refreshSubscribers.map(cb => cb(token));
    this.refreshSubscribers = [];
  }

  async request(endpoint, options = {}) {
    const { authToken } = await this.getTokens();

    const config = {
      ...options,
      headers: {
        'Content-Type': 'application/json',
        ...(authToken && { 'Authorization': `Bearer ${authToken}` }),
        ...options.headers,
      },
    };

    // Prevent Content-Type header if body is FormData
    if (options.body instanceof FormData) {
      delete config.headers['Content-Type'];
    }

    try {
      let response = await fetch(`${this.baseURL}${endpoint}`, config);

      // Handle 401 Unauthorized with Refresh Token
      if (response.status === 401) {
        const { refreshToken } = await this.getTokens();
        if (!refreshToken) {
          await this.clearTokens();
          throw new Error('Session expired. Please login again.');
        }

        if (!this.isRefreshing) {
          this.isRefreshing = true;
          try {
            const refreshRes = await fetch(`${this.baseURL}/auth/refresh`, {
              method: 'POST',
              headers: { 'Content-Type': 'application/json' },
              body: JSON.stringify({ refresh_token: refreshToken })
            });

            if (!refreshRes.ok) throw new Error('Refresh failed');

            const refreshData = await refreshRes.json();
            await this.setTokens(refreshData.access_token, refreshData.refresh_token);
            this.isRefreshing = false;
            this.onRefreshed(refreshData.access_token);

            // Retry the original request
            config.headers['Authorization'] = `Bearer ${refreshData.access_token}`;
            response = await fetch(`${this.baseURL}${endpoint}`, config);
          } catch (refreshErr) {
            this.isRefreshing = false;
            await this.clearTokens();
            throw new Error('Session expired. Please login again.');
          }
        } else {
          // Wait for refresh to complete
          return new Promise(resolve => {
            this.refreshSubscribers.push(token => {
              config.headers['Authorization'] = `Bearer ${token}`;
              resolve(fetch(`${this.baseURL}${endpoint}`, config).then(res => res.json()));
            });
          });
        }
      }

      let data;
      try {
        data = await response.json();
      } catch {
        data = { detail: 'Invalid response from server' };
      }

      if (!response.ok) {
        throw new Error(this.extractErrorMessage(data));
      }

      return data;
    } catch (error) {
      if (error.message) throw error;
      throw new Error('Network error. Please check your internet connection.');
    }
  }

  extractErrorMessage(errorData) {
    if (typeof errorData.detail === 'string') return errorData.detail;
    if (Array.isArray(errorData.detail)) return errorData.detail.map(e => e.msg).join(', ');
    if (errorData.message) return errorData.message;
    if (errorData.error) return errorData.error;
    return 'Something went wrong. Please try again.';
  }

  // ============================================================================
  // USER AUTHENTICATION
  // ============================================================================

  async signup(userData) {
    return this.request('/auth/register', {
      method: 'POST',
      body: JSON.stringify(userData),
    });
  }

  async loginInitiate(email, password) {
    return this.request('/auth/login/initiate', {
      method: 'POST',
      body: JSON.stringify({ email, password }),
    });
  }

  async loginConfirm(email, otp) {
    return this.request('/auth/login/confirm', {
      method: 'POST',
      body: JSON.stringify({ email, otp }),
    });
  }

  async forgotPassword(email) {
    return this.request('/auth/forgot-password/initiate', {
      method: 'POST',
      body: JSON.stringify({ email }),
    });
  }

  async resetPassword(email, otp, new_password) {
    return this.request('/auth/forgot-password/confirm', {
      method: 'POST',
      body: JSON.stringify({ email, otp, new_password }),
    });
  }

  async getCurrentUser() {
    return this.request('/auth/me', {
      method: 'GET'
    });
  }

  // ============================================================================
  // GROUPS & SUBGROUPS
  // ============================================================================
  async getGroups() {
    return this.request('/groups');
  }

  async createGroup(groupName) {
    return this.request('/groups', {
      method: 'POST',
      body: JSON.stringify({ group_name: groupName })
    });
  }

  async getSubgroups(groupId) {
    return this.request(`/groups/${groupId}/subgroups`);
  }

  async createSubgroup(groupId, subgroupName) {
    return this.request(`/groups/${groupId}/subgroups`, {
      method: 'POST',
      body: JSON.stringify({ subgroup_name: subgroupName })
    });
  }

  // ============================================================================
  // TUTORIALS
  // ============================================================================

  async createTutorial(tutorialData) {
    return this.request('/tutorials', {
      method: 'POST',
      body: JSON.stringify(tutorialData),
    });
  }

  async getMyTutorials() {
    return this.request('/tutorials');
  }

  async findTutorialByLink(url) {
    try {
      return await this.request(`/tutorials/by-url?url=${encodeURIComponent(url)}`);
    } catch (error) {
      const msg = error.message.toLowerCase();
      if (msg.includes("404") || msg.includes("not found")) return null;
      throw error;
    }
  }

  async assignTutorial(tutorialId, groupId, subgroupId = null) {
    return this.request(`/tutorials/${tutorialId}/assign`, {
      method: 'PATCH',
      body: JSON.stringify({
        group_id: groupId,
        subgroup_id: subgroupId
      }),
    });
  }

  // ============================================================================
  // NOTES (w/ Media)
  // ============================================================================

  async uploadMedia(file) {
    const formData = new FormData();
    formData.append('file', file);
    return this.request('/utils/upload', {
      method: 'POST',
      body: formData
    });
  }

  async addNote(tutorialId, note, timestamp, imagesBase64 = []) {
    const formData = new FormData();
    formData.append('tutorial_id', tutorialId);
    if (note) formData.append('note_content', note);
    if (timestamp) formData.append('timestamp', timestamp);

    if (imagesBase64 && imagesBase64.length > 0) {
      imagesBase64.forEach((imageBase64, index) => {
        try {
          const matches = imageBase64.match(/^data:(image\/[a-zA-Z]+);base64,(.*)$/);
          if (matches && matches.length === 3) {
            const contentType = matches[1];
            const b64Data = matches[2];
            const byteCharacters = atob(b64Data);
            const byteArrays = [];
            for (let offset = 0; offset < byteCharacters.length; offset += 512) {
              const slice = byteCharacters.slice(offset, offset + 512);
              const byteNumbers = new Array(slice.length);
              for (let i = 0; i < slice.length; i++) {
                byteNumbers[i] = slice.charCodeAt(i);
              }
              const byteArray = new Uint8Array(byteNumbers);
              byteArrays.push(byteArray);
            }
            const blob = new Blob(byteArrays, { type: contentType });

            // Append as 'media' (FastAPI expects List[UploadFile])
            formData.append('media', blob, `image_${Date.now()}_${index}.${contentType.split('/')[1]}`);
          }
        } catch (e) {
          console.warn('Failed to parse base64 image', e);
        }
      });
    }

    return this.request('/notes', {
      method: 'POST',
      body: formData
    });
  }

  async getNotes(tutorialId, skip = 0, limit = 10) {
    return this.request(`/notes/tutorial/${tutorialId}?skip=${skip}&limit=${limit}`);
  }

  async updateNote(noteId, content, mediaToKeep = [], newImagesBase64 = []) {
    const formData = new FormData();
    if (content !== undefined && content !== null) {
      formData.append('note_content', content);
    }

    if (mediaToKeep && mediaToKeep.length > 0) {
      mediaToKeep.forEach(url => {
        formData.append('media_to_keep', url);
      });
    }

    if (newImagesBase64 && newImagesBase64.length > 0) {
      newImagesBase64.forEach((imageBase64, index) => {
        try {
          const matches = imageBase64.match(/^data:(image\/[a-zA-Z]+);base64,(.*)$/);
          if (matches && matches.length === 3) {
            const contentType = matches[1];
            const b64Data = matches[2];
            const byteCharacters = atob(b64Data);
            const byteArrays = [];
            for (let offset = 0; offset < byteCharacters.length; offset += 512) {
              const slice = byteCharacters.slice(offset, offset + 512);
              const byteNumbers = new Array(slice.length);
              for (let i = 0; i < slice.length; i++) {
                byteNumbers[i] = slice.charCodeAt(i);
              }
              const byteArray = new Uint8Array(byteNumbers);
              byteArrays.push(byteArray);
            }
            const blob = new Blob(byteArrays, { type: contentType });

            // Append as 'new_media' (FastAPI expects List[UploadFile])
            formData.append('new_media', blob, `image_update_${Date.now()}_${index}.${contentType.split('/')[1]}`);
          }
        } catch (e) {
          console.warn('Failed to parse base64 image', e);
        }
      });
    }

    return this.request(`/notes/${noteId}`, {
      method: 'PATCH',
      body: formData,
    });
  }

  async deleteNote(noteId) {
    return this.request(`/notes/${noteId}`, {
      method: 'DELETE',
    });
  }

  // ============================================================================
  // CHATS
  // ============================================================================

  async chatWithAI(tutorialId, message, currentTimestamp) {
    return this.request(`/chats/tutorial/${tutorialId}`, {
      method: 'POST',
      body: JSON.stringify({
        message,
        current_timestamp: currentTimestamp
      }),
    });
  }

  async getChatHistory(tutorialId, skip = 0, limit = 50) {
    return this.request(`/chats/tutorial/${tutorialId}?skip=${skip}&limit=${limit}`);
  }

  // ============================================================================
  // QUIZZES
  // ============================================================================

  async generateQuiz(tutorialId) {
    return this.request(`/quizzes/tutorial/${tutorialId}/generate`, {
      method: 'POST'
    });
  }

  async getTutorialQuizzes(tutorialId) {
    return this.request(`/quizzes/tutorial/${tutorialId}`);
  }

  async evaluateQuiz(quizId, answers) {
    return this.request(`/quizzes/${quizId}/evaluate`, {
      method: 'POST',
      body: JSON.stringify({ answers }),
    });
  }

}

// Create global instance
const api = new MedhaAPI();

