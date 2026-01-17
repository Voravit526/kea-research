/**
 * KEA Admin Panel - Form Utilities
 * Validation, error display, and form helpers
 */

// ============================================================================
// Validation Types
// ============================================================================

export interface ValidationRule {
  type: 'required' | 'minLength' | 'maxLength' | 'pattern' | 'custom';
  value?: string | number | RegExp | ((value: string) => boolean);
  message: string;
}

export interface FieldConfig {
  name: string;
  rules: ValidationRule[];
}

// ============================================================================
// Validation Functions
// ============================================================================

/**
 * Validate a single field value against rules
 * @returns Error message if invalid, null if valid
 */
export function validateValue(value: string, rules: ValidationRule[]): string | null {
  for (const rule of rules) {
    let isValid = true;

    switch (rule.type) {
      case 'required':
        isValid = value.trim().length > 0;
        break;
      case 'minLength':
        isValid = value.length >= (rule.value as number);
        break;
      case 'maxLength':
        isValid = value.length <= (rule.value as number);
        break;
      case 'pattern':
        isValid = (rule.value as RegExp).test(value);
        break;
      case 'custom':
        isValid = (rule.value as (v: string) => boolean)(value);
        break;
    }

    if (!isValid) {
      return rule.message;
    }
  }

  return null;
}

/**
 * Validate a form field and update its visual state
 * @returns Error message if invalid, null if valid
 */
export function validateField(
  field: HTMLInputElement | HTMLTextAreaElement | HTMLSelectElement,
  rules: ValidationRule[]
): string | null {
  const value = field.value;
  const error = validateValue(value, rules);

  // Find feedback element (next sibling with .invalid-feedback class)
  const feedback = field.nextElementSibling?.classList.contains('invalid-feedback')
    ? (field.nextElementSibling as HTMLElement)
    : field.parentElement?.querySelector('.invalid-feedback') as HTMLElement | null;

  if (error) {
    field.classList.add('is-invalid');
    field.classList.remove('is-valid');
    if (feedback) {
      feedback.textContent = error;
    }
  } else {
    field.classList.remove('is-invalid');
    field.classList.add('is-valid');
    if (feedback) {
      feedback.textContent = '';
    }
  }

  return error;
}

/**
 * Validate entire form against field configurations
 * @returns Object with isValid boolean and errors map
 */
export function validateForm(
  form: HTMLFormElement,
  fields: FieldConfig[]
): { isValid: boolean; errors: Map<string, string> } {
  const errors = new Map<string, string>();

  for (const fieldConfig of fields) {
    const field = form.elements.namedItem(fieldConfig.name) as
      | HTMLInputElement
      | HTMLTextAreaElement
      | HTMLSelectElement
      | null;

    if (field) {
      const error = validateField(field, fieldConfig.rules);
      if (error) {
        errors.set(fieldConfig.name, error);
      }
    }
  }

  return {
    isValid: errors.size === 0,
    errors,
  };
}

/**
 * Clear validation state from a form or single input element
 */
export function clearValidation(element: HTMLFormElement | HTMLInputElement | HTMLTextAreaElement | HTMLSelectElement): void {
  if (element instanceof HTMLFormElement) {
    // Clear all fields within the form
    element.querySelectorAll('.is-invalid').forEach((el) => el.classList.remove('is-invalid'));
    element.querySelectorAll('.is-valid').forEach((el) => el.classList.remove('is-valid'));
    element.querySelectorAll('.invalid-feedback').forEach((el) => {
      (el as HTMLElement).textContent = '';
    });
  } else {
    // Clear single input element
    element.classList.remove('is-invalid', 'is-valid');
    const feedback = element.parentElement?.querySelector('.invalid-feedback') as HTMLElement | null;
    if (feedback) {
      feedback.textContent = '';
    }
  }
}

// ============================================================================
// Password Validation (specific to admin panel)
// ============================================================================

/**
 * Password validation rules
 */
export const PASSWORD_RULES: ValidationRule[] = [
  {
    type: 'minLength',
    value: 8,
    message: 'Password must be at least 8 characters',
  },
  {
    type: 'custom',
    value: (v) => !/\s/.test(v),
    message: 'Password cannot contain spaces',
  },
  {
    type: 'pattern',
    value: /[a-z]/,
    message: 'Password must contain lowercase letters (a-z)',
  },
  {
    type: 'pattern',
    value: /[A-Z]/,
    message: 'Password must contain uppercase letters (A-Z)',
  },
  {
    type: 'pattern',
    value: /[0-9]/,
    message: 'Password must contain numbers (0-9)',
  },
  {
    type: 'pattern',
    value: /[!@#$%^&*()_+\-=\[\]{}|;:',.<>?/~`]/,
    message: 'Password must contain at least one symbol',
  },
];

/**
 * Validate password with all requirements
 * @returns Object with valid boolean and optional error message
 */
export function validatePassword(password: string): { valid: boolean; message?: string } {
  // Validate against rules
  const error = validateValue(password, PASSWORD_RULES);

  if (error) {
    return { valid: false, message: error };
  }

  return { valid: true };
}

// ============================================================================
// Common Field Rules
// ============================================================================

/**
 * Create required field rule
 */
export function required(message = 'This field is required'): ValidationRule {
  return { type: 'required', message };
}

/**
 * Create min length rule
 */
export function minLength(length: number, message?: string): ValidationRule {
  return {
    type: 'minLength',
    value: length,
    message: message ?? `Minimum ${length} characters required`,
  };
}

/**
 * Create max length rule
 */
export function maxLength(length: number, message?: string): ValidationRule {
  return {
    type: 'maxLength',
    value: length,
    message: message ?? `Maximum ${length} characters allowed`,
  };
}

/**
 * Create pattern rule
 */
export function pattern(regex: RegExp, message: string): ValidationRule {
  return { type: 'pattern', value: regex, message };
}

/**
 * Create custom validation rule
 */
export function custom(
  validator: (value: string) => boolean,
  message: string
): ValidationRule {
  return { type: 'custom', value: validator, message };
}
