/// <reference types="vite/client" />

declare module "*?url" {
  const src: string;
  export default src;
}

declare module "*.ttf?url" {
  const src: string;
  export default src;
}