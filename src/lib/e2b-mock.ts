// Mock for E2B on the Edge runtime
export const Sandbox = {
  create: () => { throw new Error("E2B Sandbox is not available in the Edge runtime."); },
  connect: () => { throw new Error("E2B Sandbox is not available in the Edge runtime."); },
};
export default { Sandbox };
