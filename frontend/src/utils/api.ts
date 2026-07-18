export class ApiError extends Error {
  constructor(public status: number, message: string, public data?: any) {
    super(message);
    this.name = 'ApiError';
  }
}

export async function apiFetch<T = any>(url: string, options?: RequestInit): Promise<T> {
  const response = await fetch(url, options);
  if (!response.ok) {
    let errorMessage = `API error ${response.status}: ${response.statusText}`;
    let errData: any = null;
    try {
      errData = await response.json();
      if (errData && errData.message) {
        errorMessage = errData.message;
      }
    } catch {
      // Ignore JSON parsing failure
    }
    throw new ApiError(response.status, errorMessage, errData);
  }
  return response.json();
}
