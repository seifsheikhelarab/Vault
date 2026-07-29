import { describe, it, expect, beforeEach, vi, afterEach } from 'vitest';
import { renderHook, act } from '@testing-library/react';
import { useTheme } from './use-theme';

describe('useTheme', () => {
    let matchMediaMock: ReturnType<typeof vi.fn>;

    beforeEach(() => {
        localStorage.clear();
        document.documentElement.classList.remove('dark');

        matchMediaMock = vi.fn(() => ({
            matches: false,
            addEventListener: vi.fn(),
            removeEventListener: vi.fn()
        }));
        vi.stubGlobal('matchMedia', matchMediaMock);
    });

    afterEach(() => {
        vi.unstubAllGlobals();
    });

    it('defaults to light theme when no preference is stored', () => {
        const { result } = renderHook(() => useTheme());
        expect(result.current.theme).toBe('light');
        expect(result.current.isDark).toBe(false);
    });

    it('reads the stored theme from localStorage', () => {
        localStorage.setItem('vault-theme', 'dark');
        const { result } = renderHook(() => useTheme());
        expect(result.current.theme).toBe('dark');
        expect(result.current.isDark).toBe(true);
    });

    it('falls back to system preference when no value is stored', () => {
        matchMediaMock.mockReturnValue({
            matches: true,
            addEventListener: vi.fn(),
            removeEventListener: vi.fn()
        });
        const { result } = renderHook(() => useTheme());
        expect(result.current.theme).toBe('dark');
    });

    it('toggles the theme', () => {
        const { result } = renderHook(() => useTheme());
        act(() => result.current.toggle());
        expect(result.current.theme).toBe('dark');
        act(() => result.current.toggle());
        expect(result.current.theme).toBe('light');
    });

    it('persists the theme to localStorage', () => {
        const { result } = renderHook(() => useTheme());
        act(() => result.current.toggle());
        expect(localStorage.getItem('vault-theme')).toBe('dark');
    });

    it('adds and removes the dark class on the document element', () => {
        const { result } = renderHook(() => useTheme());
        expect(document.documentElement.classList.contains('dark')).toBe(false);
        act(() => result.current.toggle());
        expect(document.documentElement.classList.contains('dark')).toBe(true);
        act(() => result.current.toggle());
        expect(document.documentElement.classList.contains('dark')).toBe(false);
    });
});
