// Lightweight validators used across forms
export function isEmailValid(email){
  return typeof email === 'string' && /\S+@\S+\.\S+/.test(email);
}

export function isIdNumberValid(id){
  // basic: 6-20 alphanumeric
  return typeof id === 'string' && /^[A-Za-z0-9\-]{6,20}$/.test(id);
}

export function isPhoneValid(phone){
  // allow digits, +, spaces, - . min 7 chars
  return !phone || /^[\d\s\+\-\.]{7,20}$/.test(phone);
}

export function isAccountNumberValid(acc){
  // basic numeric check
  return typeof acc === 'string' && /^[0-9]{6,30}$/.test(acc);
}

export function isLicensePlateValid(plate){
  // allow alphanumeric and dash, 3-10 chars
  return typeof plate === 'string' && /^[A-Za-z0-9\-]{3,10}$/.test(plate);
}

export function isYearValid(y){
  const n = Number(y);
  return Number.isInteger(n) && n > 1900 && n <= new Date().getFullYear()+1;
}

export function isDisplacementValid(d){
  const n = Number(d);
  return Number.isInteger(n) && n > 0 && n < 10000;
}
