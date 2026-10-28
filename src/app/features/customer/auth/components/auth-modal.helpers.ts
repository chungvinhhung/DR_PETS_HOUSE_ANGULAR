/**
 * Hằng số & hàm tiện ích dùng chung cho các component trong thư mục này.
 * (Chuyển từ phần code nằm ngoài component trong React: src/components/auth/AuthModal.jsx)
 */
import { authImages } from '../../../../shared/customer/assets/auth-images';

export const EMPTY_FORMS = {
  login: { phone: "", password: "", remember: false },
  register: {
    name: "",
    phone: "",
    email: "",
    password: "",
    confirmPassword: "",
  },
  forgot: { account: "" },
  reset: { password: "", confirmPassword: "" },
};

export const SIDE_CONTENT = {
  login: {
    image: authImages.loginDog,
    title: "Chào mừng trở lại!",
    text: "Đăng nhập để quản lý hồ sơ thú cưng và đặt lịch hẹn dễ dàng.",
  },
  register: {
    image: authImages.registerDog,
    title: "Chào mừng bạn!",
    text: "Tham gia cùng chúng tôi để nhận dịch vụ chăm sóc tốt nhất cho thú cưng của bạn.",
  },
};

export const PHONE_PATTERN = /^(?:\+84|0)(?:3|5|7|8|9)\d{8}$/;

export const EMAIL_PATTERN = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

export const PASSWORD_PATTERN = /^(?=.*[A-Z])(?=.*\d).{8,}$/;

export const VALIDATION_SCHEMAS = {
  login: {
    phone: ["required", "account"],
    password: ["required"],
  },
  register: {
    name: ["required"],
    phone: ["required", "phone"],
    email: ["email"],
    password: ["required", "password"],
    confirmPassword: ["required", "confirmPassword"],
  },
  forgot: {
    account: ["required", "account"],
  },
  reset: {
    password: ["required", "password"],
    confirmPassword: ["required", "confirmPassword"],
  },
};

export const VALIDATION_MESSAGES = {
  requiredByField: {
    phone: "Vui lòng nhập số điện thoại",
    password: "Vui lòng nhập mật khẩu",
  },
  required: "Vui lòng điền thông tin",
  phone: "Số điện thoại không đúng định dạng",
  email: "Email không đúng định dạng",
  password: "Mật khẩu cần tối thiểu 8 ký tự, gồm 1 chữ hoa và 1 số",
  confirmPassword: "Mật khẩu xác nhận chưa khớp",
  account: "Vui lòng nhập đúng số điện thoại hoặc email",
};

export function getFieldError(form: any, field: any, rules: any) {
  const value = String((form as any)[field] ?? "").trim();

  for (const rule of rules) {
    if (rule === "required" && !value) {
      return (VALIDATION_MESSAGES.requiredByField as any)[field] ?? VALIDATION_MESSAGES.required;
    }
    if (!value) continue;
    if (rule === "phone" && !PHONE_PATTERN.test(value)) return VALIDATION_MESSAGES.phone;
    if (rule === "email" && !EMAIL_PATTERN.test(value)) return VALIDATION_MESSAGES.email;
    if (rule === "password" && !PASSWORD_PATTERN.test(value)) return VALIDATION_MESSAGES.password;
    if (rule === "confirmPassword" && value !== form.password) return VALIDATION_MESSAGES.confirmPassword;
    if (rule === "account" && !PHONE_PATTERN.test(value) && !EMAIL_PATTERN.test(value)) {
      return VALIDATION_MESSAGES.account;
    }
  }

  return "";
}

export function getFormErrors(form: any, schema: any) {
  return Object.fromEntries(
    Object.entries(schema).map(([field, rules]: any) => [field, getFieldError(form, field, rules)]),
  );
}

export function submitValidatedForm(event: any, errors: any, setValidationAttempted: any, onValid: any) {
  event.preventDefault();
  const formElement = event.currentTarget;
  setValidationAttempted(true);
  if (Object.values(errors).some(Boolean)) {
    window.setTimeout(() => {
      (formElement.querySelector('[data-auth-error="true"]') as any)?.focus();
    }, 0);
    return;
  }
  onValid();
}

