/**
 * Password validation and strength checking
 */

import { z } from "zod";

/**
 * Password strength configuration
 */
export const PASSWORD_CONFIG = {
  /** Minimum password length */
  minLength: 8,
  /** Maximum password length */
  maxLength: 128,
  /** Require at least one uppercase letter */
  requireUppercase: true,
  /** Require at least one lowercase letter */
  requireLowercase: true,
  /** Require at least one number */
  requireNumber: true,
  /** Require at least one special character */
  requireSpecial: true,
  /** Special characters that are allowed */
  specialChars: "!@#$%^&*()_+-=[]{}|;:',.<>?/`~\"\\",
  /** Common passwords to reject */
  commonPasswords: [
    "password",
    "123456",
    "12345678",
    "qwerty",
    "abc123",
    "password123",
    "admin123",
    "letmein",
    "welcome",
    "monkey",
    "dragon",
    "master",
    "login",
    "passw0rd",
    "hello123",
  ],
};

/**
 * Password validation result
 */
export interface PasswordValidationResult {
  valid: boolean;
  score: number; // 0-4 (0 = very weak, 4 = very strong)
  errors: string[];
  suggestions: string[];
}

/**
 * Check if a password meets the complexity requirements
 */
export function validatePasswordComplexity(password: string): PasswordValidationResult {
  const errors: string[] = [];
  const suggestions: string[] = [];
  let score = 0;

  // Length checks
  if (password.length < PASSWORD_CONFIG.minLength) {
    errors.push(`Password must be at least ${PASSWORD_CONFIG.minLength} characters long`);
  } else {
    score++;
    if (password.length >= 12) score++;
    if (password.length >= 16) {
      score++;
      suggestions.push("Great password length!");
    }
  }

  if (password.length > PASSWORD_CONFIG.maxLength) {
    errors.push(`Password must be no more than ${PASSWORD_CONFIG.maxLength} characters`);
  }

  // Character type checks
  const hasUppercase = /[A-Z]/.test(password);
  const hasLowercase = /[a-z]/.test(password);
  const hasNumber = /[0-9]/.test(password);
  const specialRegex = new RegExp(
    `[${PASSWORD_CONFIG.specialChars.replace(/[-[\]{}()*+?.,\\^$|#\s]/g, "\\$&")}]`
  );
  const hasSpecial = specialRegex.test(password);

  if (PASSWORD_CONFIG.requireUppercase && !hasUppercase) {
    errors.push("Password must contain at least one uppercase letter");
  }

  if (PASSWORD_CONFIG.requireLowercase && !hasLowercase) {
    errors.push("Password must contain at least one lowercase letter");
  }

  if (PASSWORD_CONFIG.requireNumber && !hasNumber) {
    errors.push("Password must contain at least one number");
  }

  if (PASSWORD_CONFIG.requireSpecial && !hasSpecial) {
    errors.push("Password must contain at least one special character (!@#$%^&*...)");
  }

  // Add score for variety
  const charTypes = [hasUppercase, hasLowercase, hasNumber, hasSpecial].filter(Boolean).length;
  if (charTypes >= 3) score++;
  if (charTypes === 4) score++;

  // Check for common passwords
  const lowerPassword = password.toLowerCase();
  if (PASSWORD_CONFIG.commonPasswords.some((common) => lowerPassword.includes(common))) {
    errors.push("Password is too common or contains a common password pattern");
    score = Math.max(0, score - 2);
  }

  // Check for sequential characters
  if (/(.)\1{2,}/.test(password)) {
    suggestions.push("Avoid using repeated characters");
    score = Math.max(0, score - 1);
  }

  // Check for sequential numbers or letters
  if (/(?:012|123|234|345|456|567|678|789|890)/.test(password)) {
    suggestions.push("Avoid using sequential numbers");
    score = Math.max(0, score - 1);
  }

  if (/(?:abc|bcd|cde|def|efg|fgh|ghi|hij|ijk|jkl|klm|lmn|mno|nop|opq|pqr|qrs|rst|stu|tuv|uvw|vwx|wxy|xyz)/i.test(password)) {
    suggestions.push("Avoid using sequential letters");
    score = Math.max(0, score - 1);
  }

  // Check for keyboard patterns
  const keyboardPatterns = ["qwerty", "asdf", "zxcv", "qazwsx", "1qaz", "2wsx"];
  if (keyboardPatterns.some((pattern) => lowerPassword.includes(pattern))) {
    suggestions.push("Avoid using keyboard patterns");
    score = Math.max(0, score - 1);
  }

  // Cap score at 4
  score = Math.min(4, Math.max(0, score));

  // Add suggestions for improvement
  if (score < 3) {
    if (password.length < 12) {
      suggestions.push("Use a longer password for better security");
    }
    if (charTypes < 4) {
      suggestions.push("Use a mix of uppercase, lowercase, numbers, and special characters");
    }
  }

  return {
    valid: errors.length === 0,
    score,
    errors,
    suggestions,
  };
}

/**
 * Get a human-readable strength label
 */
export function getPasswordStrengthLabel(score: number): string {
  switch (score) {
    case 0:
      return "Very Weak";
    case 1:
      return "Weak";
    case 2:
      return "Fair";
    case 3:
      return "Strong";
    case 4:
      return "Very Strong";
    default:
      return "Unknown";
  }
}

/**
 * Get a color for the strength indicator
 */
export function getPasswordStrengthColor(score: number): string {
  switch (score) {
    case 0:
      return "red";
    case 1:
      return "orange";
    case 2:
      return "yellow";
    case 3:
      return "lime";
    case 4:
      return "green";
    default:
      return "gray";
  }
}

/**
 * Zod schema for password validation
 */
export const passwordSchema = z
  .string()
  .min(PASSWORD_CONFIG.minLength, `Password must be at least ${PASSWORD_CONFIG.minLength} characters`)
  .max(PASSWORD_CONFIG.maxLength, `Password must be no more than ${PASSWORD_CONFIG.maxLength} characters`)
  .refine(
    (password) => !PASSWORD_CONFIG.requireUppercase || /[A-Z]/.test(password),
    "Password must contain at least one uppercase letter"
  )
  .refine(
    (password) => !PASSWORD_CONFIG.requireLowercase || /[a-z]/.test(password),
    "Password must contain at least one lowercase letter"
  )
  .refine(
    (password) => !PASSWORD_CONFIG.requireNumber || /[0-9]/.test(password),
    "Password must contain at least one number"
  )
  .refine(
    (password) => {
      if (!PASSWORD_CONFIG.requireSpecial) return true;
      const specialRegex = new RegExp(
        `[${PASSWORD_CONFIG.specialChars.replace(/[-[\]{}()*+?.,\\^$|#\s]/g, "\\$&")}]`
      );
      return specialRegex.test(password);
    },
    "Password must contain at least one special character"
  )
  .refine(
    (password) => {
      const lowerPassword = password.toLowerCase();
      return !PASSWORD_CONFIG.commonPasswords.some((common) => lowerPassword.includes(common));
    },
    "Password is too common"
  );

/**
 * Check if two passwords match
 */
export function passwordsMatch(password: string, confirmPassword: string): boolean {
  return password === confirmPassword;
}

/**
 * Schema for password with confirmation
 */
export const passwordWithConfirmationSchema = z
  .object({
    password: passwordSchema,
    confirmPassword: z.string(),
  })
  .refine((data) => data.password === data.confirmPassword, {
    message: "Passwords do not match",
    path: ["confirmPassword"],
  });

/**
 * Generate password requirements text for UI display
 */
export function getPasswordRequirements(): string[] {
  const requirements: string[] = [];
  
  requirements.push(`At least ${PASSWORD_CONFIG.minLength} characters long`);
  
  if (PASSWORD_CONFIG.requireUppercase) {
    requirements.push("At least one uppercase letter (A-Z)");
  }
  
  if (PASSWORD_CONFIG.requireLowercase) {
    requirements.push("At least one lowercase letter (a-z)");
  }
  
  if (PASSWORD_CONFIG.requireNumber) {
    requirements.push("At least one number (0-9)");
  }
  
  if (PASSWORD_CONFIG.requireSpecial) {
    requirements.push("At least one special character (!@#$%^&*...)");
  }
  
  return requirements;
}
