import { belongsTo } from "../utils/functions";
import { IStringOptions } from "../utils/interfaces";

export function isStringOk(
  str: any,
  { enums, maxLength = 40, minLength = 1, regExp }: IStringOptions = {}
) {
  if (belongsTo(str, [null, undefined]))
    return { valid: false, reasons: ["Unacceptable value"] };

  let valid = true,
    reasons: string[] = [];

  str = String(str).trim();

  if (str.length < minLength) return { valid: false, reasons: ["too short"] };

  if (str.length > maxLength) return { valid: false, reasons: ["too long"] };

  if (regExp && !regExp.test(str))
    return { valid: false, reasons: ["Unacceptable value"] };

  if (enums && !belongsTo(str, enums))
    return { valid: false, reasons: ["Unacceptable value"] };

  return { reasons, valid, validated: valid ? str : undefined };
}
