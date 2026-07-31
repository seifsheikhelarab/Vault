import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { renderHook, act } from '@testing-library/react';
import { useCountUp } from './use-count-up';

describe('useCountUp', () => {
    let rafHandle = 0;
    let currentTimestamp = 0;
    const pending = new Map<number, FrameRequestCallback>();

    beforeEach(() => {
        vi.useFakeTimers({ shouldAdvanceTime: true });
        pending.clear();
        currentTimestamp = 0;

        vi.stubGlobal('requestAnimationFrame', (cb: FrameRequestCallback) => {
            rafHandle += 1;
            pending.set(rafHandle, cb);
            return rafHandle;
        });

        vi.stubGlobal('cancelAnimationFrame', (handle: number) => {
            pending.delete(handle);
        });

        vi.stubGlobal('performance', {
            now: () => currentTimestamp
        });
    });

    afterEach(() => {
        vi.useRealTimers();
        vi.unstubAllGlobals();
        pending.clear();
    });

    const advanceFrame = (ms: number) => {
        act(() => {
            let remaining = ms;
            // Advance time in 16ms increments (~60fps) to simulate real
            // rAF frames. Each callback sees a progressively later
            // timestamp so `elapsed` grows and the animation completes.
            while (remaining > 0) {
                const step = Math.min(16, remaining);
                currentTimestamp += step;
                vi.advanceTimersByTime(step);
                remaining -= step;

                const snapshot = Array.from(pending.entries());
                pending.clear();
                snapshot.forEach(([, cb]) => cb(currentTimestamp));
            }
        });
    };

    it('immediately shows the target when disabled', () => {
        const { result } = renderHook(() => useCountUp(123, false));
        expect(result.current).toBe(123);
    });

    it('starts at zero and reaches the target after the animation', () => {
        const { result } = renderHook(() => useCountUp(100));
        expect(result.current).toBe(0);

        // 600ms is the animation duration; advance past it to guarantee completion.
        advanceFrame(700);
        expect(result.current).toBe(100);
    });

    it('updates when the target changes', () => {
        const { result, rerender } = renderHook(
            ({ target }) => useCountUp(target),
            { initialProps: { target: 100 } }
        );
        advanceFrame(700);
        expect(result.current).toBe(100);

        rerender({ target: 200 });
        advanceFrame(700);
        expect(result.current).toBe(200);
    });
});
