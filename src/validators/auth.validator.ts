import { body } from "express-validator";

export const registerValidator = [
  body("email").isEmail(),
  body("password").isLength({ min: 6 }),
  body("name").notEmpty(),
];

export const loginValidator = [
  body("email").isEmail(),
  body("password").notEmpty(),
  body("rememberMe").isBoolean(),
];

export const forgot_password_Validator = [body("email").isEmail()];

export const reset_password_Validator = [
  body("token").notEmpty().withMessage("Reset token is required."),

  body("password")
    .notEmpty()
    .withMessage("New password is required.")
    .isLength({ min: 6 })
    .withMessage("Password must be at least 6 characters long.")
    .matches(/[A-Z]/)
    .withMessage("Password must contain at least one uppercase letter.")
    .matches(/[a-z]/)
    .withMessage("Password must contain at least one lowercase letter.")
    .matches(/[0-9]/)
    .withMessage("Password must contain at least one number.")
    .matches(/[^A-Za-z0-9]/)
    .withMessage("Password must contain at least one special character."),
];
