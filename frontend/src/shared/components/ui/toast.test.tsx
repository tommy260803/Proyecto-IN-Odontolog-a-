import { act, fireEvent, render, screen } from '@testing-library/react';
import { expect, it, vi } from 'vitest';
import { Toast, ToastProvider, ToastTitle, ToastViewport } from './toast';

it('uses the countdown duration for closing and pauses both when the window loses focus', () => {
  vi.useFakeTimers();
  const closed = vi.fn();
  const view = render(<ToastProvider duration={5000}>
    <Toast duration={10000} onOpenChange={closed}><ToastTitle>Alerta urgente</ToastTitle></Toast>
    <ToastViewport />
  </ToastProvider>);
  try {
    const bar = screen.getByText('Alerta urgente').closest('li')!.querySelector<HTMLElement>('.animate-toast-progress')!;
    expect(bar.style.getPropertyValue('--toast-duration')).toBe('10000ms');
    act(() => vi.advanceTimersByTime(5000));
    expect(closed).not.toHaveBeenCalled();
    fireEvent.blur(window);
    expect(bar.style.animationPlayState).toBe('paused');
    act(() => vi.advanceTimersByTime(5000));
    expect(closed).not.toHaveBeenCalled();
    fireEvent.focus(window);
    expect(bar.style.animationPlayState).toBe('running');
    act(() => vi.advanceTimersByTime(4999));
    expect(closed).not.toHaveBeenCalled();
    act(() => vi.advanceTimersByTime(1));
    expect(closed).toHaveBeenCalledWith(false);
  } finally {
    view.unmount();
    vi.useRealTimers();
  }
});
