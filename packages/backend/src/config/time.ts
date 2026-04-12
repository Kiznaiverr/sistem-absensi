import env from "./env.js";

export const timeConfig = {
  timezone: env.TIMEZONE,
  shifts: {
    siang: {
      start: env.SHIFT_SIANG_START, // "13:00"
      end: env.SHIFT_SIANG_END, // "16:00"
    },
    malam: {
      start: env.SHIFT_MALAM_START, // "18:00"
      end: env.SHIFT_MALAM_END, // "21:00"
    },
  },
} as const;

export default timeConfig;
