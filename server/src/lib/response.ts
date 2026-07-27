import type { ApiResponse, ApiError } from '@expense/shared';

export const ok = <T>(data: T): ApiResponse<T> => ({ success: true, data });
export const fail = (code: string, message: string): ApiError => ({
    success: false,
    error: { code, message }
});
