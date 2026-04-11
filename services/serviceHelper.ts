import type { ServiceResult } from '@/types/service';

export function success<T>(data?: T, message?: string): ServiceResult<T> {
  return {
    success: true,
    data,
    message,
  };
}

export function fail<T>(message?: string, data?: T): ServiceResult<T> {
  return {
    success: false,
    data,
    message,
  };
}
