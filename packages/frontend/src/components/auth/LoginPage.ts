/**
 * Login Page Component
 * Form state, loading state with spinner, and error state
 */

interface LoginCredentials {
  username_or_email: string;
  password: string;
}

type UIState = "form" | "loading" | "error";

export class LoginPageComponent {
  private containerId: string;
  private currentState: UIState = "form";
  private errorMessage: string = "";
  private onLoginSuccess: (data: any) => void;

  constructor(containerId: string, onLoginSuccess: (data: any) => void) {
    this.containerId = containerId;
    this.onLoginSuccess = onLoginSuccess;
  }

  init(): void {
    this.render();
    this.setupEventListeners();
  }

  private render(): void {
    const container = document.getElementById(this.containerId);
    if (!container) return;

    let content = "";

    if (this.currentState === "form") {
      content = this.renderFormState();
    } else if (this.currentState === "loading") {
      content = this.renderLoadingState();
    } else if (this.currentState === "error") {
      content = this.renderErrorState();
    }

    container.innerHTML = `
      <div class="min-h-screen bg-gradient-to-br from-amber-50 via-white to-amber-50 flex items-center justify-center py-6 px-6">
        <div class="w-full max-w-md h-fit transition-opacity duration-500 ease-in-out" id="content-wrapper">
          ${content}
        </div>
      </div>
    `;

    this.setupEventListeners();
  }

  private renderFormState(): string {
    return `
      <div class="w-full">
        <!-- Header -->
        <div class="mb-8 text-center animate-slideDown">
          <h1 class="text-4xl font-bold text-gray-900 tracking-tight">Absensi Santri</h1>
          <p class="text-gray-600 text-sm mt-3">Masukkan kredensial Anda untuk melanjutkan</p>
        </div>

        <!-- Login Card -->
        <div class="bg-white rounded-xl shadow-lg p-6 animate-fadeInUp border border-gray-100 hover:shadow-xl transition-shadow duration-300">
          <!-- Form -->
          <form id="login-form" class="space-y-5">
            <!-- Username/Email -->
            <div class="group">
              <label class="block text-sm font-medium text-gray-700 mb-1.5">Username atau Email</label>
              <input 
                type="text" 
                id="input-username" 
                name="username_or_email"
                placeholder="admin"
                class="w-full px-4 py-2.5 bg-gray-50 border border-gray-300 rounded-lg text-gray-900 text-sm placeholder-gray-400 focus:outline-none focus:bg-white focus:border-amber-500 focus:ring-2 focus:ring-amber-200 transition duration-200 group-hover:border-amber-400"
                required
              >
            </div>

            <!-- Password -->
            <div class="group">
              <label class="block text-sm font-medium text-gray-700 mb-1.5">Password</label>
              <input 
                type="password" 
                id="input-password" 
                name="password"
                placeholder="••••••••"
                class="w-full px-4 py-2.5 bg-gray-50 border border-gray-300 rounded-lg text-gray-900 text-sm placeholder-gray-400 focus:outline-none focus:bg-white focus:border-amber-500 focus:ring-2 focus:ring-amber-200 transition duration-200 group-hover:border-amber-400"
                required
              >
            </div>

            <!-- Submit Button -->
            <button 
              type="submit"
              id="btn-login"
              class="w-full mt-6 px-4 py-2.5 bg-amber-600 hover:bg-amber-700 text-white font-medium rounded-lg transition-all duration-200 hover:shadow-lg active:scale-95 focus:outline-none focus:ring-2 focus:ring-amber-500 focus:ring-offset-2"
            >
              Masuk
            </button>
          </form>
        </div>
      </div>
    `;
  }

  private renderLoadingState(): string {
    return `
      <div class="w-full">
        <!-- Header -->
        <div class="mb-8 text-center animate-slideDown">
          <h1 class="text-4xl font-bold text-gray-900 tracking-tight">Absensi Santri</h1>
        </div>

        <!-- Loading Card -->
        <div class="bg-white rounded-xl shadow-lg p-12 animate-fadeInUp border border-gray-100 flex flex-col items-center justify-center min-h-48">
          <!-- Spinner -->
          <div class="mb-6">
            <div class="w-12 h-12 border-4 border-gray-200 border-t-amber-600 rounded-full animate-spin"></div>
          </div>
          
          <p class="text-gray-700 font-medium text-center">Memverifikasi akun...</p>
          <p class="text-gray-500 text-sm mt-1">Harap tunggu sebentar</p>
        </div>
      </div>
    `;
  }

  private renderErrorState(): string {
    return `
      <div class="w-full">
        <!-- Header -->
        <div class="mb-8 text-center animate-slideDown">
          <h1 class="text-4xl font-bold text-gray-900 tracking-tight">Absensi Santri</h1>
        </div>

        <!-- Error Card -->
        <div class="bg-white rounded-xl shadow-lg p-6 animate-fadeInUp border border-red-200">
          <!-- Error Header -->
          <div class="mb-5 pb-4 border-b border-red-100">
            <h2 class="text-lg font-bold text-red-600">Login Gagal</h2>
          </div>

          <!-- Error Message -->
          <div class="mb-6 p-4 bg-red-50 rounded-lg border border-red-200">
            <p class="text-sm text-red-700">${this.errorMessage}</p>
          </div>

          <!-- Buttons -->
          <div class="grid grid-cols-2 gap-3">
            <button id="btn-back" class="px-4 py-2.5 bg-gray-100 hover:bg-gray-200 text-gray-900 font-medium text-sm rounded-lg transition-colors duration-200">
              Kembali
            </button>
            <button id="btn-retry" class="px-4 py-2.5 bg-amber-600 hover:bg-amber-700 text-white font-medium text-sm rounded-lg transition-colors duration-200">
              Coba Lagi
            </button>
          </div>
        </div>
      </div>
    `;
  }

  private setupEventListeners(): void {
    if (this.currentState === "form") {
      const form = document.getElementById("login-form") as HTMLFormElement;
      form?.addEventListener("submit", (e) => {
        e.preventDefault();
        this.handleLogin();
      });
    } else if (this.currentState === "error") {
      document.getElementById("btn-back")?.addEventListener("click", () => {
        this.currentState = "form";
        this.render();
      });

      document.getElementById("btn-retry")?.addEventListener("click", () => {
        this.currentState = "form";
        this.render();
      });
    }
  }

  private async handleLogin(): Promise<void> {
    const usernameInput = document.getElementById(
      "input-username",
    ) as HTMLInputElement;
    const passwordInput = document.getElementById(
      "input-password",
    ) as HTMLInputElement;

    if (!usernameInput.value || !passwordInput.value) {
      this.errorMessage = "Username/email dan password harus diisi";
      this.currentState = "error";
      this.render();
      return;
    }

    this.currentState = "loading";
    this.render();

    try {
      const credentials: LoginCredentials = {
        username_or_email: usernameInput.value,
        password: passwordInput.value,
      };

      const response = await fetch("/api/auth/login", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify(credentials),
      });

      if (!response.ok) {
        const errorData = await response.json();
        throw new Error(errorData.error || "Login gagal, silakan coba lagi");
      }

      const data = await response.json();
      this.onLoginSuccess(data.data);
    } catch (error) {
      this.errorMessage =
        error instanceof Error ? error.message : "Terjadi kesalahan saat login";
      this.currentState = "error";
      this.render();
    }
  }
}
