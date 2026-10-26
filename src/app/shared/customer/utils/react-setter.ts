import { WritableSignal } from '@angular/core';

/**
 * Tạo hàm "setState" giống React từ một signal — dùng khi cần TRUYỀN hàm set cho component con
 * (trong React: <Child setValue={setValue} />).
 *
 *   readonly setValueFn = reactSetter(this.value);
 *   setValueFn(5)                 // = value.set(5)
 *   setValueFn((prev) => prev + 1) // = value.update(prev => prev + 1)
 */
export function reactSetter<T>(target: WritableSignal<T>): (value: T | ((prev: T) => T)) => void {
  return (value) => target.set(typeof value === 'function' ? (value as (prev: T) => T)(target()) : value);
}
