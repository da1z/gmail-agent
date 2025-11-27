export const isLocal = () => {
  return !process.env.VERCEL;
};
