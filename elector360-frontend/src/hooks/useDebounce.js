// src/hooks/useDebounce.js

import { useState, useEffect } from 'react';

/**
 * Hook para hacer debounce de un valor
 * Útil para búsquedas en tiempo real
 * 
 * @param {*} value - Valor a hacer debounce
 * @param {number} delay - Delay en milisegundos (default: 500)
 * @returns {*} Valor con debounce aplicado
 */
function useDebounce(value, delay = 500) {
  const [debouncedValue, setDebouncedValue] = useState(value);

  useEffect(() => {
    // Crear timeout para actualizar el valor
    const handler = setTimeout(() => {
      setDebouncedValue(value);
    }, delay);

    // Limpiar timeout si el valor cambia antes del delay
    return () => {
      clearTimeout(handler);
    };
  }, [value, delay]);

  return debouncedValue;
}

export default useDebounce;